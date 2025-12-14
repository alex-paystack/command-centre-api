import {
  aggregateByDay,
  aggregateByHour,
  aggregateByWeek,
  aggregateByMonth,
  aggregateByStatus,
  aggregateTransactions,
  calculateSummary,
  generateChartLabel,
  getChartType,
  AggregationType,
  ChartType,
} from './aggregation';
import type { PaystackCustomer, PaystackTransaction } from './types/index';
import { Authorization, Log, PaymentChannel, TransactionStatus } from './types/data';

describe('Aggregation Functions', () => {
  const createMockTransaction = (
    amount: number,
    createdAt: string,
    status: TransactionStatus = TransactionStatus.SUCCESS,
  ): PaystackTransaction => {
    return {
      id: Math.floor(Math.random() * 10000),
      amount: amount * 100, // Amount in subunits (kobo/cents)
      created_at: createdAt,
      createdAt,
      status,
      channel: PaymentChannel.CARD,
      currency: 'NGN',
      customer: {} as PaystackCustomer,
      authorization: {} as Authorization,
      domain: 'live',
      fees: 150,
      gateway_response: 'Successful',
      ip_address: null,
      log: {} as Log,
      receipt_number: '',
      message: null,
      metadata: { custom_fields: [] },
      paid_at: createdAt,
      paidAt: createdAt,
      reference: 'test-ref',
      requested_amount: amount * 100,
      subaccount: {},
    };
  };

  describe('getChartType', () => {
    it('should return area chart for by-day aggregation', () => {
      expect(getChartType(AggregationType.BY_DAY)).toBe(ChartType.AREA);
    });

    it('should return bar chart for by-hour aggregation', () => {
      expect(getChartType(AggregationType.BY_HOUR)).toBe(ChartType.BAR);
    });

    it('should return area chart for by-week aggregation', () => {
      expect(getChartType(AggregationType.BY_WEEK)).toBe(ChartType.AREA);
    });

    it('should return area chart for by-month aggregation', () => {
      expect(getChartType(AggregationType.BY_MONTH)).toBe(ChartType.AREA);
    });

    it('should return doughnut chart for by-status aggregation', () => {
      expect(getChartType(AggregationType.BY_STATUS)).toBe(ChartType.DOUGHNUT);
    });
  });

  describe('generateChartLabel', () => {
    it('should generate correct labels for each aggregation type', () => {
      expect(generateChartLabel(AggregationType.BY_DAY)).toBe('Daily Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_HOUR)).toBe('Hourly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_WEEK)).toBe('Weekly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_MONTH)).toBe('Monthly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_STATUS)).toBe('Transaction Metrics by Status');
    });

    it('should include date range in label when provided', () => {
      const dateRange = { from: '2024-12-01', to: '2024-12-31' };
      const label = generateChartLabel(AggregationType.BY_DAY, dateRange);
      expect(label).toBe('Daily Transaction Metrics (Dec 1, 2024 - Dec 31, 2024)');
    });

    it('should include only from date when to is not provided', () => {
      const dateRange = { from: '2024-12-01' };
      const label = generateChartLabel(AggregationType.BY_DAY, dateRange);
      expect(label).toBe('Daily Transaction Metrics (from Dec 1, 2024)');
    });

    it('should include only to date when from is not provided', () => {
      const dateRange = { to: '2024-12-31' };
      const label = generateChartLabel(AggregationType.BY_DAY, dateRange);
      expect(label).toBe('Daily Transaction Metrics (until Dec 31, 2024)');
    });
  });

  describe('aggregateByDay', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByDay([]);
      expect(result).toEqual([]);
    });

    it('should aggregate single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = aggregateByDay(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 1,
        volume: 1000,
        average: 1000,
      });
    });

    it('should aggregate multiple transactions on the same day', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-12-10T14:30:00Z'),
        createMockTransaction(1500, '2024-12-10T18:30:00Z'),
      ];
      const result = aggregateByDay(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 3,
        volume: 4500,
        average: 1500,
      });
    });

    it('should aggregate transactions across multiple days', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-12-11T10:30:00Z'),
        createMockTransaction(3000, '2024-12-12T10:30:00Z'),
      ];
      const result = aggregateByDay(transactions);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 1,
        volume: 1000,
        average: 1000,
      });
      expect(result[1]).toEqual({
        name: 'Wednesday, Dec 11',
        count: 1,
        volume: 2000,
        average: 2000,
      });
      expect(result[2]).toEqual({
        name: 'Thursday, Dec 12',
        count: 1,
        volume: 3000,
        average: 3000,
      });
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-12T10:30:00Z'),
        createMockTransaction(2000, '2024-12-10T10:30:00Z'),
        createMockTransaction(3000, '2024-12-11T10:30:00Z'),
      ];
      const result = aggregateByDay(transactions);

      expect(result[0].name).toBe('Tuesday, Dec 10');
      expect(result[1].name).toBe('Wednesday, Dec 11');
      expect(result[2].name).toBe('Thursday, Dec 12');
    });
  });

  describe('aggregateByHour', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByHour([]);
      expect(result).toEqual([]);
    });

    it('should aggregate single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = aggregateByHour(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: '10:00',
        count: 1,
        volume: 1000,
        average: 1000,
      });
    });

    it('should aggregate multiple transactions in the same hour', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:15:00Z'),
        createMockTransaction(2000, '2024-12-10T10:30:00Z'),
        createMockTransaction(1500, '2024-12-10T10:45:00Z'),
      ];
      const result = aggregateByHour(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: '10:00',
        count: 3,
        volume: 4500,
        average: 1500,
      });
    });

    it('should aggregate transactions across multiple hours', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T08:30:00Z'),
        createMockTransaction(2000, '2024-12-10T14:30:00Z'),
        createMockTransaction(3000, '2024-12-10T20:30:00Z'),
      ];
      const result = aggregateByHour(transactions);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: '08:00',
        count: 1,
        volume: 1000,
        average: 1000,
      });
      expect(result[1]).toEqual({
        name: '14:00',
        count: 1,
        volume: 2000,
        average: 2000,
      });
      expect(result[2]).toEqual({
        name: '20:00',
        count: 1,
        volume: 3000,
        average: 3000,
      });
    });

    it('should sort results by hour', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T20:30:00Z'),
        createMockTransaction(2000, '2024-12-10T08:30:00Z'),
        createMockTransaction(3000, '2024-12-10T14:30:00Z'),
      ];
      const result = aggregateByHour(transactions);

      expect(result[0].name).toBe('08:00');
      expect(result[1].name).toBe('14:00');
      expect(result[2].name).toBe('20:00');
    });
  });

  describe('aggregateByWeek', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByWeek([]);
      expect(result).toEqual([]);
    });

    it('should aggregate single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].name).toMatch(/2024-W\d{2}/);
      expect(result[0].count).toBe(1);
      expect(result[0].volume).toBe(1000);
      expect(result[0].average).toBe(1000);
    });

    it('should aggregate multiple transactions in the same week', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-09T10:30:00Z'), // Monday
        createMockTransaction(2000, '2024-12-11T10:30:00Z'), // Wednesday
        createMockTransaction(1500, '2024-12-13T10:30:00Z'), // Friday
      ];
      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(3);
      expect(result[0].volume).toBe(4500);
      expect(result[0].average).toBe(1500);
    });

    it('should aggregate transactions across multiple weeks', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-02T10:30:00Z'),
        createMockTransaction(2000, '2024-12-09T10:30:00Z'),
        createMockTransaction(3000, '2024-12-16T10:30:00Z'),
      ];
      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(3);
      expect(result[0].count).toBe(1);
      expect(result[1].count).toBe(1);
      expect(result[2].count).toBe(1);
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-16T10:30:00Z'),
        createMockTransaction(2000, '2024-12-02T10:30:00Z'),
        createMockTransaction(3000, '2024-12-09T10:30:00Z'),
      ];
      const result = aggregateByWeek(transactions);

      // Should be sorted by week string (YYYY-Www format)
      expect(result[0].name < result[1].name).toBe(true);
      expect(result[1].name < result[2].name).toBe(true);
    });
  });

  describe('aggregateByMonth', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByMonth([]);
      expect(result).toEqual([]);
    });

    it('should aggregate single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = aggregateByMonth(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: '2024-12',
        count: 1,
        volume: 1000,
        average: 1000,
      });
    });

    it('should aggregate multiple transactions in the same month', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-01T10:30:00Z'),
        createMockTransaction(2000, '2024-12-15T10:30:00Z'),
        createMockTransaction(1500, '2024-12-30T10:30:00Z'),
      ];
      const result = aggregateByMonth(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: '2024-12',
        count: 3,
        volume: 4500,
        average: 1500,
      });
    });

    it('should aggregate transactions across multiple months', () => {
      const transactions = [
        createMockTransaction(1000, '2024-10-10T10:30:00Z'),
        createMockTransaction(2000, '2024-11-10T10:30:00Z'),
        createMockTransaction(3000, '2024-12-10T10:30:00Z'),
      ];
      const result = aggregateByMonth(transactions);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: '2024-10',
        count: 1,
        volume: 1000,
        average: 1000,
      });
      expect(result[1]).toEqual({
        name: '2024-11',
        count: 1,
        volume: 2000,
        average: 2000,
      });
      expect(result[2]).toEqual({
        name: '2024-12',
        count: 1,
        volume: 3000,
        average: 3000,
      });
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-10-10T10:30:00Z'),
        createMockTransaction(3000, '2024-11-10T10:30:00Z'),
      ];
      const result = aggregateByMonth(transactions);

      expect(result[0].name).toBe('2024-10');
      expect(result[1].name).toBe('2024-11');
      expect(result[2].name).toBe('2024-12');
    });
  });

  describe('aggregateByStatus', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByStatus([]);
      expect(result).toEqual([]);
    });

    it('should aggregate single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z', TransactionStatus.SUCCESS)];
      const result = aggregateByStatus(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'success',
        count: 1,
        volume: 1000,
        average: 1000,
      });
    });

    it('should aggregate multiple transactions with the same status', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z', TransactionStatus.SUCCESS),
        createMockTransaction(2000, '2024-12-11T10:30:00Z', TransactionStatus.SUCCESS),
        createMockTransaction(1500, '2024-12-12T10:30:00Z', TransactionStatus.SUCCESS),
      ];
      const result = aggregateByStatus(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'success',
        count: 3,
        volume: 4500,
        average: 1500,
      });
    });

    it('should aggregate transactions across multiple statuses', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z', TransactionStatus.SUCCESS),
        createMockTransaction(2000, '2024-12-10T10:30:00Z', TransactionStatus.FAILED),
        createMockTransaction(3000, '2024-12-10T10:30:00Z', TransactionStatus.ABANDONED),
      ];
      const result = aggregateByStatus(transactions);

      expect(result).toHaveLength(3);

      const successData = result.find((d) => d.name === 'success');
      const failedData = result.find((d) => d.name === 'failed');
      const abandonedData = result.find((d) => d.name === 'abandoned');

      expect(successData).toEqual({
        name: 'success',
        count: 1,
        volume: 1000,
        average: 1000,
      });
      expect(failedData).toEqual({
        name: 'failed',
        count: 1,
        volume: 2000,
        average: 2000,
      });
      expect(abandonedData).toEqual({
        name: 'abandoned',
        count: 1,
        volume: 3000,
        average: 3000,
      });
    });

    it('should sort results by status name', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z', TransactionStatus.SUCCESS),
        createMockTransaction(2000, '2024-12-10T10:30:00Z', TransactionStatus.ABANDONED),
        createMockTransaction(3000, '2024-12-10T10:30:00Z', TransactionStatus.FAILED),
      ];
      const result = aggregateByStatus(transactions);

      // Sorted alphabetically: abandoned, failed, success
      expect(result[0].name).toBe('abandoned');
      expect(result[1].name).toBe('failed');
      expect(result[2].name).toBe('success');
    });
  });

  describe('aggregateTransactions', () => {
    const transactions = [
      createMockTransaction(1000, '2024-12-10T10:30:00Z', TransactionStatus.SUCCESS),
      createMockTransaction(2000, '2024-12-11T10:30:00Z', TransactionStatus.FAILED),
    ];

    it('should route to aggregateByDay for by-day type', () => {
      const result = aggregateTransactions(transactions, AggregationType.BY_DAY);
      expect(result).toHaveLength(2);
      expect(result[0].name).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), \w+ \d+$/);
    });

    it('should route to aggregateByHour for by-hour type', () => {
      const result = aggregateTransactions(transactions, AggregationType.BY_HOUR);
      expect(result).toHaveLength(1);
      expect(result[0].name).toMatch(/\d{2}:\d{2}/);
    });

    it('should route to aggregateByWeek for by-week type', () => {
      const result = aggregateTransactions(transactions, AggregationType.BY_WEEK);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toMatch(/2024-W\d{2}/);
    });

    it('should route to aggregateByMonth for by-month type', () => {
      const result = aggregateTransactions(transactions, AggregationType.BY_MONTH);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('2024-12');
    });

    it('should route to aggregateByStatus for by-status type', () => {
      const result = aggregateTransactions(transactions, AggregationType.BY_STATUS);
      expect(result).toHaveLength(2);
      expect(result.some((d) => d.name === 'success')).toBe(true);
      expect(result.some((d) => d.name === 'failed')).toBe(true);
    });

    it('should throw error for unknown aggregation type', () => {
      expect(() => {
        aggregateTransactions(transactions, 'unknown' as AggregationType);
      }).toThrow('Unknown aggregation type: unknown');
    });
  });

  describe('calculateSummary', () => {
    it('should return zeros for empty transactions', () => {
      const result = calculateSummary([]);
      expect(result).toEqual({
        totalCount: 0,
        totalVolume: 0,
        overallAverage: 0,
      });
    });

    it('should calculate summary for single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = calculateSummary(transactions);

      expect(result).toEqual({
        totalCount: 1,
        totalVolume: 1000,
        overallAverage: 1000,
      });
    });

    it('should calculate summary for multiple transactions', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-12-11T10:30:00Z'),
        createMockTransaction(3000, '2024-12-12T10:30:00Z'),
      ];
      const result = calculateSummary(transactions);

      expect(result).toEqual({
        totalCount: 3,
        totalVolume: 6000,
        overallAverage: 2000,
      });
    });

    it('should round values to 2 decimal places', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(1500, '2024-12-11T10:30:00Z'),
        createMockTransaction(2000, '2024-12-12T10:30:00Z'),
      ];
      const result = calculateSummary(transactions);

      expect(result.totalCount).toBe(3);
      expect(result.totalVolume).toBe(4500);
      expect(result.overallAverage).toBe(1500);
    });

    it('should include date range in summary when provided', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-12-11T10:30:00Z'),
      ];
      const dateRange = { from: '2024-12-01', to: '2024-12-31' };
      const result = calculateSummary(transactions, dateRange);

      expect(result.totalCount).toBe(2);
      expect(result.totalVolume).toBe(3000);
      expect(result.overallAverage).toBe(1500);
      expect(result.dateRange).toEqual({
        from: 'Dec 1, 2024',
        to: 'Dec 31, 2024',
      });
    });

    it('should not include date range when not provided', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = calculateSummary(transactions);

      expect(result.dateRange).toBeUndefined();
    });
  });
});
