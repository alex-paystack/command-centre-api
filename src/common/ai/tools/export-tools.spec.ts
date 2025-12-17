/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  createExportTransactionsTool,
  createExportRefundsTool,
  createExportPayoutsTool,
  createExportDisputesTool,
} from './export';
import { PaystackApiService } from '../../services/paystack-api.service';
import { PaystackTransaction, PaystackRefund, PaystackPayout, PaystackDispute, PaystackExportResponse } from '../types';
import { TransactionStatus, RefundStatus, PayoutStatus, DisputeStatusSlug } from '../types/data';

describe('Export Tools', () => {
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

  describe('createExportTransactionsTool', () => {
    it('should export transactions successfully when data exists', async () => {
      const mockTransactions: PaystackTransaction[] = [
        {
          id: 1,
          reference: 'ref123',
          amount: 50000,
          status: TransactionStatus.SUCCESS,
        } as PaystackTransaction,
      ];

      const mockExportResponse: PaystackExportResponse = {};

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: mockExportResponse,
        });

      const tool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ status: TransactionStatus.SUCCESS }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('Transaction export has been queued'),
      });
      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should return error when no transactions found', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'No transactions',
        data: [],
      });

      const tool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'No transactions found for the given filters',
      });
      expect(mockPaystackService.get).toHaveBeenCalledTimes(1);
    });

    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
      expect(mockPaystackService.get).not.toHaveBeenCalled();
    });

    it('should pass correct filters to API', async () => {
      const mockTransactions: PaystackTransaction[] = [
        {
          id: 1,
          reference: 'ref123',
          amount: 50000,
          status: TransactionStatus.SUCCESS,
        } as PaystackTransaction,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: {},
        });

      const tool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          status: TransactionStatus.SUCCESS,
          from: '2024-01-01',
          to: '2024-01-31',
          currency: 'NGN',
        },
        mockToolCallOptions,
      );

      expect(mockPaystackService.get).toHaveBeenNthCalledWith(2, '/transaction/export_by_column', 'test-token', {
        reduced_fields: true,
        status: TransactionStatus.SUCCESS,
        from: '2024-01-01',
        to: '2024-01-31',
        currency: 'NGN',
        destination: 'email',
        user: 'test-user-id',
        columns: expect.any(Array),
      });
    });

    it('should handle API errors gracefully', async () => {
      mockPaystackService.get.mockRejectedValueOnce(new Error('API Error'));

      const tool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'API Error',
      });
    });
  });

  describe('createExportRefundsTool', () => {
    it('should export refunds successfully when data exists', async () => {
      const mockRefunds: PaystackRefund[] = [
        {
          id: 1,
          amount: 50000,
          status: RefundStatus.PROCESSED,
        } as PaystackRefund,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Refunds retrieved',
          data: mockRefunds,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: {},
        });

      const tool = createExportRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ status: RefundStatus.PROCESSED }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('Refund export has been queued'),
      });
      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should return error when no refunds found', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'No refunds',
        data: [],
      });

      const tool = createExportRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'No refunds found for the given filters',
      });
    });

    it('should pass filters correctly to export endpoint', async () => {
      const mockRefunds: PaystackRefund[] = [
        {
          id: 1,
          amount: 50000,
          status: RefundStatus.PROCESSED,
        } as PaystackRefund,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Refunds retrieved',
          data: mockRefunds,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: {},
        });

      const tool = createExportRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          status: RefundStatus.PROCESSED,
          from: '2024-01-01',
          to: '2024-01-31',
          search: 'test',
        },
        mockToolCallOptions,
      );

      expect(mockPaystackService.get).toHaveBeenNthCalledWith(2, '/refund/export', 'test-token', {
        status: RefundStatus.PROCESSED,
        from: '2024-01-01',
        to: '2024-01-31',
        search: 'test',
        destination: 'email',
      });
    });
  });

  describe('createExportPayoutsTool', () => {
    it('should export payouts and return S3 URL successfully', async () => {
      const mockPayouts: PaystackPayout[] = [
        {
          id: 1,
          total_amount: 500000,
          status: PayoutStatus.SUCCESS,
        } as PaystackPayout,
      ];

      const mockExportResponse: PaystackExportResponse = {
        path: 'https://s3.amazonaws.com/bucket/payouts-export.csv',
        expiresAt: '2024-12-18T10:00:00Z',
      };

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Payouts retrieved',
          data: mockPayouts,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export generated',
          data: mockExportResponse,
        });

      const tool = createExportPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ status: PayoutStatus.SUCCESS }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('Payout export has been generated'),
        data: {
          path: 'https://s3.amazonaws.com/bucket/payouts-export.csv',
          expiresAt: '2024-12-18T10:00:00Z',
        },
      });
      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should return error when no payouts found', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'No payouts',
        data: [],
      });

      const tool = createExportPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'No payouts found for the given filters',
      });
    });

    it('should pass model parameter to settlement export endpoint', async () => {
      const mockPayouts: PaystackPayout[] = [
        {
          id: 1,
          total_amount: 500000,
          status: PayoutStatus.SUCCESS,
        } as PaystackPayout,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Payouts retrieved',
          data: mockPayouts,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export generated',
          data: { path: 'https://s3.example.com/file.csv' },
        });

      const tool = createExportPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.({ status: PayoutStatus.SUCCESS }, mockToolCallOptions);

      expect(mockPaystackService.get).toHaveBeenNthCalledWith(2, '/settlement/export', 'test-token', {
        status: PayoutStatus.SUCCESS,
        model: 'settlement',
      });
    });
  });

  describe('createExportDisputesTool', () => {
    it('should export disputes successfully when data exists', async () => {
      const mockDisputes: PaystackDispute[] = [
        {
          id: 1,
          refund_amount: 50000,
          status: DisputeStatusSlug.RESOLVED,
        } as PaystackDispute,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Disputes retrieved',
          data: mockDisputes,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: {},
        });

      const tool = createExportDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({ status: DisputeStatusSlug.RESOLVED }, mockToolCallOptions);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('Dispute export has been queued'),
      });
      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should return error when no disputes found', async () => {
      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'No disputes',
        data: [],
      });

      const tool = createExportDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.({}, mockToolCallOptions);

      expect(result).toMatchObject({
        error: 'No disputes found for the given filters',
      });
    });

    it('should pass filters correctly to export endpoint', async () => {
      const mockDisputes: PaystackDispute[] = [
        {
          id: 1,
          refund_amount: 50000,
          status: DisputeStatusSlug.RESOLVED,
        } as PaystackDispute,
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Disputes retrieved',
          data: mockDisputes,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Export queued',
          data: {},
        });

      const tool = createExportDisputesTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          status: DisputeStatusSlug.RESOLVED,
          from: '2024-01-01',
          to: '2024-01-31',
          transaction: 123,
        },
        mockToolCallOptions,
      );

      expect(mockPaystackService.get).toHaveBeenNthCalledWith(2, '/dispute/export', 'test-token', {
        status: DisputeStatusSlug.RESOLVED,
        from: '2024-01-01',
        to: '2024-01-31',
        transaction: 123,
        destination: 'email',
      });
    });
  });

  describe('Tool Structure', () => {
    it('should have correct structure for all export tools', () => {
      const transactionTool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const refundTool = createExportRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const payoutTool = createExportPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const disputeTool = createExportDisputesTool(mockPaystackService, mockGetAuthenticatedUser);

      [transactionTool, refundTool, payoutTool, disputeTool].forEach((tool) => {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('should have descriptions mentioning export functionality', () => {
      const transactionTool = createExportTransactionsTool(mockPaystackService, mockGetAuthenticatedUser);
      const refundTool = createExportRefundsTool(mockPaystackService, mockGetAuthenticatedUser);
      const payoutTool = createExportPayoutsTool(mockPaystackService, mockGetAuthenticatedUser);
      const disputeTool = createExportDisputesTool(mockPaystackService, mockGetAuthenticatedUser);

      [transactionTool, refundTool, payoutTool, disputeTool].forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description?.toLowerCase()).toContain('export');
      });
    });
  });
});
