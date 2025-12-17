import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type { AuthenticatedUser } from '../types';
import {
  AggregationType,
  ChartResourceType,
  VALID_AGGREGATIONS,
  API_ENDPOINTS,
  getFieldConfig,
  toChartableRecords,
  isValidAggregation,
  getResourceDisplayName,
  ChartableResource,
  STATUS_VALUES,
} from '../chart-config';
import { validateDateRange } from '../utils';
import { generateChartLabel, getChartType, calculateSummary, aggregateRecords } from '../aggregation';
import { format, parseISO } from 'date-fns';

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

      if (!isValidAggregation(resourceType, aggregationType)) {
        const validAggregations = VALID_AGGREGATIONS[resourceType].join(', ');

        return {
          error: `Invalid aggregation type '${aggregationType}' for resource type '${resourceType}'. Valid options are: ${validAggregations}`,
        };
      }

      if (status && !STATUS_VALUES[resourceType].includes(status)) {
        return {
          error: `Invalid status '${status}' for resource type '${resourceType}'. Valid options are: ${STATUS_VALUES[resourceType].join(', ')}`,
        };
      }

      // Validate date range does not exceed 30 days
      const dateValidation = validateDateRange(from, to);

      if (!dateValidation.isValid) {
        return {
          error: dateValidation.error,
        };
      }

      try {
        const dateRange = { from, to };
        const chartType = getChartType(aggregationType);
        const resourceDisplayName = getResourceDisplayName(resourceType);
        const resourceDisplayNamePlural = `${resourceDisplayName.toLowerCase()}s`;
        const endpoint = API_ENDPOINTS[resourceType];
        const fieldConfig = getFieldConfig(resourceType);

        yield {
          loading: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          message: `Fetching ${resourceDisplayNamePlural}...`,
        };

        // Fetch records with increased perPage for better aggregation (up to 500)
        const allRecords: ChartableResource[] = [];
        const perPage = 100; // Max per request
        // TODO: Review this limit
        const maxPages = 10; // Fetch up to 1000 records total

        for (let page = 1; page <= maxPages; page++) {
          const params = {
            perPage,
            page,
            use_cursor: false,
            ...(resourceType === ChartResourceType.TRANSACTION && { reduced_fields: true }),
            ...(status && { status }),
            ...(from && { from }),
            ...(to && { to }),
            ...(currency && { currency }),
          };

          const response = await paystackService.get<ChartableResource[]>(endpoint, jwtToken, params);

          allRecords.push(...response.data);

          if (page < maxPages && response.data.length === perPage) {
            yield {
              loading: true,
              label: generateChartLabel(aggregationType, dateRange, resourceType),
              chartType,
              message: `Fetching ${resourceDisplayNamePlural}... (${allRecords.length} loaded)`,
            };
          }

          // Stop if we've received fewer than perPage (no more data)
          if (response.data.length < perPage) {
            break;
          }
        }

        if (allRecords.length === 0) {
          yield {
            success: true,
            label: generateChartLabel(aggregationType, dateRange, resourceType),
            chartType,
            chartData: [],
            chartSeries: [],
            summary: {
              totalCount: 0,
              totalVolume: 0,
              overallAverage: 0,
              ...(from || to
                ? {
                    dateRange: {
                      from: from ? format(parseISO(from), 'MMM d, yyyy') : 'N/A',
                      to: to ? format(parseISO(to), 'MMM d, yyyy') : 'N/A',
                    },
                  }
                : {}),
            },
            message: `No ${resourceDisplayNamePlural} found for the specified criteria`,
          };
          return;
        }

        yield {
          loading: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          message: `Processing ${allRecords.length} ${resourceDisplayNamePlural}...`,
        };

        const chartableRecords = toChartableRecords(allRecords, fieldConfig);

        const aggregationResult = aggregateRecords(chartableRecords, aggregationType);

        const summary = calculateSummary(chartableRecords, dateRange);

        const dataPointCount = aggregationResult.chartSeries
          ? aggregationResult.chartSeries.reduce((sum, series) => sum + series.points.length, 0)
          : (aggregationResult.chartData?.length ?? 0);

        yield {
          success: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          chartData: aggregationResult.chartData,
          chartSeries: aggregationResult.chartSeries,
          summary,
          message: `Generated chart data with ${dataPointCount} data points from ${allRecords.length} ${resourceDisplayNamePlural}`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to generate chart data',
        };
      }
    },
  });
}
