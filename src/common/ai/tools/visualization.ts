import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type { AuthenticatedUser } from '../types';
import { AggregationType, ChartResourceType } from '../chart-config';
import {
  generateChartData,
  type ChartGenerationState,
  type ChartSuccessState,
  type ChartErrorState,
} from '../chart-generator';
import { PaymentChannel } from '../types/data';
import { ChartType } from '../aggregation';

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
        )
        .default(AggregationType.BY_DAY),
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

/**
 * Create a tool that compares chart data for two date ranges.
 * Useful for "current period vs previous period" views.
 */
export function createCompareChartDataTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description: `Compare chart data for two date ranges (e.g., current vs previous) across the same resource and aggregation.

**When to use:** User says "compare", "vs last week/month", provides two ranges, or asks for "previous period".
**Supports:** transaction, refund, payout, dispute.
**Aggregation options:** by-day/hour/week/month/status; plus by-channel (transaction), by-type (refund), by-category/by-resolution (dispute).
**What it returns:** Chart-ready series for both ranges (current/previous) plus summaries and deltas. Time-based aggregations return chartSeries arrays; categorical aggregations return chartData arrays.
**Limits:** Each range must be ≤30 days; validation happens in chart generation.`,
    inputSchema: z.object({
      resourceType: z
        .enum(Object.values(ChartResourceType))
        .default(ChartResourceType.TRANSACTION)
        .describe('Type of resource to compare (default: transaction)'),
      aggregationType: z
        .enum(Object.values(AggregationType))
        .default(AggregationType.BY_DAY)
        .describe(
          'Aggregation to use for both ranges. Time-based (by-day/hour/week/month) and by-status for all resources; model-specific options as noted above.',
        ),
      rangeA: z
        .object({ from: z.string(), to: z.string() })
        .describe('Primary range (current period). ISO 8601 dates, span ≤30 days.'),
      rangeB: z
        .object({ from: z.string(), to: z.string() })
        .describe('Secondary range (comparison/previous period). ISO 8601 dates, span ≤30 days.'),
      status: z.string().optional().describe('Filter by status (values depend on resource type)'),
      currency: z.string().optional().describe('Filter by currency (e.g., NGN, USD, GHS)'),
      channel: z
        .enum(Object.values(PaymentChannel))
        .optional()
        .describe('Filter by payment channel (transactions only)'),
    }),
    execute: async ({ resourceType, aggregationType, rangeA, rangeB, status, currency, channel }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const [resultA, resultB] = await Promise.all([
        drainChartGenerator(
          generateChartData(
            { resourceType, aggregationType, status, currency, channel, ...rangeA },
            paystackService,
            jwtToken,
          ),
        ),
        drainChartGenerator(
          generateChartData(
            { resourceType, aggregationType, status, currency, channel, ...rangeB },
            paystackService,
            jwtToken,
          ),
        ),
      ]);

      const chartType = resultA.chartType === resultB.chartType ? resultA.chartType : ChartType.AREA;

      return {
        label: `${resultA.label} vs ${resultB.label}`,
        chartType,
        current: resultA.chartSeries ?? resultA.chartData,
        previous: resultB.chartSeries ?? resultB.chartData,
        summary: {
          current: resultA.summary,
          previous: resultB.summary,
          deltas: {
            totalCount: resultA.summary.totalCount - resultB.summary.totalCount,
            totalVolume: (resultA.summary.totalVolume ?? 0) - (resultB.summary.totalVolume ?? 0),
            overallAverage: (resultA.summary.overallAverage ?? 0) - (resultB.summary.overallAverage ?? 0),
          },
        },
      };
    },
  });
}

// Drain the async generator and return the final success state.
async function drainChartGenerator(generator: AsyncGenerator<ChartGenerationState>): Promise<ChartSuccessState> {
  let finalState: ChartSuccessState | ChartErrorState | undefined;

  for await (const state of generator) {
    if (!('loading' in state)) {
      finalState = state;
    }
  }

  if (!finalState || 'error' in finalState) {
    throw new Error(finalState?.error ?? 'Failed to generate chart data');
  }

  return finalState;
}
