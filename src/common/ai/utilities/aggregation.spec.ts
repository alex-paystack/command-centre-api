import {
  aggregateByDay,
  aggregateByHour,
  aggregateByWeek,
  aggregateByMonth,
  aggregateByStatus,
  aggregateByChannel,
  aggregateByType,
  aggregateByCategory,
  aggregateByResolution,
  aggregateByKey,
  aggregateRecords,
  calculateSummary,
  generateChartLabel,
  getChartType,
  ChartType,
} from './aggregation';
import {
  AggregationType,
  ChartResourceType,
  toChartableRecords,
  refundFieldConfig,
  disputeFieldConfig,
} from './chart-config';
import type { ChartableRecord } from './chart-config';
import type { PaystackCustomer, PaystackTransaction, PaystackRefund, PaystackDispute } from '../types/index';
import {
  Authorization,
  Log,
  PaymentChannel,
  TransactionStatus,
  RefundStatus,
  RefundType,
  DisputeCategory,
  DisputeStatusSlug,
  Currency,
  DisputeResolutionSlug,
} from '../types/data';

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

    it('should return doughnut chart for by-channel aggregation', () => {
      expect(getChartType(AggregationType.BY_CHANNEL)).toBe(ChartType.DOUGHNUT);
    });

    it('should return doughnut chart for by-type aggregation', () => {
      expect(getChartType(AggregationType.BY_TYPE)).toBe(ChartType.DOUGHNUT);
    });

    it('should return doughnut chart for by-category aggregation', () => {
      expect(getChartType(AggregationType.BY_CATEGORY)).toBe(ChartType.DOUGHNUT);
    });

    it('should return doughnut chart for by-resolution aggregation', () => {
      expect(getChartType(AggregationType.BY_RESOLUTION)).toBe(ChartType.DOUGHNUT);
    });
  });

  describe('generateChartLabel', () => {
    it('should generate correct labels for each aggregation type (default: transaction)', () => {
      expect(generateChartLabel(AggregationType.BY_DAY)).toBe('Daily Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_HOUR)).toBe('Hourly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_WEEK)).toBe('Weekly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_MONTH)).toBe('Monthly Transaction Metrics');
      expect(generateChartLabel(AggregationType.BY_STATUS)).toBe('Transaction Metrics by Status');
      expect(generateChartLabel(AggregationType.BY_CHANNEL)).toBe('Transaction Metrics by Channel');
    });

    it('should generate correct labels for refund resource type', () => {
      expect(generateChartLabel(AggregationType.BY_DAY, ChartResourceType.REFUND)).toBe('Daily Refund Metrics');
      expect(generateChartLabel(AggregationType.BY_STATUS, ChartResourceType.REFUND)).toBe('Refund Metrics by Status');
      expect(generateChartLabel(AggregationType.BY_TYPE, ChartResourceType.REFUND)).toBe('Refund Metrics by Type');
    });

    it('should generate correct labels for payout resource type', () => {
      expect(generateChartLabel(AggregationType.BY_DAY, ChartResourceType.PAYOUT)).toBe('Daily Payout Metrics');
      expect(generateChartLabel(AggregationType.BY_STATUS, ChartResourceType.PAYOUT)).toBe('Payout Metrics by Status');
    });

    it('should generate correct labels for dispute resource type', () => {
      expect(generateChartLabel(AggregationType.BY_DAY, ChartResourceType.DISPUTE)).toBe('Daily Dispute Metrics');
      expect(generateChartLabel(AggregationType.BY_CATEGORY, ChartResourceType.DISPUTE)).toBe(
        'Dispute Metrics by Category',
      );
      expect(generateChartLabel(AggregationType.BY_RESOLUTION, ChartResourceType.DISPUTE)).toBe(
        'Dispute Metrics by Resolution',
      );
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
      expect(result[0].currency).toBe('NGN');
      expect(result[0].points).toHaveLength(1);
      expect(result[0].points[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
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
      expect(result[0].points).toHaveLength(1);
      expect(result[0].points[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 3,
        volume: 4500,
        average: 1500,
        currency: 'NGN',
      });
    });

    it('should aggregate transactions across multiple days', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-12-11T10:30:00Z'),
        createMockTransaction(3000, '2024-12-12T10:30:00Z'),
      ];
      const result = aggregateByDay(transactions);

      expect(result).toHaveLength(1);
      const points = result[0].points;
      expect(points).toHaveLength(3);
      expect(points[0]).toEqual({
        name: 'Tuesday, Dec 10',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
      });
      expect(points[1]).toEqual({
        name: 'Wednesday, Dec 11',
        count: 1,
        volume: 2000,
        average: 2000,
        currency: 'NGN',
      });
      expect(points[2]).toEqual({
        name: 'Thursday, Dec 12',
        count: 1,
        volume: 3000,
        average: 3000,
        currency: 'NGN',
      });
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-12T10:30:00Z'),
        createMockTransaction(2000, '2024-12-10T10:30:00Z'),
        createMockTransaction(3000, '2024-12-11T10:30:00Z'),
      ];
      const result = aggregateByDay(transactions);

      const points = result[0].points;
      expect(points[0].name).toBe('Tuesday, Dec 10');
      expect(points[1].name).toBe('Wednesday, Dec 11');
      expect(points[2].name).toBe('Thursday, Dec 12');
    });

    it('should bucket days using UTC to avoid local timezone shifts', () => {
      // 23:30 UTC on Dec 10 should remain Dec 10 regardless of local timezone
      const transactions = [createMockTransaction(1000, '2024-12-10T23:30:00Z')];
      const result = aggregateByDay(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].points[0].name).toBe('Tuesday, Dec 10');
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
      expect(result[0].points[0]).toEqual({
        name: '10:00',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
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
      expect(result[0].points[0]).toEqual({
        name: '10:00',
        count: 3,
        volume: 4500,
        average: 1500,
        currency: 'NGN',
      });
    });

    it('should aggregate transactions across multiple hours', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T08:30:00Z'),
        createMockTransaction(2000, '2024-12-10T14:30:00Z'),
        createMockTransaction(3000, '2024-12-10T20:30:00Z'),
      ];
      const result = aggregateByHour(transactions);

      expect(result).toHaveLength(1);
      const points = result[0].points;
      expect(points).toHaveLength(3);
      expect(points[0]).toEqual({
        name: '08:00',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
      });
      expect(points[1]).toEqual({
        name: '14:00',
        count: 1,
        volume: 2000,
        average: 2000,
        currency: 'NGN',
      });
      expect(points[2]).toEqual({
        name: '20:00',
        count: 1,
        volume: 3000,
        average: 3000,
        currency: 'NGN',
      });
    });

    it('should sort results by hour', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T20:30:00Z'),
        createMockTransaction(2000, '2024-12-10T08:30:00Z'),
        createMockTransaction(3000, '2024-12-10T14:30:00Z'),
      ];
      const result = aggregateByHour(transactions);

      const points = result[0].points;
      expect(points[0].name).toBe('08:00');
      expect(points[1].name).toBe('14:00');
      expect(points[2].name).toBe('20:00');
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
      const point = result[0].points[0];
      expect(point.name).toMatch(/2024-W\d{2}/);
      expect(point.count).toBe(1);
      expect(point.volume).toBe(1000);
      expect(point.average).toBe(1000);
      expect(point.currency).toBe('NGN');
    });

    it('should aggregate multiple transactions in the same week', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-09T10:30:00Z'), // Monday
        createMockTransaction(2000, '2024-12-11T10:30:00Z'), // Wednesday
        createMockTransaction(1500, '2024-12-13T10:30:00Z'), // Friday
      ];
      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(1);
      const point = result[0].points[0];
      expect(point.count).toBe(3);
      expect(point.volume).toBe(4500);
      expect(point.average).toBe(1500);
      expect(point.currency).toBe('NGN');
    });

    it('should aggregate transactions across multiple weeks', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-02T10:30:00Z'),
        createMockTransaction(2000, '2024-12-09T10:30:00Z'),
        createMockTransaction(3000, '2024-12-16T10:30:00Z'),
      ];
      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(1);
      const points = result[0].points;
      expect(points).toHaveLength(3);
      expect(points[0].count).toBe(1);
      expect(points[1].count).toBe(1);
      expect(points[2].count).toBe(1);
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-16T10:30:00Z'),
        createMockTransaction(2000, '2024-12-02T10:30:00Z'),
        createMockTransaction(3000, '2024-12-09T10:30:00Z'),
      ];
      const result = aggregateByWeek(transactions);

      // Should be sorted by week string (YYYY-Www format)
      const points = result[0].points;
      expect(points[0].name < points[1].name).toBe(true);
      expect(points[1].name < points[2].name).toBe(true);
    });

    it('should use ISO week-year for year boundaries', () => {
      const transactions = [
        // Dec 31, 2024 is ISO week 01 of 2025
        createMockTransaction(1000, '2024-12-31T12:00:00Z'),
      ];

      const result = aggregateByWeek(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].points[0].name).toBe('2025-W01');
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
      expect(result[0].points[0]).toEqual({
        name: '2024-12',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
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
      expect(result[0].points[0]).toEqual({
        name: '2024-12',
        count: 3,
        volume: 4500,
        average: 1500,
        currency: 'NGN',
      });
    });

    it('should aggregate transactions across multiple months', () => {
      const transactions = [
        createMockTransaction(1000, '2024-10-10T10:30:00Z'),
        createMockTransaction(2000, '2024-11-10T10:30:00Z'),
        createMockTransaction(3000, '2024-12-10T10:30:00Z'),
      ];
      const result = aggregateByMonth(transactions);

      expect(result).toHaveLength(1);
      const points = result[0].points;
      expect(points).toHaveLength(3);
      expect(points[0]).toEqual({
        name: '2024-10',
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
      });
      expect(points[1]).toEqual({
        name: '2024-11',
        count: 1,
        volume: 2000,
        average: 2000,
        currency: 'NGN',
      });
      expect(points[2]).toEqual({
        name: '2024-12',
        count: 1,
        volume: 3000,
        average: 3000,
        currency: 'NGN',
      });
    });

    it('should sort results chronologically', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        createMockTransaction(2000, '2024-10-10T10:30:00Z'),
        createMockTransaction(3000, '2024-11-10T10:30:00Z'),
      ];
      const result = aggregateByMonth(transactions);

      const points = result[0].points;
      expect(points[0].name).toBe('2024-10');
      expect(points[1].name).toBe('2024-11');
      expect(points[2].name).toBe('2024-12');
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
        currency: 'NGN',
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
        currency: 'NGN',
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
        currency: 'NGN',
      });
      expect(failedData).toEqual({
        name: 'failed',
        count: 1,
        volume: 2000,
        average: 2000,
        currency: 'NGN',
      });
      expect(abandonedData).toEqual({
        name: 'abandoned',
        count: 1,
        volume: 3000,
        average: 3000,
        currency: 'NGN',
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

  describe('aggregateByChannel', () => {
    it('should return empty array for empty transactions', () => {
      const result = aggregateByChannel([]);
      expect(result).toEqual([]);
    });

    it('should aggregate transactions by channel', () => {
      const cardTransaction = createMockTransaction(1000, '2024-12-10T10:30:00Z');
      const bankTransaction = { ...createMockTransaction(2000, '2024-12-11T10:30:00Z'), channel: PaymentChannel.BANK };
      const ussdTransaction = { ...createMockTransaction(3000, '2024-12-12T10:30:00Z'), channel: PaymentChannel.USSD };

      const result = aggregateByChannel([cardTransaction, bankTransaction, ussdTransaction]);

      expect(result).toHaveLength(3);
      expect(result.find((d) => d.name === PaymentChannel.CARD.toString())).toMatchObject({
        name: PaymentChannel.CARD,
        count: 1,
        volume: 1000,
        average: 1000,
        currency: 'NGN',
      });
      expect(result.find((d) => d.name === PaymentChannel.BANK.toString())).toMatchObject({
        name: PaymentChannel.BANK,
        count: 1,
        volume: 2000,
        average: 2000,
        currency: 'NGN',
      });
      expect(result.find((d) => d.name === PaymentChannel.USSD.toString())).toMatchObject({
        name: PaymentChannel.USSD,
        count: 1,
        volume: 3000,
        average: 3000,
        currency: 'NGN',
      });
    });

    it('should sort channels alphabetically', () => {
      const cardTransaction = createMockTransaction(1000, '2024-12-10T10:30:00Z');
      const bankTransaction = { ...createMockTransaction(2000, '2024-12-11T10:30:00Z'), channel: PaymentChannel.BANK };

      const result = aggregateByChannel([cardTransaction, bankTransaction]);

      expect(result.map((r) => r.name)).toEqual([PaymentChannel.BANK, PaymentChannel.CARD]);
    });
  });

  describe('aggregateByKey', () => {
    const baseRecord = {
      amount: 1000,
      createdAt: '2024-12-10T10:30:00Z',
      status: 'ok',
    } as const;

    it('returns empty array for empty input', () => {
      expect(aggregateByKey([], (r) => r.status)).toEqual([]);
    });

    it('groups by selector and sums metrics per currency', () => {
      const records: ChartableRecord[] = [
        { ...baseRecord, currency: 'NGN', status: 'a' },
        { ...baseRecord, currency: 'NGN', status: 'a' },
        { ...baseRecord, currency: 'USD', status: 'a' },
      ];

      const result = aggregateByKey(records, (r) => r.status);

      const ngn = result.find((d) => d.currency === 'NGN');
      const usd = result.find((d) => d.currency === 'USD');

      expect(ngn).toEqual({
        name: 'a',
        currency: 'NGN',
        count: 2,
        volume: 20,
        average: 10,
      });
      expect(usd).toEqual({
        name: 'a',
        currency: 'USD',
        count: 1,
        volume: 10,
        average: 10,
      });
    });

    it('falls back to unknownLabel when selector returns null/undefined', () => {
      const records: ChartableRecord[] = [{ ...baseRecord, currency: 'NGN', status: null as unknown as string }];

      const result = aggregateByKey(records, (r) => r.status, { unknownLabel: 'unresolved' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('unresolved');
    });

    it('applies custom sortKeys comparator', () => {
      const records: ChartableRecord[] = [
        { ...baseRecord, currency: 'NGN', status: 'b' },
        { ...baseRecord, currency: 'NGN', status: 'a' },
      ];

      const result = aggregateByKey(records, (r) => r.status, {
        sortKeys: (a, b) => ['b', 'a'].indexOf(a) - ['b', 'a'].indexOf(b),
      });

      expect(result.map((r) => r.name)).toEqual(['b', 'a']);
    });
  });

  describe('calculateSummary', () => {
    it('should return zeros for empty transactions', () => {
      const result = calculateSummary([]);
      expect(result).toEqual({
        totalCount: 0,
        totalVolume: 0,
        overallAverage: 0,
        perCurrency: [],
      });
    });

    it('should calculate summary for single transaction', () => {
      const transactions = [createMockTransaction(1000, '2024-12-10T10:30:00Z')];
      const result = calculateSummary(transactions);

      expect(result).toEqual({
        totalCount: 1,
        totalVolume: 1000,
        overallAverage: 1000,
        perCurrency: [{ currency: 'NGN', totalCount: 1, totalVolume: 1000, overallAverage: 1000 }],
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
        perCurrency: [{ currency: 'NGN', totalCount: 3, totalVolume: 6000, overallAverage: 2000 }],
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
      expect(result.perCurrency).toEqual([{ currency: 'NGN', totalCount: 3, totalVolume: 4500, overallAverage: 1500 }]);
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
      expect(result.perCurrency).toEqual([{ currency: 'NGN', totalCount: 2, totalVolume: 3000, overallAverage: 1500 }]);
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

    it('should split summary per currency when mixed', () => {
      const transactions = [
        createMockTransaction(1000, '2024-12-10T10:30:00Z'),
        { ...createMockTransaction(2000, '2024-12-11T10:30:00Z'), currency: 'USD' },
      ];

      const result = calculateSummary(transactions);

      expect(result.totalCount).toBe(2);
      // Cross-currency volume/average default to null to avoid misleading sums
      expect(result.totalVolume).toBe(null);
      expect(result.overallAverage).toBe(null);
      expect(result.perCurrency).toEqual([
        { currency: 'NGN', totalCount: 1, totalVolume: 1000, overallAverage: 1000 },
        { currency: 'USD', totalCount: 1, totalVolume: 2000, overallAverage: 2000 },
      ]);
    });
  });

  describe('aggregateByType (Refunds)', () => {
    const createMockRefund = (
      amount: number,
      createdAt: string,
      refundType: RefundType = RefundType.FULL,
    ): PaystackRefund => {
      return {
        id: Math.floor(Math.random() * 10000),
        integration: 1,
        domain: 'live',
        currency: 'NGN',
        transaction: 12345,
        amount: amount * 100,
        status: RefundStatus.PROCESSED,
        dispute: null,
        refunded_at: createdAt,
        refunded_by: 'merchant',
        createdAt,
        transaction_reference: 'ref-123',
        deducted_amount: '0',
        fully_deducted: 0,
        bank_reference: 'bank-ref',
        refund_type: refundType,
        transaction_amount: amount * 100,
        retriable: false,
        customer: {} as PaystackCustomer,
      };
    };

    it('should return empty array for empty refunds', () => {
      const result = aggregateByType([]);
      expect(result).toEqual([]);
    });

    it('should aggregate refunds by type', () => {
      const refunds = [
        createMockRefund(1000, '2024-12-10T10:30:00Z', RefundType.FULL),
        createMockRefund(500, '2024-12-11T10:30:00Z', RefundType.PARTIAL),
        createMockRefund(2000, '2024-12-12T10:30:00Z', RefundType.FULL),
      ];
      const chartableRecords = toChartableRecords(refunds, refundFieldConfig);
      const result = aggregateByType(chartableRecords);

      expect(result).toHaveLength(2);

      const fullRefunds = result.find((d) => d.name === 'full');
      const partialRefunds = result.find((d) => d.name === 'partial');

      expect(fullRefunds).toEqual({
        name: 'full',
        count: 2,
        volume: 3000,
        average: 1500,
        currency: 'NGN',
      });
      expect(partialRefunds).toEqual({
        name: 'partial',
        count: 1,
        volume: 500,
        average: 500,
        currency: 'NGN',
      });
    });
  });

  describe('aggregateByCategory (Disputes)', () => {
    const createMockDispute = (
      refundAmount: number,
      createdAt: string,
      category: DisputeCategory = DisputeCategory.CHARGEBACK,
    ): PaystackDispute => {
      return {
        id: Math.floor(Math.random() * 10000),
        refund_amount: refundAmount * 100,
        currency: Currency.NGN,
        status: DisputeStatusSlug.AWAITING_MERCHANT_FEEDBACK,
        resolution: null,
        domain: 'live',
        transaction: {} as PaystackTransaction,
        transaction_reference: 'ref-123',
        category,
        customer: {} as PaystackCustomer,
        bin: null,
        last4: null,
        dueAt: createdAt,
        resolvedAt: createdAt,
        evidence: null,
        attachments: null,
        note: null,
        history: [],
        messages: [],
        createdAt,
        updatedAt: createdAt,
      };
    };

    it('should return empty array for empty disputes', () => {
      const result = aggregateByCategory([]);
      expect(result).toEqual([]);
    });

    it('should aggregate disputes by category', () => {
      const disputes = [
        createMockDispute(1000, '2024-12-10T10:30:00Z', DisputeCategory.FRAUD),
        createMockDispute(500, '2024-12-11T10:30:00Z', DisputeCategory.CHARGEBACK),
        createMockDispute(2000, '2024-12-12T10:30:00Z', DisputeCategory.FRAUD),
      ];
      const chartableRecords = toChartableRecords(disputes, disputeFieldConfig);
      const result = aggregateByCategory(chartableRecords);

      expect(result).toHaveLength(2);

      const fraudDisputes = result.find((d) => d.name === 'fraud');
      const chargebackDisputes = result.find((d) => d.name === 'chargeback');

      expect(fraudDisputes).toEqual({
        name: 'fraud',
        count: 2,
        volume: 3000,
        average: 1500,
        currency: 'NGN',
      });
      expect(chargebackDisputes).toEqual({
        name: 'chargeback',
        count: 1,
        volume: 500,
        average: 500,
        currency: 'NGN',
      });
    });
  });

  describe('aggregateByResolution (Disputes)', () => {
    const createMockDisputeWithResolution = (
      refundAmount: number,
      createdAt: string,
      resolution: DisputeResolutionSlug | null,
    ): ChartableRecord => {
      return {
        amount: refundAmount * 100,
        currency: 'NGN',
        createdAt,
        status: 'resolved',
        resolution,
      };
    };

    it('should return empty array for empty disputes', () => {
      const result = aggregateByResolution([]);
      expect(result).toEqual([]);
    });

    it('should aggregate disputes by resolution', () => {
      const records: ChartableRecord[] = [
        createMockDisputeWithResolution(1000, '2024-12-10T10:30:00Z', DisputeResolutionSlug.MERCHANT_ACCEPTED),
        createMockDisputeWithResolution(500, '2024-12-11T10:30:00Z', DisputeResolutionSlug.DECLINED),
        createMockDisputeWithResolution(2000, '2024-12-12T10:30:00Z', DisputeResolutionSlug.MERCHANT_ACCEPTED),
        createMockDisputeWithResolution(1500, '2024-12-13T10:30:00Z', null), // unknown
      ];
      const result = aggregateByResolution(records);

      expect(result).toHaveLength(3);

      const merchantAccepted = result.find((d) => d.name === 'merchant-accepted');
      const declined = result.find((d) => d.name === 'declined');
      const unknown = result.find((d) => d.name === 'unknown');

      expect(merchantAccepted).toEqual({
        name: 'merchant-accepted',
        count: 2,
        volume: 3000,
        average: 1500,
        currency: 'NGN',
      });
      expect(declined).toEqual({
        name: 'declined',
        count: 1,
        volume: 500,
        average: 500,
        currency: 'NGN',
      });
      expect(unknown).toEqual({
        name: 'unknown',
        count: 1,
        volume: 1500,
        average: 1500,
        currency: 'NGN',
      });
    });
  });

  describe('aggregateRecords', () => {
    it('should route to aggregateByChannel for by-channel aggregation', () => {
      const records: ChartableRecord[] = [
        {
          amount: 100000,
          currency: 'NGN',
          createdAt: '2024-12-10T10:30:00Z',
          status: 'success',
          channel: PaymentChannel.CARD,
        },
        {
          amount: 50000,
          currency: 'NGN',
          createdAt: '2024-12-11T10:30:00Z',
          status: 'success',
          channel: PaymentChannel.BANK,
        },
      ];

      const result = aggregateRecords(records, AggregationType.BY_CHANNEL);

      expect(result.chartData).toBeDefined();
      expect(result.chartData).toHaveLength(2);
      expect(result.chartData?.some((d) => d.name === PaymentChannel.CARD.toString())).toBe(true);
      expect(result.chartData?.some((d) => d.name === PaymentChannel.BANK.toString())).toBe(true);
    });

    it('should route to aggregateByType for by-type aggregation', () => {
      const records: ChartableRecord[] = [
        {
          amount: 100000,
          currency: 'NGN',
          createdAt: '2024-12-10T10:30:00Z',
          status: 'processed',
          type: RefundType.FULL,
        },
        {
          amount: 50000,
          currency: 'NGN',
          createdAt: '2024-12-11T10:30:00Z',
          status: 'processed',
          type: RefundType.PARTIAL,
        },
      ];
      const result = aggregateRecords(records, AggregationType.BY_TYPE);

      expect(result.chartData).toBeDefined();
      expect(result.chartData).toHaveLength(2);
      expect(result.chartData?.some((d) => d.name === 'full')).toBe(true);
      expect(result.chartData?.some((d) => d.name === 'partial')).toBe(true);
    });

    it('should route to aggregateByCategory for by-category aggregation', () => {
      const records: ChartableRecord[] = [
        {
          amount: 100000,
          currency: 'NGN',
          createdAt: '2024-12-10T10:30:00Z',
          status: 'resolved',
          category: DisputeCategory.FRAUD,
        },
        {
          amount: 50000,
          currency: 'NGN',
          createdAt: '2024-12-11T10:30:00Z',
          status: 'resolved',
          category: DisputeCategory.CHARGEBACK,
        },
      ];
      const result = aggregateRecords(records, AggregationType.BY_CATEGORY);

      expect(result.chartData).toBeDefined();
      expect(result.chartData).toHaveLength(2);
      expect(result.chartData?.some((d) => d.name === 'fraud')).toBe(true);
      expect(result.chartData?.some((d) => d.name === 'chargeback')).toBe(true);
    });

    it('should route to aggregateByResolution for by-resolution aggregation', () => {
      const records: ChartableRecord[] = [
        {
          amount: 100000,
          currency: 'NGN',
          createdAt: '2024-12-10T10:30:00Z',
          status: 'resolved',
          resolution: DisputeResolutionSlug.MERCHANT_ACCEPTED,
        },
        {
          amount: 50000,
          currency: 'NGN',
          createdAt: '2024-12-11T10:30:00Z',
          status: 'resolved',
          resolution: DisputeResolutionSlug.DECLINED,
        },
      ];
      const result = aggregateRecords(records, AggregationType.BY_RESOLUTION);

      expect(result.chartData).toBeDefined();
      expect(result.chartData).toHaveLength(2);
      expect(result.chartData?.some((d) => d.name === 'merchant-accepted')).toBe(true);
      expect(result.chartData?.some((d) => d.name === 'declined')).toBe(true);
    });
  });
});
