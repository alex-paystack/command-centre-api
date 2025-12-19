import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type { AuthenticatedUser } from '../types';
import { AggregationType, ChartResourceType } from '../chart-config';
import { generateChartData } from '../chart-generator';
import { PaymentChannel } from '../types/data';

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
- transaction: by-day, by-hour, by-week, by-month, by-status, by-channel (payment channel)
- refund: by-day, by-hour, by-week, by-month, by-status, by-type (full/partial)
- payout: by-day, by-hour, by-week, by-month, by-status
- dispute: by-day, by-hour, by-week, by-month, by-status, by-category (fraud/chargeback), by-resolution

Returns Recharts-compatible data with count, volume, and average metrics.`,
    inputSchema: z.object({
      resourceType: z
        .enum(Object.values(ChartResourceType))
        .default(ChartResourceType.TRANSACTION)
        .describe('Type of resource to generate chart data for (default: transaction)'),
      aggregationType: z

        .enum(Object.values(AggregationType))
        .describe(
          'Type of aggregation. Time-based (by-day, by-hour, by-week, by-month) and by-status work for all resources. by-channel is for transactions only. by-type is for refunds only. by-category and by-resolution are for disputes only.',
        ),
      from: z.string().optional().describe('Start date for filtering (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.string().optional().describe('Filter by status (values depend on resource type)'),
      currency: z.string().optional().describe('Filter by currency (e.g., NGN, USD, GHS)'),
      channel: z
        .enum(Object.values(PaymentChannel))
        .optional()
        .describe('Filter by payment channel (e.g., card, bank, mobile money) for transactions only'),
    }),
    execute: async function* ({ resourceType, aggregationType, from, to, status, currency, channel }) {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const generator = generateChartData(
        { resourceType, aggregationType, from, to, status, currency, channel },
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
