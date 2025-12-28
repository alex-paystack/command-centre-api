import { format, parseISO } from 'date-fns';
import type { PaystackApiService } from '../../services/paystack-api.service';
import {
  AggregationType,
  ChartResourceType,
  API_ENDPOINTS,
  getFieldConfig,
  toChartableRecords,
  getResourceDisplayName,
  ChartableResource,
} from './chart-config';
import { generateChartLabel, getChartType, calculateSummary, aggregateRecords, ChartResult } from './aggregation';
import { PaymentChannel } from '../types/data';
import { validateChartParams } from './chart-validation';

/**
 * Parameters for generating chart data
 */
export interface GenerateChartDataParams {
  resourceType: ChartResourceType;
  aggregationType: AggregationType;
  from?: string;
  to?: string;
  status?: string;
  currency?: string;
  channel?: PaymentChannel;
}

/**
 * Loading state during chart generation
 */
export interface ChartLoadingState {
  loading: true;
  label: string;
  chartType: string;
  message: string;
}

/**
 * Success state with chart data
 */
export interface ChartSuccessState extends ChartResult {
  success: true;
  message: string;
}

/**
 * Error state
 */
export interface ChartErrorState {
  error: string;
}

/**
 * Union type for all possible chart generation states
 */
export type ChartGenerationState = ChartLoadingState | ChartSuccessState | ChartErrorState;

/**
 * Reusable chart generation function that can be used by both the AI tool and SavedChartService.
 *
 * This is a generator function that yields loading states during processing and returns
 * the final result. This allows for streaming updates to the UI.
 *
 * @param params - Chart generation parameters (resourceType, aggregationType, filters)
 * @param paystackService - Service for making API calls to Paystack
 * @param jwtToken - JWT token for authentication
 * @returns AsyncGenerator yielding loading states and final result
 *
 * @example
 * ```typescript
 * const generator = generateChartData({
 *   resourceType: ChartResourceType.TRANSACTION,
 *   aggregationType: AggregationType.BY_DAY,
 *   from: '2024-01-01',
 *   to: '2024-01-31'
 * }, paystackService, jwtToken);
 *
 * for await (const state of generator) {
 *   if (state.loading) {
 *     console.log(state.message);
 *   } else if (state.success) {
 *     console.log('Chart data:', state);
 *   } else if (state.error) {
 *     console.error(state.error);
 *   }
 * }
 * ```
 */
export async function* generateChartData(
  params: GenerateChartDataParams,
  paystackService: PaystackApiService,
  jwtToken: string,
): AsyncGenerator<ChartGenerationState, ChartErrorState | ChartSuccessState, unknown> {
  const { resourceType, aggregationType, from, to, status, currency, channel } = params;

  if (!jwtToken) {
    const errorState: ChartErrorState = {
      error: 'Authentication token not available. Please ensure you are logged in.',
    };
    yield errorState;
    return errorState;
  }

  const validation = validateChartParams({ resourceType, aggregationType, status, from, to, channel });

  if (!validation.isValid) {
    const errorState: ChartErrorState = { error: validation.error };
    yield errorState;
    return errorState;
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
      label: generateChartLabel(aggregationType, resourceType),
      chartType,
      message: `Fetching ${resourceDisplayNamePlural}...`,
    };

    // Fetch records with pagination (up to 1000 records total)
    const allRecords: ChartableResource[] = [];
    // TODO: Review this limit/make it configurable
    const perPage = 100; // Max per request
    const maxPages = 10; // Fetch up to 1000 records total

    for (let page = 1; page <= maxPages; page++) {
      const requestParams = {
        perPage,
        page,
        use_cursor: false,
        ...(resourceType === ChartResourceType.TRANSACTION && { reduced_fields: true, ...(channel && { channel }) }),
        ...(status && { status }),
        ...(from && { from }),
        ...(to && { to }),
        ...(currency && { currency }),
      };

      const response = await paystackService.get<ChartableResource[]>(endpoint, jwtToken, requestParams);

      allRecords.push(...response.data);

      // Yield progress update if fetching multiple pages
      if (page < maxPages && response.data.length === perPage) {
        yield {
          loading: true,
          label: generateChartLabel(aggregationType, resourceType),
          chartType,
          message: `Fetching ${resourceDisplayNamePlural}... (${allRecords.length} loaded)`,
        };
      }

      // Stop if we've received fewer than perPage (no more data)
      if (response.data.length < perPage) {
        break;
      }
    }

    // Handle empty result set
    if (allRecords.length === 0) {
      const successState: ChartSuccessState = {
        success: true,
        label: generateChartLabel(aggregationType, resourceType),
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
      yield successState;
      return successState;
    }

    // Process records
    yield {
      loading: true,
      label: generateChartLabel(aggregationType, resourceType),
      chartType,
      message: `Processing ${allRecords.length} ${resourceDisplayNamePlural}...`,
    };

    const chartableRecords = toChartableRecords(allRecords, fieldConfig);
    const aggregationResult = aggregateRecords(chartableRecords, aggregationType);
    const summary = calculateSummary(chartableRecords, dateRange);

    const dataPointCount = aggregationResult.chartSeries
      ? aggregationResult.chartSeries.reduce((sum, series) => sum + series.points.length, 0)
      : (aggregationResult.chartData?.length ?? 0);

    const successState: ChartSuccessState = {
      success: true,
      label: generateChartLabel(aggregationType, resourceType),
      chartType,
      chartData: aggregationResult.chartData,
      chartSeries: aggregationResult.chartSeries,
      summary,
      message: `Generated chart data with ${dataPointCount} data points from ${allRecords.length} ${resourceDisplayNamePlural}`,
    };
    yield successState;
    return successState;
  } catch (error: unknown) {
    const errorState: ChartErrorState = {
      error: error instanceof Error ? error.message : 'Failed to generate chart data',
    };
    yield errorState;
    return errorState;
  }
}
