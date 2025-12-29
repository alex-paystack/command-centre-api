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
import { PaystackTransaction, PaystackCustomer, PaystackRefund, PaystackPayout, PaystackDispute } from '../types';
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
        message: 'Retrieved 2 transaction(s)',
        transactions: expect.arrayContaining([
          expect.objectContaining({
            id: mockTransactions[0].id,
            reference: mockTransactions[0].reference,
            amount: mockTransactions[0].amount,
          }),
        ]),
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

    it('should validate date range (31-day limit)', async () => {
      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-03-01', // More than 31 days
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: expect.stringContaining('31 days'),
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

    it('should return sanitized transaction data (STANDARD level)', async () => {
      const mockFullTransaction = {
        id: 1,
        reference: 'ref123',
        amount: 50000,
        currency: 'NGN',
        status: TransactionStatus.SUCCESS,
        channel: PaymentChannel.CARD,
        gateway_response: 'Approved',
        fees: 750,
        paid_at: '2024-01-01T12:00:00Z',
        paidAt: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T12:00:00Z',
        domain: 'live',
        customer: {
          id: 100,
          email: 'test@example.com',
          customer_code: 'CUS_xxx',
          phone: '+2341234567890',
          first_name: 'John',
          last_name: 'Doe',
          risk_action: 'default',
        },
        authorization: {
          authorization_code: 'AUTH_xxx',
          bin: '408408',
          last4: '4081',
          bank: 'Test Bank',
          brand: 'visa',
          card_type: 'visa',
          channel: 'card',
        },
        log: {
          start_time: 1234567890,
          time_spent: 5,
          attempts: 1,
        },
        metadata: { custom_field: 'value' },
      } as unknown as PaystackTransaction;

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: [mockFullTransaction],
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      // Should have standard-level fields
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).toHaveProperty('id', 1);
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).toHaveProperty(
        'gateway_response',
        'Approved',
      );
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).toHaveProperty('fees', 750);
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).toHaveProperty('domain', 'live');

      // Should have customer with standard fields
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].customer).toMatchObject({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        phone: '+2341234567890',
      });

      // Should NOT have customer fields beyond standard level
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].customer).not.toHaveProperty(
        'first_name',
      );
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].customer).not.toHaveProperty(
        'last_name',
      );

      // Should have authorization with standard fields
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].authorization).toMatchObject({
        authorization_code: 'AUTH_xxx',
        bin: '408408',
        last4: '4081',
        bank: 'Test Bank',
      });

      // Should NOT have verbose fields (log, metadata, ip_address, receipt_number, message, requested_amount)
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].log).toBeUndefined();
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0].metadata).toBeUndefined();
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).not.toHaveProperty('ip_address');
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).not.toHaveProperty(
        'receipt_number',
      );
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).not.toHaveProperty('message');
      expect((result as { transactions: PaystackTransaction[] }).transactions?.[0]).not.toHaveProperty(
        'requested_amount',
      );
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
        message: 'Retrieved 2 customer(s)',
        customers: expect.arrayContaining([
          expect.objectContaining({
            id: mockCustomers[0].id,
            email: mockCustomers[0].email,
            customer_code: mockCustomers[0].customer_code,
          }),
        ]),
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

    it('should return sanitized customer data (STANDARD level)', async () => {
      const mockFullCustomer = {
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2341234567890',
        risk_action: 'default',
        international_format_phone: '+234 123 456 7890',
        identified: true,
        createdAt: '2024-01-01T12:00:00Z',
        metadata: { custom_field: 'value' },
        authorizations: [
          {
            authorization_code: 'AUTH_1',
            bin: '408408',
            last4: '4081',
            bank: 'Bank 1',
            brand: 'visa',
            card_type: 'visa',
            exp_month: '12',
            exp_year: '2025',
          },
          {
            authorization_code: 'AUTH_2',
            bin: '539983',
            last4: '8381',
            bank: 'Bank 2',
            brand: 'mastercard',
            card_type: 'mastercard',
            exp_month: '06',
            exp_year: '2026',
          },
        ],
      } as unknown as PaystackCustomer;

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Customers retrieved',
        data: [mockFullCustomer],
        meta: { total: 1, total_volume: 0, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetCustomersTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      // Should have standard-level fields
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).toHaveProperty('id', 100);
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).toHaveProperty('email', 'test@example.com');
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).toHaveProperty('first_name', 'John');
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).toHaveProperty('phone', '+2341234567890');

      // Should have authorizations array with limited items (3 max)
      expect((result as { customers: PaystackCustomer[] }).customers?.[0].authorizations).toHaveLength(2);
      expect((result as { customers: PaystackCustomer[] }).customers?.[0].authorizations?.[0]).toMatchObject({
        authorization_code: 'AUTH_1',
        bin: '408408',
        last4: '4081',
      });

      // Should NOT have detailed-level fields
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).not.toHaveProperty(
        'international_format_phone',
      );
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).not.toHaveProperty('identified');
      expect((result as { customers: PaystackCustomer[] }).customers?.[0]).not.toHaveProperty('metadata');

      // Authorization should not have exp_month/exp_year at standard level
      expect((result as { customers: PaystackCustomer[] }).customers?.[0].authorizations?.[0]).not.toHaveProperty(
        'exp_month',
      );
      expect((result as { customers: PaystackCustomer[] }).customers?.[0].authorizations?.[0]).not.toHaveProperty(
        'exp_year',
      );
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
        message: 'Retrieved 1 refund(s)',
        refunds: expect.arrayContaining([
          expect.objectContaining({
            id: mockRefunds[0].id,
            amount: mockRefunds[0].amount,
          }),
        ]),
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
        error: expect.stringContaining('31 days'),
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

    it('should return sanitized refund data (STANDARD level)', async () => {
      const mockFullRefund = {
        id: 1,
        amount: 50000,
        currency: 'NGN',
        status: RefundStatus.PROCESSED,
        transaction_reference: 'TXN_REF_123',
        refunded_at: '2024-01-02T12:00:00Z',
        refunded_by: 'admin@example.com',
        refund_type: 'full',
        domain: 'live',
        createdAt: '2024-01-02T12:00:00Z',
        transaction_amount: 50000,
        deducted_amount: '50000',
        customer_note: 'Customer requested refund',
        merchant_note: 'Approved by admin',
        reason: 'duplicate',
        customer: {
          id: 100,
          email: 'test@example.com',
          customer_code: 'CUS_xxx',
          phone: '+2341234567890',
          first_name: 'John',
          last_name: 'Doe',
        },
      } as unknown as PaystackRefund;

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Refunds retrieved',
        data: [mockFullRefund],
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1, amount_operator: 'eq' }, mockToolCallOptions);

      // Should have standard-level fields
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).toHaveProperty('id', 1);
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).toHaveProperty('refunded_by', 'admin@example.com');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).toHaveProperty('domain', 'live');

      // Should have customer with minimal fields only
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0].customer).toMatchObject({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
      });

      // Should NOT have customer detailed fields at standard level
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0].customer).not.toHaveProperty('phone');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0].customer).not.toHaveProperty('first_name');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0].customer).not.toHaveProperty('last_name');

      // Should NOT have detailed-level fields (notes, transaction_amount, deducted_amount, reason)
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).not.toHaveProperty('customer_note');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).not.toHaveProperty('merchant_note');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).not.toHaveProperty('transaction_amount');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).not.toHaveProperty('deducted_amount');
      expect((result as { refunds: PaystackRefund[] }).refunds?.[0]).not.toHaveProperty('reason');
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
        message: 'Retrieved 1 payout(s)',
        payouts: expect.arrayContaining([
          expect.objectContaining({
            id: mockPayouts[0].id,
            total_amount: mockPayouts[0].total_amount,
          }),
        ]),
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
        error: expect.stringContaining('31 days'),
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

    it('should return sanitized payout data (STANDARD level)', async () => {
      const mockFullPayout = {
        id: 1,
        total_amount: 100000,
        effective_amount: 98000,
        currency: 'NGN',
        status: PayoutStatus.SUCCESS,
        settlement_date: '2024-01-01',
        settled_by: 'system',
        total_fees: 2000,
        total_processed: 100000,
        domain: 'live',
        createdAt: '2024-01-01T12:00:00Z',
        updatedAt: '2024-01-01T13:00:00Z',
        deductions: 0,
        integration: 123,
        subaccount: {
          id: 1,
          subaccount_code: 'SUB_xxx',
          business_name: 'Test Business',
          account_number: '1234567890',
          settlement_bank: 'Test Bank',
          primary_contact_email: 'contact@example.com',
          primary_contact_name: 'Contact Name',
          primary_contact_phone: '+2341234567890',
        },
      } as unknown as PaystackPayout;

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Payouts retrieved',
        data: [mockFullPayout],
        meta: { total: 1, total_volume: 100000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      // Should have standard-level fields
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).toHaveProperty('id', 1);
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).toHaveProperty('effective_amount', 98000);
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).toHaveProperty('settled_by', 'system');
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).toHaveProperty('domain', 'live');

      // Should have subaccount with basic fields
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0].subaccount).toMatchObject({
        id: 1,
        subaccount_code: 'SUB_xxx',
        business_name: 'Test Business',
        primary_contact_email: 'contact@example.com',
      });

      // Should NOT have detailed-level fields
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).not.toHaveProperty('deductions');
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0]).not.toHaveProperty('updatedAt');

      // Subaccount should not have account details at standard level
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0].subaccount).not.toHaveProperty('account_number');
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0].subaccount).not.toHaveProperty('settlement_bank');
      expect((result as { payouts: PaystackPayout[] }).payouts?.[0].subaccount).not.toHaveProperty(
        'primary_contact_name',
      );
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
        message: 'Retrieved 1 dispute(s)',
        disputes: expect.arrayContaining([
          expect.objectContaining({
            id: mockDisputes[0].id,
            refund_amount: mockDisputes[0].refund_amount,
          }),
        ]),
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
        error: expect.stringContaining('31 days'),
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

    it('should return sanitized dispute data (STANDARD level)', async () => {
      const mockFullDispute = {
        id: 1,
        refund_amount: 50000,
        currency: 'NGN',
        status: DisputeStatusSlug.AWAITING_MERCHANT_FEEDBACK,
        resolution: null,
        category: 'chargeback',
        domain: 'live',
        transaction_reference: 'TXN_REF_123',
        dueAt: '2024-01-10T12:00:00Z',
        resolvedAt: '2024-01-15T12:00:00Z',
        createdAt: '2024-01-01T12:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
        bin: '408408',
        last4: '4081',
        note: 'Customer disputes charge',
        customer: {
          id: 100,
          email: 'test@example.com',
          customer_code: 'CUS_xxx',
          phone: '+2341234567890',
          first_name: 'John',
          last_name: 'Doe',
        },
        transaction: {
          id: 1,
          reference: 'TXN_REF_123',
          amount: 50000,
          currency: 'NGN',
          status: 'success',
          channel: 'card',
          gateway_response: 'Approved',
          paid_at: '2024-01-01T12:00:00Z',
        },
        history: [
          { status: 'pending', by: 'system', createdAt: '2024-01-01T12:00:00Z' },
          { status: 'awaiting-merchant-feedback', by: 'customer', createdAt: '2024-01-02T12:00:00Z' },
        ],
        messages: [{ sender: 'customer', body: 'I did not make this transaction', createdAt: '2024-01-01T12:00:00Z' }],
      } as unknown as PaystackDispute;

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Disputes retrieved',
        data: [mockFullDispute],
        meta: { total: 1, total_volume: 50000, skipped: 0, perPage: 50, page: 1, pageCount: 1 },
      });

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      // Should have standard-level fields
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).toHaveProperty('id', 1);
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).toHaveProperty('resolution', null);
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).toHaveProperty(
        'transaction_reference',
        'TXN_REF_123',
      );
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).toHaveProperty('domain', 'live');

      // Should have customer with minimal fields only
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].customer).toMatchObject({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
      });

      // Should have transaction with key fields
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].transaction).toMatchObject({
        id: 1,
        reference: 'TXN_REF_123',
        amount: 50000,
        status: 'success',
        channel: 'card',
      });

      // Should have history array
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].history).toHaveLength(2);

      // Should NOT have customer detailed fields at standard level
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].customer).not.toHaveProperty('phone');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].customer).not.toHaveProperty('first_name');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].customer).not.toHaveProperty('last_name');

      // Should NOT have transaction detailed fields at standard level
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].transaction).not.toHaveProperty(
        'gateway_response',
      );
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0].transaction).not.toHaveProperty('paid_at');

      // Should NOT have detailed-level fields (bin, last4, note, updatedAt, messages)
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).not.toHaveProperty('bin');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).not.toHaveProperty('last4');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).not.toHaveProperty('note');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).not.toHaveProperty('updatedAt');
      expect((result as { disputes: PaystackDispute[] }).disputes?.[0]).not.toHaveProperty('messages');
    });

    it('should handle API errors gracefully', async () => {
      mockPaystackService.get.mockRejectedValueOnce(new Error('API Error'));

      const tool = createGetDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ perPage: 50, page: 1 }, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'API Error',
      });
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
