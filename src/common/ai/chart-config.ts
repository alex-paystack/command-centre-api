import type { PaystackTransaction, PaystackRefund, PaystackPayout, PaystackDispute } from './types/index';
import {
  DisputeCategory,
  DisputeResolutionSlug,
  DisputeStatusSlug,
  PayoutStatus,
  RefundStatus,
  RefundType,
  TransactionStatus,
} from './types/data';

/**
 * Supported resource types for chart generation
 */
export enum ChartResourceType {
  TRANSACTION = 'transaction',
  REFUND = 'refund',
  PAYOUT = 'payout',
  DISPUTE = 'dispute',
}

/**
 * Extended aggregation types including model-specific dimensions
 */
export enum AggregationType {
  // Time-based (all models)
  BY_DAY = 'by-day',
  BY_HOUR = 'by-hour',
  BY_WEEK = 'by-week',
  BY_MONTH = 'by-month',
  // Status-based (all models)
  BY_STATUS = 'by-status',
  // Model-specific
  BY_TYPE = 'by-type', // Refunds: full/partial
  BY_CATEGORY = 'by-category', // Disputes: fraud/chargeback
  BY_RESOLUTION = 'by-resolution', // Disputes: resolution outcomes
}

export type ChartableResource = PaystackTransaction | PaystackRefund | PaystackPayout | PaystackDispute;

/**
 * Mapping of valid aggregation types per resource
 */
export const VALID_AGGREGATIONS: Record<ChartResourceType, AggregationType[]> = {
  [ChartResourceType.TRANSACTION]: [
    AggregationType.BY_DAY,
    AggregationType.BY_HOUR,
    AggregationType.BY_WEEK,
    AggregationType.BY_MONTH,
    AggregationType.BY_STATUS,
  ],
  [ChartResourceType.REFUND]: [
    AggregationType.BY_DAY,
    AggregationType.BY_HOUR,
    AggregationType.BY_WEEK,
    AggregationType.BY_MONTH,
    AggregationType.BY_STATUS,
    AggregationType.BY_TYPE,
  ],
  [ChartResourceType.PAYOUT]: [
    AggregationType.BY_DAY,
    AggregationType.BY_HOUR,
    AggregationType.BY_WEEK,
    AggregationType.BY_MONTH,
    AggregationType.BY_STATUS,
  ],
  [ChartResourceType.DISPUTE]: [
    AggregationType.BY_DAY,
    AggregationType.BY_HOUR,
    AggregationType.BY_WEEK,
    AggregationType.BY_MONTH,
    AggregationType.BY_STATUS,
    AggregationType.BY_CATEGORY,
    AggregationType.BY_RESOLUTION,
  ],
};

/**
 * Generic interface for extracting chartable fields from any resource
 */
export interface ChartableRecord {
  amount: number; // Amount in subunits
  currency: string;
  createdAt: string; // ISO date string
  status: string;
  // Optional model-specific fields
  type?: RefundType; // For refunds: full/partial
  category?: DisputeCategory; // For disputes: fraud/chargeback
  resolution?: DisputeResolutionSlug | null; // For disputes: resolution outcome
}

/**
 * Field accessor configuration for each resource type
 */
export interface ResourceFieldConfig<T> {
  getAmount: (record: T) => number;
  getCurrency: (record: T) => string;
  getCreatedAt: (record: T) => string;
  getStatus: (record: T) => string;
  getType?: (record: T) => RefundType;
  getCategory?: (record: T) => DisputeCategory;
  getResolution?: (record: T) => DisputeResolutionSlug | null;
}

/**
 * Status enum values for input validation per resource type
 */
export const STATUS_VALUES: Record<ChartResourceType, readonly string[]> = {
  [ChartResourceType.TRANSACTION]: Object.values(TransactionStatus),
  [ChartResourceType.REFUND]: Object.values(RefundStatus),
  [ChartResourceType.PAYOUT]: Object.values(PayoutStatus),
  [ChartResourceType.DISPUTE]: Object.values(DisputeStatusSlug),
};

/**
 * API endpoints for each resource type
 */
export const API_ENDPOINTS: Record<ChartResourceType, string> = {
  [ChartResourceType.TRANSACTION]: '/transaction',
  [ChartResourceType.REFUND]: '/refund',
  [ChartResourceType.PAYOUT]: '/settlement',
  [ChartResourceType.DISPUTE]: '/dispute',
};

/**
 * Field accessor for Transaction resources
 */
export const transactionFieldConfig: ResourceFieldConfig<PaystackTransaction> = {
  getAmount: (t) => t.amount,
  getCurrency: (t) => t.currency,
  getCreatedAt: (t) => t.createdAt,
  getStatus: (t) => t.status,
};

/**
 * Field accessor for Refund resources
 */
export const refundFieldConfig: ResourceFieldConfig<PaystackRefund> = {
  getAmount: (r) => r.amount,
  getCurrency: (r) => r.currency,
  getCreatedAt: (r) => r.refunded_at,
  getStatus: (r) => r.status,
  getType: (r) => r.refund_type,
};

/**
 * Field accessor for Payout resources
 */
export const payoutFieldConfig: ResourceFieldConfig<PaystackPayout> = {
  getAmount: (p) => p.total_amount,
  getCurrency: (p) => p.currency,
  getCreatedAt: (p) => p.createdAt,
  getStatus: (p) => p.status,
};

/**
 * Field accessor for Dispute resources
 */
export const disputeFieldConfig: ResourceFieldConfig<PaystackDispute> = {
  getAmount: (d) => d.refund_amount,
  getCurrency: (d) => d.currency,
  getCreatedAt: (d) => d.createdAt,
  getStatus: (d) => d.status,
  getCategory: (d) => d.category,
  getResolution: (d) => d.resolution,
};

/**
 * Get the field config for a given resource type
 */
export function getFieldConfig(resourceType: ChartResourceType): ResourceFieldConfig<ChartableResource> {
  switch (resourceType) {
    case ChartResourceType.TRANSACTION:
      return transactionFieldConfig;
    case ChartResourceType.REFUND:
      return refundFieldConfig;
    case ChartResourceType.PAYOUT:
      return payoutFieldConfig;
    case ChartResourceType.DISPUTE:
      return disputeFieldConfig;
    default:
      throw new Error(`Unknown resource type: ${String(resourceType)}`);
  }
}

/**
 * Convert any resource to a ChartableRecord using its field config
 */
export function toChartableRecord<T>(record: T, config: ResourceFieldConfig<T>): ChartableRecord {
  return {
    amount: config.getAmount(record),
    currency: config.getCurrency(record),
    createdAt: config.getCreatedAt(record),
    status: config.getStatus(record),
    type: config.getType?.(record),
    category: config.getCategory?.(record),
    resolution: config.getResolution?.(record),
  };
}

/**
 * Convert an array of resources to ChartableRecords
 */
export function toChartableRecords<T>(records: T[], config: ResourceFieldConfig<T>): ChartableRecord[] {
  return records.map((record) => toChartableRecord(record, config));
}

/**
 * Validate that an aggregation type is valid for a given resource type
 */
export function isValidAggregation(resourceType: ChartResourceType, aggregationType: AggregationType): boolean {
  return VALID_AGGREGATIONS[resourceType].includes(aggregationType);
}

/**
 * Get human-readable resource type name for labels
 */
export function getResourceDisplayName(resourceType: ChartResourceType): string {
  const displayNames: Record<ChartResourceType, string> = {
    [ChartResourceType.TRANSACTION]: 'Transaction',
    [ChartResourceType.REFUND]: 'Refund',
    [ChartResourceType.PAYOUT]: 'Payout',
    [ChartResourceType.DISPUTE]: 'Dispute',
  };
  return displayNames[resourceType];
}
