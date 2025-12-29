import type { PaystackTransaction, PaystackCustomer, PaystackRefund, PaystackPayout, PaystackDispute } from '../types';

/**
 * Sanitization levels control how much data to retain
 */
export enum SanitizationLevel {
  /**
   * Only critical identification fields (IDs, amounts, status)
   * Most aggressive token reduction (~85-87%)
   */
  MINIMAL = 'minimal',

  /**
   * Most commonly needed fields for general queries
   * Balanced token reduction (~70-75%)
   * DEFAULT LEVEL
   */
  STANDARD = 'standard',

  /**
   * More fields for complex queries
   * Conservative token reduction (~60-65%)
   */
  DETAILED = 'detailed',
}

/**
 * Resource types for sanitization
 */
export enum ResourceType {
  TRANSACTION = 'transaction',
  CUSTOMER = 'customer',
  REFUND = 'refund',
  PAYOUT = 'payout',
  DISPUTE = 'dispute',
}

/**
 * Configuration for nested objects
 */
export interface NestedFieldConfig {
  /**
   * Fields to keep from the nested object
   */
  fields: string[];

  /**
   * For arrays, whether to limit the number of items
   * Example: First 3 authorizations, last 5 history items
   */
  arrayLimit?: number;

  /**
   * Whether to flatten the nested object into parent
   * (Not implemented in v1 but reserved for future use)
   */
  flatten?: boolean;
}

/**
 * Field configuration for a resource type
 */
export interface FieldConfig<T> {
  /**
   * Top-level fields to keep from the resource
   */
  fields: Array<keyof T>;

  /**
   * Nested object configurations
   * Key is the field name of the nested object
   */
  nested?: {
    [K in keyof T]?: NestedFieldConfig;
  };
}

/**
 * Resource-specific field configurations by sanitization level
 */
export type ResourceFieldConfigs<T> = {
  [K in SanitizationLevel]: FieldConfig<T>;
};

/**
 * Union type of all resource types
 */
export type PaystackResource =
  | PaystackTransaction
  | PaystackCustomer
  | PaystackRefund
  | PaystackPayout
  | PaystackDispute;

/**
 * Options for sanitization
 */
export interface SanitizationOptions {
  /**
   * Sanitization level (defaults to STANDARD if not provided)
   */
  level?: SanitizationLevel;

  /**
   * Resource type being sanitized
   */
  resourceType: ResourceType;

  /**
   * Preserve specific fields even if not in config
   * Useful for specific use cases that need extra fields
   */
  preserveFields?: string[];
}
