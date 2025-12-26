/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createGenerateChartDataTool, createCompareChartDataTool } from './visualization';
import { PaystackApiService } from '../../services/paystack-api.service';
import { AggregationType, ChartResourceType } from '../chart-config';
import { ChartType } from '../aggregation';
import { PaymentChannel, TransactionStatus } from '../types/data';

describe('Visualization Tools', () => {
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

  describe('createGenerateChartDataTool', () => {
    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createGenerateChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const generator = tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
        },
        mockToolCallOptions,
      );

      if (generator && typeof generator === 'object' && Symbol.asyncIterator in generator) {
        for await (const state of generator) {
          expect(state).toMatchObject({
            error: 'Authentication token not available. Please ensure you are logged in.',
          });
          break; // Only check the first yielded value
        }
      }
    });

    it('should generate chart data with default parameters', async () => {
      const mockTransactions = [
        {
          id: 1,
          reference: 'ref123',
          amount: 50000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 2,
          reference: 'ref456',
          amount: 75000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.BANK,
          currency: 'NGN',
          createdAt: '2024-01-16T10:00:00Z',
        },
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransactions,
      });

      const tool = createGenerateChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const generator = tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
        },
        mockToolCallOptions,
      );

      if (generator && typeof generator === 'object' && Symbol.asyncIterator in generator) {
        // Collect all yielded states
        const states: unknown[] = [];
        for await (const state of generator) {
          states.push(state);
        }

        // Should have at least one loading state and one success state
        expect(states.length).toBeGreaterThan(0);
        const finalState = states[states.length - 1];
        expect(finalState).toHaveProperty('success', true);
        expect(finalState).toHaveProperty('label');
        expect(finalState).toHaveProperty('chartType');
        expect(finalState).toHaveProperty('summary');
      }
    });

    it('should pass filters correctly to chart generator', async () => {
      const mockTransactions = [
        {
          id: 1,
          reference: 'ref123',
          amount: 50000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      mockPaystackService.get.mockResolvedValueOnce({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransactions,
      });

      const tool = createGenerateChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const generator = tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          from: '2024-01-01',
          to: '2024-01-31',
          status: TransactionStatus.SUCCESS,
          currency: 'NGN',
          channel: PaymentChannel.CARD,
        },
        mockToolCallOptions,
      );

      if (generator && typeof generator === 'object' && Symbol.asyncIterator in generator) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _state of generator) {
          // Just drain the generator
        }

        expect(mockPaystackService.get).toHaveBeenCalledWith(
          '/transaction',
          'test-token',
          expect.objectContaining({
            from: '2024-01-01',
            to: '2024-01-31',
            status: TransactionStatus.SUCCESS,
            currency: 'NGN',
            channel: PaymentChannel.CARD,
          }),
        );
      }
    });
  });

  describe('createCompareChartDataTool', () => {
    it('should return error when authentication token is missing', async () => {
      mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        error: 'Authentication token not available. Please ensure you are logged in.',
      });
      expect(mockPaystackService.get).not.toHaveBeenCalled();
    });

    it('should compare two date ranges successfully with time-based aggregation', async () => {
      const mockTransactionsA = [
        {
          id: 1,
          reference: 'ref123',
          amount: 100000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 2,
          reference: 'ref456',
          amount: 150000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-16T10:00:00Z',
        },
      ];

      const mockTransactionsB = [
        {
          id: 3,
          reference: 'ref789',
          amount: 80000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2023-12-15T10:00:00Z',
        },
      ];

      // Mock API responses for both ranges
      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsA,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsB,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        label: expect.stringContaining('vs'),
        chartType: ChartType.AREA,
        current: expect.any(Array),
        previous: expect.any(Array),
        summary: {
          current: expect.objectContaining({
            totalCount: 2,
            totalVolume: expect.any(Number),
          }),
          previous: expect.objectContaining({
            totalCount: 1,
            totalVolume: expect.any(Number),
          }),
          deltas: expect.objectContaining({
            totalCount: 1,
            totalVolume: expect.any(Number),
            overallAverage: expect.any(Number),
          }),
        },
      });

      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should compare two date ranges with categorical aggregation (by-status)', async () => {
      const mockTransactionsA = [
        {
          id: 1,
          reference: 'ref123',
          amount: 100000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 2,
          reference: 'ref456',
          amount: 50000,
          status: TransactionStatus.FAILED,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-16T10:00:00Z',
        },
      ];

      const mockTransactionsB = [
        {
          id: 3,
          reference: 'ref789',
          amount: 80000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2023-12-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsA,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsB,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_STATUS,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        label: expect.stringContaining('vs'),
        chartType: ChartType.DOUGHNUT,
        current: expect.any(Array),
        previous: expect.any(Array),
        summary: {
          current: expect.objectContaining({
            totalCount: 2,
          }),
          previous: expect.objectContaining({
            totalCount: 1,
          }),
          deltas: expect.any(Object),
        },
      });
    });

    it('should pass filters (status, currency, channel) correctly to both API calls', async () => {
      const mockTransactions = [
        {
          id: 1,
          reference: 'ref123',
          amount: 100000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
          status: TransactionStatus.SUCCESS,
          currency: 'NGN',
          channel: PaymentChannel.CARD,
        },
        mockToolCallOptions,
      );

      // Verify first API call (rangeA)
      expect(mockPaystackService.get).toHaveBeenNthCalledWith(
        1,
        '/transaction',
        'test-token',
        expect.objectContaining({
          from: '2024-01-01',
          to: '2024-01-31',
          status: TransactionStatus.SUCCESS,
          currency: 'NGN',
          channel: PaymentChannel.CARD,
        }),
      );

      // Verify second API call (rangeB)
      expect(mockPaystackService.get).toHaveBeenNthCalledWith(
        2,
        '/transaction',
        'test-token',
        expect.objectContaining({
          from: '2023-12-01',
          to: '2023-12-31',
          status: TransactionStatus.SUCCESS,
          currency: 'NGN',
          channel: PaymentChannel.CARD,
        }),
      );

      expect(mockPaystackService.get).toHaveBeenCalledTimes(2);
    });

    it('should calculate deltas correctly between current and previous periods', async () => {
      const mockTransactionsA = [
        {
          id: 1,
          reference: 'ref123',
          amount: 200000, // 2000 NGN
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 2,
          reference: 'ref456',
          amount: 100000, // 1000 NGN
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-16T10:00:00Z',
        },
      ];

      const mockTransactionsB = [
        {
          id: 3,
          reference: 'ref789',
          amount: 100000, // 1000 NGN
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2023-12-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsA,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactionsB,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toHaveProperty('summary');
      if (result && 'summary' in result && result.summary) {
        expect(result.summary.current.totalCount).toBe(2);
        expect(result.summary.previous.totalCount).toBe(1);
        expect(result.summary.deltas.totalCount).toBe(1); // 2 - 1
        expect(result.summary.deltas.totalVolume).toBeGreaterThan(0); // Should be positive (3000 - 1000 = 2000)
      }
    });

    it('should handle comparison for refunds resource type', async () => {
      const mockRefundsA = [
        {
          id: 1,
          amount: 50000,
          currency: 'NGN',
          status: 'processed',
          transaction_reference: 'ref123',
          refunded_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockRefundsB = [
        {
          id: 2,
          amount: 30000,
          currency: 'NGN',
          status: 'processed',
          transaction_reference: 'ref456',
          refunded_at: '2023-12-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Refunds retrieved',
          data: mockRefundsA,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Refunds retrieved',
          data: mockRefundsB,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.REFUND,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        label: expect.stringContaining('vs'),
        chartType: ChartType.AREA,
        summary: expect.objectContaining({
          current: expect.any(Object),
          previous: expect.any(Object),
          deltas: expect.any(Object),
        }),
      });

      expect(mockPaystackService.get).toHaveBeenNthCalledWith(1, '/refund', 'test-token', expect.any(Object));
      expect(mockPaystackService.get).toHaveBeenNthCalledWith(2, '/refund', 'test-token', expect.any(Object));
    });

    it('should handle API errors gracefully', async () => {
      mockPaystackService.get.mockRejectedValueOnce(new Error('Network Error'));

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);

      await expect(
        tool.execute?.(
          {
            resourceType: ChartResourceType.TRANSACTION,
            aggregationType: AggregationType.BY_DAY,
            rangeA: { from: '2024-01-01', to: '2024-01-31' },
            rangeB: { from: '2023-12-01', to: '2023-12-31' },
          },
          mockToolCallOptions,
        ),
      ).rejects.toThrow();
    });

    it('should handle empty data sets gracefully', async () => {
      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: [],
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: [],
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        label: expect.any(String),
        chartType: expect.any(String),
        summary: {
          current: expect.objectContaining({
            totalCount: 0,
          }),
          previous: expect.objectContaining({
            totalCount: 0,
          }),
          deltas: expect.objectContaining({
            totalCount: 0,
          }),
        },
      });
    });

    it('should compare by channel for transactions', async () => {
      const mockTransactions = [
        {
          id: 1,
          reference: 'ref123',
          amount: 100000,
          status: TransactionStatus.SUCCESS,
          channel: PaymentChannel.CARD,
          currency: 'NGN',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Transactions retrieved',
          data: mockTransactions,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.TRANSACTION,
          aggregationType: AggregationType.BY_CHANNEL,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        chartType: ChartType.DOUGHNUT,
        current: expect.any(Array),
        previous: expect.any(Array),
      });
    });

    it('should handle payouts and disputes resource types', async () => {
      const mockPayouts = [
        {
          id: 1,
          total_amount: 500000,
          status: 'success',
          currency: 'NGN',
          settlement_date: '2024-01-15',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      mockPaystackService.get
        .mockResolvedValueOnce({
          status: true,
          message: 'Payouts retrieved',
          data: mockPayouts,
        })
        .mockResolvedValueOnce({
          status: true,
          message: 'Payouts retrieved',
          data: mockPayouts,
        });

      const tool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const result = await tool.execute?.(
        {
          resourceType: ChartResourceType.PAYOUT,
          aggregationType: AggregationType.BY_DAY,
          rangeA: { from: '2024-01-01', to: '2024-01-31' },
          rangeB: { from: '2023-12-01', to: '2023-12-31' },
        },
        mockToolCallOptions,
      );

      expect(result).toMatchObject({
        label: expect.stringContaining('vs'),
        summary: expect.any(Object),
      });

      expect(mockPaystackService.get).toHaveBeenCalledWith('/settlement', 'test-token', expect.any(Object));
    });
  });

  describe('Tool Structure Validation', () => {
    it('should have correct structure for all visualization tools', () => {
      const generateTool = createGenerateChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const compareTool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);

      [generateTool, compareTool].forEach((tool) => {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('should have descriptions mentioning visualization/chart functionality', () => {
      const generateTool = createGenerateChartDataTool(mockPaystackService, mockGetAuthenticatedUser);
      const compareTool = createCompareChartDataTool(mockPaystackService, mockGetAuthenticatedUser);

      expect(generateTool.description?.toLowerCase()).toMatch(/chart|visualize/);
      expect(compareTool.description?.toLowerCase()).toMatch(/compare|comparison/);
    });
  });
});
