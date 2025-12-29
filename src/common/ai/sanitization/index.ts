/**
 * Field sanitization system for AI retrieval tools
 *
 * This module provides utilities to sanitize Paystack resource objects
 * by removing unnecessary fields and reducing token count for LLM context.
 *
 * @example
 * ```typescript
 * import { sanitizeTransactions, SanitizationLevel } from '~/common/ai/sanitization';
 *
 * // Use default STANDARD level
 * const sanitized = sanitizeTransactions(transactions);
 *
 * // Use specific level
 * const minimal = sanitizeTransactions(transactions, SanitizationLevel.MINIMAL);
 * ```
 */

export { ResourceSanitizer, sanitizeToolResponse } from './sanitizer';

export {
  sanitizeTransactions,
  sanitizeCustomers,
  sanitizeRefunds,
  sanitizePayouts,
  sanitizeDisputes,
} from './sanitizer';

export {
  SanitizationLevel,
  type SanitizationOptions,
  type FieldConfig,
  type NestedFieldConfig,
  type ResourceFieldConfigs,
  type PaystackResource,
} from './types';

export {
  TRANSACTION_FIELD_CONFIG,
  CUSTOMER_FIELD_CONFIG,
  REFUND_FIELD_CONFIG,
  PAYOUT_FIELD_CONFIG,
  DISPUTE_FIELD_CONFIG,
  RESOURCE_CONFIGS,
} from './config';
