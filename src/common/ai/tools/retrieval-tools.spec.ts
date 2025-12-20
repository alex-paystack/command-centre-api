/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  createGetTransactionsTool,
  createGetCustomersTool,
  createGetRefundsTool,
  createGetPayoutsTool,
  createGetDisputesTool,
} from './retrieval';
import { PaystackApiService } from '../../services/paystack-api.service';
import {
  PaystackTransaction,
  PaystackCustomer,
  PaystackRefund,
  PaystackPayout,
  PaystackDispute,
  ToolIntent,
} from '../types';
import { TransactionStatus, RefundStatus, PayoutStatus, DisputeStatusSlug, PaymentChannel } from '../types/data';

describe('Data Retrieval Tools', () => {
  let mockPaystackService: jest.Mocked<PaystackApiService>;
  let mockGetAuthenticatedUser: jest.Mock;

  const mockToolCallOptions = {
    toolCallId: 'test-tool-call-id',
    messages: [],
  };

  beforeEach(() => {
    mockPaystackService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<PaystackApiService>;

    mockGetAuthenticatedUser = jest.fn().mockReturnValue({
      userId: 'test-user-id',
      jwtToken: 'test-token',
    });
  });

  describe('createGetTransactionsTool', () => {
    it('should fetch transactions successfully', async () => {
      const mockTransactions: PaystackTransaction[] = [
        {
          id: 1,
          reference: 'ref123',
          amount: 50000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
        } as PaystackTransaction,
        {
          id: 2,
          reference: 'ref456',
          amount: 75000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.BANK,
          currency: 'NGN',
        } as PaystackTransaction,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransactions,
        meta: {
          total: 2,
          total_volume: 125000,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        transactions: mockTransactions,
        message: 'Retrieved 2 transaction(s)',
      });
      expect(mockPaystackService.get).toHaveBeenCalledWith('/transaction', 'test-token', expect.any(Object));
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
      expect(mockPaystackService.get).not.toHaveBeenCalled();
    });

    it('should validate date range (30-day limit)', async () => {
      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-03-01', // More than 30 days
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: expect.stringContaining('30 days'),
      });
      expect(mockPaystackService.get).not.toHaveBeenCalled();
    });

    it('should pass filters correctly to API', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          perPage: 25,
          page: 2,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          from: '2024-01-01',
          to: '2024-01-31',
          currency: 'NGN',
          amount: 100,
        },
        mockToolCallOptions,
      );

      expect(mockPaystackService.get).toHaveBeenCalledWith('/transaction', 'test-token', {
        perPage: 25,
        page: 2,
        reduced_fields: true,
        status: TransactionStatus.SUCCESS,
        channel: PaymentChannel.CARD,
        from: '2024-01-01',
        to: '2024-01-31',
        currency: 'NGN',
        amount: 10000, // Converted to subunits
      });
    });

    it('should handle API errors gracefully', async () => {
      mockPaystackService.get.mockRejectedValueOnce(new Error('Network Error'));

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Network Error',
      });
    });

    it('should return count when intent is COUNT', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: [{ id: 1 } as PaystackTransaction], // Only 1 item because perPage=1
        meta: {
          total: 150,
          total_volume: 5000000,
          skipped: 0,
          perPage: 1,
          page: 1,
          pageCount: 150,
        },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.COUNT, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        count: 150,
        message: 'Found 150 transaction(s)',
      });
      expect(result).not.toHaveProperty('transactions');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/transaction',
        'test-token',
        expect.objectContaining({ perPage: 1 }),
      );
    });

    it('should return full data when intent is FETCH', async () => {
      const mockTransactions: PaystackTransaction[] = [
        { id: 1, reference: 'ref123' } as PaystackTransaction,
        { id: 2, reference: 'ref456' } as PaystackTransaction,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransactions,
        meta: { total: 2, total_volume: 125000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.FETCH, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        transactions: mockTransactions,
        message: 'Retrieved 2 transaction(s)',
      });
      expect(result).not.toHaveProperty('count');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/transaction',
        'test-token',
        expect.objectContaining({ perPage: 50 }),
      );
    });

    it('should return full data when intent parameter is omitted (backward compatibility)', async () => {
      const mockTransactions: PaystackTransaction[] = [{ id: 1 } as PaystackTransaction];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransactions,
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        transactions: mockTransactions,
        message: 'Retrieved 1 transaction(s)',
      });
      expect(result).not.toHaveProperty('count');
    });
  });

  describe('createGetCustomersTool', () => {
    it('should fetch customers successfully', async () => {
      const mockCustomers: PaystackCustomer[] = [
        {
          id: 1,
          email: 'customer1@example.com',
          customer_code: 'CUS_123',
          first_name: 'John',
          last_name: 'Doe',
        } as PaystackCustomer,
        {
          id: 2,
          email: 'customer2@example.com',
          customer_code: 'CUS_456',
          first_name: 'Jane',
          last_name: 'Smith',
        } as PaystackCustomer,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: mockCustomers,
        meta: {
          total: 2,
          total_volume: 0,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        customers: mockCustomers,
        message: 'Retrieved 2 customer(s)',
      });
      expect(mockPaystackService.get).toHaveBeenCalledWith('/customer', 'test-token', expect.any(Object));
    });

    it('should filter by email', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.({ perPage: 50, page: 1, email: 'test@example.com' }, mockToolCallOptions);

      expect(mockPaystackService.get).toHaveBeenCalledWith('/customer', 'test-token', {
        perPage: 50,
        page: 1,
        email: 'test@example.com',
      });
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
    });

    it('should return count when intent is COUNT', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: [{ id: 1 } as PaystackCustomer],
        meta: { total: 250, total_volume: 0, skipped: 0, perPage: 1, page: 1, pageCount: 250 },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.COUNT, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        count: 250,
        message: 'Found 250 customer(s)',
      });
      expect(result).not.toHaveProperty('customers');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/customer',
        'test-token',
        expect.objectContaining({ perPage: 1 }),
      );
    });

    it('should return full data when intent is FETCH', async () => {
      const mockCustomers: PaystackCustomer[] = [
        { id: 1, email: 'test1@example.com' } as PaystackCustomer,
        { id: 2, email: 'test2@example.com' } as PaystackCustomer,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: mockCustomers,
        meta: { total: 2, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.FETCH, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        customers: mockCustomers,
        message: 'Retrieved 2 customer(s)',
      });
      expect(result).not.toHaveProperty('count');
    });

    it('should return full data when intent parameter is omitted (backward compatibility)', async () => {
      const mockCustomers: PaystackCustomer[] = [{ id: 1 } as PaystackCustomer];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: mockCustomers,
        meta: { total: 1, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        customers: mockCustomers,
        message: 'Retrieved 1 customer(s)',
      });
      expect(result).not.toHaveProperty('count');
    });
  });

  describe('createGetRefundsTool', () => {
    it('should fetch refunds successfully', async () => {
      const mockRefunds: PaystackRefund[] = [
        {
          id: 1,
          amount: 50000,
          status: RefundStatus.PROCESSED,
          transaction_reference: 'ref123',
        } as PaystackRefund,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: mockRefunds,
        meta: {
          total: 1,
          total_volume: 50000,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        { perPage: 50, page: 1, amount_operator: 'eq', status: RefundStatus.PROCESSED },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        success: true,
        refunds: mockRefunds,
        message: 'Retrieved 1 refund(s)',
      });
      expect(mockPaystackService.get).toHaveBeenCalledWith('/refund', 'test-token', expect.any(Object));
    });

    it('should handle amount filter with operators', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          amount: 100,
          amount_operator: 'gt',
        },
        mockToolCallOptions,
      );

      expect(mockPaystackService.get).toHaveBeenCalledWith('/refund', 'test-token', {
        perPage: 50,
        page: 1,
        amount: JSON.stringify({ gt: 10000 }), // Greater than filter
      });
    });

    it('should validate date range', async () => {
      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          amount_operator: 'eq',
          from: '2024-01-01',
          to: '2024-03-01',
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: expect.stringContaining('30 days'),
      });
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1, amount_operator: 'eq' }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
    });

    it('should return count when intent is COUNT', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: [{ id: 1 } as PaystackRefund],
        meta: { total: 75, total_volume: 300000, skipped: 0, perPage: 1, page: 1, pageCount: 75 },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        { intent: ToolIntent.COUNT, perPage: 50, page: 1, amount_operator: 'eq' },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        success: true,
        count: 75,
        message: 'Found 75 refund(s)',
      });
      expect(result).not.toHaveProperty('refunds');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/refund',
        'test-token',
        expect.objectContaining({ perPage: 1 }),
      );
    });

    it('should return full data when intent is FETCH', async () => {
      const mockRefunds: PaystackRefund[] = [{ id: 1, amount: 50000 } as PaystackRefund];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: mockRefunds,
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        { intent: ToolIntent.FETCH, perPage: 50, page: 1, amount_operator: 'eq' },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        success: true,
        refunds: mockRefunds,
        message: 'Retrieved 1 refund(s)',
      });
      expect(result).not.toHaveProperty('count');
    });

    it('should return full data when intent parameter is omitted (backward compatibility)', async () => {
      const mockRefunds: PaystackRefund[] = [{ id: 1 } as PaystackRefund];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: mockRefunds,
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1, amount_operator: 'eq' }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        refunds: mockRefunds,
        message: 'Retrieved 1 refund(s)',
      });
      expect(result).not.toHaveProperty('count');
    });
  });

  describe('createGetPayoutsTool', () => {
    it('should fetch payouts successfully', async () => {
      const mockPayouts: PaystackPayout[] = [
        {
          id: 1,
          total_amount: 500000,
          status: PayoutStatus.SUCCESS,
          settlement_date: '2024-01-15',
        } as PaystackPayout,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: mockPayouts,
        meta: {
          total: 1,
          total_volume: 500000,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1, status: PayoutStatus.SUCCESS }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        payouts: mockPayouts,
        message: 'Retrieved 1 payout(s)',
      });
      expect(mockPaystackService.get).toHaveBeenCalledWith('/settlement', 'test-token', expect.any(Object));
    });

    it('should filter by subaccount', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.({ perPage: 50, page: 1, subaccount: 'ACCT_123' }, mockToolCallOptions);

      expect(mockPaystackService.get).toHaveBeenCalledWith('/settlement', 'test-token', {
        perPage: 50,
        page: 1,
        subaccount: 'ACCT_123',
      });
    });

    it('should validate date range', async () => {
      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-03-01',
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: expect.stringContaining('30 days'),
      });
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
    });

    it('should return count when intent is COUNT', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: [{ id: 1 } as PaystackPayout],
        meta: { total: 42, total_volume: 2000000, skipped: 0, perPage: 1, page: 1, pageCount: 42 },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.COUNT, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        count: 42,
        message: 'Found 42 payout(s)',
      });
      expect(result).not.toHaveProperty('payouts');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/settlement',
        'test-token',
        expect.objectContaining({ perPage: 1 }),
      );
    });

    it('should return full data when intent is FETCH', async () => {
      const mockPayouts: PaystackPayout[] = [{ id: 1, total_amount: 500000 } as PaystackPayout];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: mockPayouts,
        meta: { total: 1, total_volume: 500000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.FETCH, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        payouts: mockPayouts,
        message: 'Retrieved 1 payout(s)',
      });
      expect(result).not.toHaveProperty('count');
    });

    it('should return full data when intent parameter is omitted (backward compatibility)', async () => {
      const mockPayouts: PaystackPayout[] = [{ id: 1 } as PaystackPayout];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: mockPayouts,
        meta: { total: 1, total_volume: 500000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        payouts: mockPayouts,
        message: 'Retrieved 1 payout(s)',
      });
      expect(result).not.toHaveProperty('count');
    });
  });

  describe('createGetDisputesTool', () => {
    it('should fetch disputes successfully', async () => {
      const mockDisputes: PaystackDispute[] = [
        {
          id: 1,
          refund_amount: 50000,
          status: DisputeStatusSlug.RESOLVED,
          currency: 'NGN',
        } as PaystackDispute,
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: mockDisputes,
        meta: {
          total: 1,
          total_volume: 50000,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        { perPage: 50, page: 1, status: DisputeStatusSlug.RESOLVED },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        success: true,
        disputes: mockDisputes,
        message: 'Retrieved 1 dispute(s)',
      });
      expect(mockPaystackService.get).toHaveBeenCalledWith('/dispute', 'test-token', expect.any(Object));
    });

    it('should filter by transaction id', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.({ perPage: 50, page: 1, transaction: 12345 }, mockToolCallOptions);

      expect(mockPaystackService.get).toHaveBeenCalledWith('/dispute', 'test-token', {
        perPage: 50,
        page: 1,
        transaction: 12345,
      });
    });

    it('should handle ignore_resolved parameter', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: [],
        meta: { total: 0, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 0 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.({ perPage: 50, page: 1, ignore_resolved: 'yes' }, mockToolCallOptions);

      expect(mockPaystackService.get).toHaveBeenCalledWith('/dispute', 'test-token', {
        perPage: 50,
        page: 1,
        ignore_resolved: 'yes',
      });
    });

    it('should validate date range', async () => {
      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-03-01',
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: expect.stringContaining('30 days'),
      });
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
    });

    it('should handle API errors gracefully', async () => {
      mockPaystackService.get.mockRejectedValueOnce(new Error('API Error'));

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'API Error',
      });
    });

    it('should return count when intent is COUNT', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: [{ id: 1 } as PaystackDispute],
        meta: { total: 18, total_volume: 90000, skipped: 0, perPage: 1, page: 1, pageCount: 18 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.COUNT, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        count: 18,
        message: 'Found 18 dispute(s)',
      });
      expect(result).not.toHaveProperty('disputes');
      expect(mockPaystackService.get).toHaveBeenCalledWith(
        '/dispute',
        'test-token',
        expect.objectContaining({ perPage: 1 }),
      );
    });

    it('should return full data when intent is FETCH', async () => {
      const mockDisputes: PaystackDispute[] = [{ id: 1, refund_amount: 50000 } as PaystackDispute];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: mockDisputes,
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ intent: ToolIntent.FETCH, perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        disputes: mockDisputes,
        message: 'Retrieved 1 dispute(s)',
      });
      expect(result).not.toHaveProperty('count');
    });

    it('should return full data when intent parameter is omitted (backward compatibility)', async () => {
      const mockDisputes: PaystackDispute[] = [{ id: 1 } as PaystackDispute];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: mockDisputes,
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        disputes: mockDisputes,
        message: 'Retrieved 1 dispute(s)',
      });
      expect(result).not.toHaveProperty('count');
    });
  });

  describe('Tool Structure', () => {
    it('should have correct structure for all retrieval tools', () => {
      const transactionTool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const customerTool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const refundTool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const payoutTool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const disputeTool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);

      [transactionTool, customerTool, refundTool, payoutTool, disputeTool].forEach((tool) => {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('should have descriptions mentioning fetch/get functionality', () => {
      const transactionTool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const customerTool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const refundTool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const payoutTool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const disputeTool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);

      [transactionTool, customerTool, refundTool, payoutTool, disputeTool].forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description?.toLowerCase()).toMatch(/fetch|get|retrieve/);
      });
    });
  });
});
