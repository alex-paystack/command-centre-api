import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type { AuthenticatedUser } from '../types';
import { AggregationType, ChartResourceType } from '../chart-config';
import { generateChartData } from '../chart-generator';

/**
 * Create the generateChartData tool
 * Supports multiple resource types: transaction, refund, payout, dispute
 */
export function createGenerateChartDataTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description: `Generate chart data for analytics on transactions, refunds, payouts, or disputes. Use this to create visualizations of trends, patterns, and distributions across different resource types.

**Resource Types & Supported Aggregations:**
- transaction: by-day, by-hour, by-week, by-month, by-status
- refund: by-day, by-hour, by-week, by-month, by-status, by-type (full/partial)
- payout: by-day, by-hour, by-week, by-month, by-status
- dispute: by-day, by-hour, by-week, by-month, by-status, by-category (fraud/chargeback), by-resolution

Returns Recharts-compatible data with count, volume, and average metrics.`,
    inputSchema: z.object({
      resourceType: z
        .enum([
          ChartResourceType.TRANSACTION,
          ChartResourceType.REFUND,
          ChartResourceType.PAYOUT,
          ChartResourceType.DISPUTE,
        ])
        .default(ChartResourceType.TRANSACTION)
        .describe('Type of resource to generate chart data for (default: transaction)'),
      aggregationType: z
        .enum([
          AggregationType.BY_DAY,
          AggregationType.BY_HOUR,
          AggregationType.BY_WEEK,
          AggregationType.BY_MONTH,
          AggregationType.BY_STATUS,
          AggregationType.BY_TYPE,
          AggregationType.BY_CATEGORY,
          AggregationType.BY_RESOLUTION,
        ])
        .describe(
          'Type of aggregation. Time-based (by-day, by-hour, by-week, by-month) and by-status work for all resources. by-type is for refunds only. by-category and by-resolution are for disputes only.',
        ),
      from: z.string().optional().describe('Start date for filtering (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.string().optional().describe('Filter by status (values depend on resource type)'),
      currency: z.string().optional().describe('Filter by currency (e.g., NGN, USD, GHS)'),
    }),
    execute: async function* ({ resourceType, aggregationType, from, to, status, currency }) {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const generator = generateChartData(
        { resourceType, aggregationType, from, to, status, currency },
        paystackService,
        jwtToken,
      );

      // Yield all states from the generator
      for await (const state of generator) {
        yield state;
      }
    },
  });
}
