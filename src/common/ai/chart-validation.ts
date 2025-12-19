import {
  AggregationType,
  ChartResourceType,
  isValidAggregation,
  STATUS_VALUES,
  VALID_AGGREGATIONS,
} from './chart-config';
import { PaymentChannel } from './types/data';
import { validateDateRange } from './utils';

export type ChartValidationParams = {
  resourceType: ChartResourceType;
  aggregationType: AggregationType;
  status?: string;
  from?: string;
  to?: string;
  channel?: PaymentChannel;
};

export type ChartValidationResult = { isValid: true } | { isValid: false; error: string };

/**
 * Shared validator for chart configuration used by chart generation and saved charts.
 */
export function validateChartParams(params: ChartValidationParams): ChartValidationResult {
  const { resourceType, aggregationType, status, from, to, channel } = params;

  if (!isValidAggregation(resourceType, aggregationType)) {
    return {
      isValid: false,
      error: `Invalid aggregation type '${aggregationType}' for resource type '${resourceType}'. Valid options are: ${getValidAggregationList(resourceType)}`,
    };
  }

  if (status && !STATUS_VALUES[resourceType].includes(status)) {
    return {
      isValid: false,
      error: `Invalid status '${status}' for resource type '${resourceType}'. Valid options are: ${STATUS_VALUES[resourceType].join(', ')}`,
    };
  }

  if (channel) {
    if (resourceType !== ChartResourceType.TRANSACTION) {
      return {
        isValid: false,
        error: `Channel filter is only supported for transactions. Received resource type '${resourceType}'.`,
      };
    }

    if (!Object.values(PaymentChannel).includes(channel)) {
      return {
        isValid: false,
        error: `Invalid channel '${channel}'. Valid options are: ${Object.values(PaymentChannel).join(', ')}`,
      };
    }
  }

  const dateValidation = validateDateRange(from, to);
  if (!dateValidation.isValid) {
    return { isValid: false, error: dateValidation.error ?? 'Invalid date range' };
  }

  return { isValid: true };
}

function getValidAggregationList(resourceType: ChartResourceType): string {
  return VALID_AGGREGATIONS[resourceType].join(', ');
}
