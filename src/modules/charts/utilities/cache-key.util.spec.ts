import { generateCacheKey, getChartCachePattern, CacheKeyParams } from './cache-key.util';
import { ChartResourceType, AggregationType } from '~/common/ai/utilities/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

describe('Cache Key Utility', () => {
  const baseParams: CacheKeyParams = {
    chartId: '123e4567-e89b-12d3-a456-426614174000',
    resourceType: ChartResourceType.TRANSACTION,
    aggregationType: AggregationType.BY_DAY,
    from: '2024-01-01',
    to: '2024-01-31',
    status: 'success',
    currency: 'NGN',
  };

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys for identical parameters', () => {
      const key1 = generateCacheKey(baseParams);
      const key2 = generateCacheKey(baseParams);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^chart:[a-f0-9-]+:[a-f0-9]{12}$/);
    });

    it('should generate different keys for different parameter combinations', () => {
      const key1 = generateCacheKey(baseParams);
      const key2 = generateCacheKey({ ...baseParams, from: '2024-02-01' });
      const key3 = generateCacheKey({ ...baseParams, status: 'failed' });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('should treat undefined and null consistently', () => {
      const withUndefined = generateCacheKey({ ...baseParams, channel: undefined });
      const withoutChannel = generateCacheKey(baseParams);

      expect(withUndefined).toBe(withoutChannel);
    });

    it('should include chartId in the key', () => {
      const key = generateCacheKey(baseParams);

      expect(key).toContain(baseParams.chartId);
    });

    it('should handle all optional parameters', () => {
      const minimalParams: CacheKeyParams = {
        chartId: '123e4567-e89b-12d3-a456-426614174000',
        resourceType: ChartResourceType.TRANSACTION,
        aggregationType: AggregationType.BY_DAY,
      };

      const key = generateCacheKey(minimalParams);

      expect(key).toMatch(/^chart:[a-f0-9-]+:[a-f0-9]{12}$/);
    });

    it('should generate different keys for different chart IDs', () => {
      const key1 = generateCacheKey(baseParams);
      const key2 = generateCacheKey({ ...baseParams, chartId: 'different-chart-id' });

      expect(key1).not.toBe(key2);
    });

    it('should handle channel parameter for transactions', () => {
      const withChannel = generateCacheKey({ ...baseParams, channel: PaymentChannel.CARD });
      const withoutChannel = generateCacheKey(baseParams);

      expect(withChannel).not.toBe(withoutChannel);
    });

    it('should generate different keys for different resource types', () => {
      const transactionKey = generateCacheKey({
        ...baseParams,
        resourceType: ChartResourceType.TRANSACTION,
      });
      const refundKey = generateCacheKey({ ...baseParams, resourceType: ChartResourceType.REFUND });

      expect(transactionKey).not.toBe(refundKey);
    });

    it('should generate different keys for different aggregation types', () => {
      const byDayKey = generateCacheKey({ ...baseParams, aggregationType: AggregationType.BY_DAY });
      const byStatusKey = generateCacheKey({
        ...baseParams,
        aggregationType: AggregationType.BY_STATUS,
      });

      expect(byDayKey).not.toBe(byStatusKey);
    });

    it('should generate different keys for different currencies', () => {
      const ngnKey = generateCacheKey({ ...baseParams, currency: 'NGN' });
      const usdKey = generateCacheKey({ ...baseParams, currency: 'USD' });

      expect(ngnKey).not.toBe(usdKey);
    });

    it('should generate different keys for different date ranges', () => {
      const jan = generateCacheKey({ ...baseParams, from: '2024-01-01', to: '2024-01-31' });
      const feb = generateCacheKey({ ...baseParams, from: '2024-02-01', to: '2024-02-29' });

      expect(jan).not.toBe(feb);
    });

    it('should normalize optional parameters to ensure consistency', () => {
      const withUndefined = generateCacheKey({ ...baseParams, channel: undefined });
      const withoutParam = generateCacheKey(baseParams);

      // All should be the same since channel is optional and normalized to null
      expect(withUndefined).toBe(withoutParam);
    });
  });

  describe('getChartCachePattern', () => {
    it('should generate valid Redis pattern for chart ID', () => {
      const pattern = getChartCachePattern('123e4567-e89b-12d3-a456-426614174000');

      expect(pattern).toBe('chart:123e4567-e89b-12d3-a456-426614174000:*');
    });

    it('should work with different chart IDs', () => {
      const pattern1 = getChartCachePattern('chart-1');
      const pattern2 = getChartCachePattern('chart-2');

      expect(pattern1).toBe('chart:chart-1:*');
      expect(pattern2).toBe('chart:chart-2:*');
      expect(pattern1).not.toBe(pattern2);
    });
  });
});
