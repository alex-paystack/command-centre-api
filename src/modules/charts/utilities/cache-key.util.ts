import { createHash } from 'crypto';
import { ChartResourceType, AggregationType } from '~/common/ai/utilities/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

/**
 * Parameters for generating a cache key
 * Includes all parameters that can affect chart data generation
 */
export interface CacheKeyParams {
  chartId: string;
  resourceType: ChartResourceType;
  aggregationType: AggregationType;
  from?: string;
  to?: string;
  status?: string;
  currency?: string;
  channel?: PaymentChannel;
}

/**
 * Generates a deterministic cache key for chart data.
 *
 * Strategy: Use a prefix + chartId + hash of configuration parameters
 *
 * Format: `chart:${chartId}:${hash}`
 *
 * The hash ensures:
 * - Collision-free keys for different parameter combinations
 * - Readable keys with chartId for debugging
 * - Compact key length regardless of parameter complexity
 *
 * @param params - Chart configuration parameters
 * @returns Cache key string
 *
 * @example
 * generateCacheKey({
 *   chartId: '123e4567-e89b-12d3-a456-426614174000',
 *   resourceType: ChartResourceType.TRANSACTION,
 *   aggregationType: AggregationType.BY_DAY,
 *   from: '2024-01-01',
 *   to: '2024-01-31',
 *   status: 'success',
 *   currency: 'NGN',
 * })
 * // Returns: 'chart:123e4567-e89b-12d3-a456-426614174000:a1b2c3d4e5f6'
 */
export function generateCacheKey(params: CacheKeyParams): string {
  // Create canonical representation of parameters
  // Sort keys alphabetically for deterministic ordering
  const canonicalParams = {
    aggregationType: params.aggregationType,
    channel: params.channel ?? null,
    currency: params.currency ?? null,
    from: params.from ?? null,
    resourceType: params.resourceType,
    status: params.status ?? null,
    to: params.to ?? null,
  };

  // Convert to JSON and hash for compact key
  const paramsString = JSON.stringify(canonicalParams);
  const hash = createHash('sha256').update(paramsString).digest('hex').substring(0, 12);

  return `chart:${params.chartId}:${hash}`;
}

/**
 * Generates a cache key pattern for invalidating all cache entries for a specific chart.
 * Useful for bulk invalidation when a chart is deleted.
 *
 * @param chartId - Chart UUID
 * @returns Cache key pattern (e.g., 'chart:123e4567-*')
 */
export function getChartCachePattern(chartId: string): string {
  return `chart:${chartId}:*`;
}
