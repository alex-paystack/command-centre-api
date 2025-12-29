import type { SanitizationOptions, FieldConfig, NestedFieldConfig, PaystackResource } from './types';
import { SanitizationLevel } from './types';
import { RESOURCE_CONFIGS } from './config';
import type { PaystackTransaction, PaystackCustomer, PaystackRefund, PaystackPayout, PaystackDispute } from '../types';
import { ResourceType } from '../types';

export class ResourceSanitizer {
  /**
   * Sanitize a single resource object
   *
   * @param resource - The resource to sanitize
   * @param options - Sanitization options (level, resource type, preserve fields)
   * @returns Sanitized resource with only configured fields
   */
  static sanitize<T extends PaystackResource>(resource: T, options: SanitizationOptions) {
    const level = options.level || SanitizationLevel.STANDARD;
    const config = RESOURCE_CONFIGS[options.resourceType][level];

    return this.applyFieldConfig(
      resource as unknown as Record<string, unknown>,
      config as FieldConfig<Record<string, unknown>>,
      options.preserveFields,
    ) as Partial<T>;
  }

  /**
   * Sanitize an array of resources
   *
   * @param resources - Array of resources to sanitize
   * @param options - Sanitization options
   * @returns Array of sanitized resources
   */
  static sanitizeArray<T extends PaystackResource>(resources: T[], options: SanitizationOptions) {
    return resources.map((resource) => this.sanitize(resource, options));
  }

  /**
   * Apply field configuration to a resource
   * Copies allowed top-level fields and processes nested objects
   *
   * @param resource - The resource to process
   * @param config - Field configuration for this resource type
   * @param preserveFields - Optional array of fields to preserve regardless of config
   * @returns Object with only configured fields
   */
  private static applyFieldConfig<T extends Record<string, unknown>>(
    resource: T,
    config: FieldConfig<T>,
    preserveFields?: string[],
  ): Partial<T> {
    const result: Partial<T> = {};

    // Copy allowed top-level fields
    for (const field of config.fields) {
      if (field in resource) {
        result[field] = resource[field];
      }
    }

    // Copy preserved fields if specified
    if (preserveFields) {
      for (const field of preserveFields) {
        if (field in resource && !result[field]) {
          result[field as keyof T] = resource[field as keyof T];
        }
      }
    }

    // Handle nested objects
    if (config.nested) {
      for (const [nestedKey, nestedConfig] of Object.entries(config.nested)) {
        const nestedValue = resource[nestedKey];

        if (nestedValue !== undefined) {
          // Preserve null values
          if (nestedValue === null) {
            result[nestedKey as keyof T] = null as T[keyof T];
          } else {
            result[nestedKey as keyof T] = this.sanitizeNested(
              nestedValue,
              nestedConfig as NestedFieldConfig,
            ) as T[keyof T];
          }
        }
      }
    }

    return result;
  }

  /**
   * Sanitize nested object or array
   * Handles both single objects and arrays of objects
   *
   * @param value - The nested value to sanitize
   * @param config - Configuration for the nested object
   * @returns Sanitized nested value
   */
  private static sanitizeNested(value: unknown, config: NestedFieldConfig) {
    // Handle arrays
    if (Array.isArray(value)) {
      const limited = config.arrayLimit ? value.slice(0, config.arrayLimit) : value;
      return limited.map((item) => this.selectFields(item as Record<string, unknown>, config.fields));
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      return this.selectFields(value as Record<string, unknown>, config.fields);
    }

    return value;
  }

  /**
   * Select specific fields from an object
   * Supports dot notation for nested paths (e.g., 'bank.name')
   *
   * @param obj - Object to select fields from
   * @param fields - Array of field names to keep
   * @returns Object with only selected fields
   */
  private static selectFields(obj: Record<string, unknown>, fields: string[]) {
    const result: Record<string, unknown> = {};

    for (const field of fields) {
      // Handle nested field paths (e.g., 'bank.name')
      if (field.includes('.')) {
        const pathParts = field.split('.');
        const value = this.getNestedValue(obj, field);
        if (value !== undefined) {
          this.setNestedValue(result, pathParts, value);
        }
      } else if (field in obj) {
        result[field] = obj[field];
      }
    }

    return result;
  }

  /**
   * Set a nested value on target object using an array path
   * Creates intermediate objects as needed and merges with existing ones
   */
  private static setNestedValue(target: Record<string, unknown>, path: string[], value: unknown) {
    let cursor: Record<string, unknown> = target;

    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      const isLast = i === path.length - 1;

      if (isLast) {
        cursor[key] = value;
        return;
      }

      const existing = cursor[key];
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        cursor[key] = {};
      }

      cursor = cursor[key] as Record<string, unknown>;
    }
  }

  /**
   * Get nested value from object using dot notation
   *
   * @param obj - Object to traverse
   * @param path - Dot-separated path (e.g., 'address.city')
   * @returns Value at the path, or undefined if not found
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string) {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }
}

/**
 * Convenience function for sanitizing tool responses
 * Handles both single resources and arrays
 *
 * @param data - Resource or array of resources to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data in the same format (single or array)
 */
export function sanitizeToolResponse<T extends PaystackResource>(
  data: T | T[],
  options: SanitizationOptions,
): Partial<T> | Array<Partial<T>> {
  if (Array.isArray(data)) {
    return ResourceSanitizer.sanitizeArray(data, options);
  }
  return ResourceSanitizer.sanitize(data, options);
}

/**
 * Helper to sanitize transaction tool responses
 * Uses STANDARD level by default
 *
 * @param transactions - Array of transactions
 * @param level - Sanitization level (defaults to STANDARD)
 * @returns Array of sanitized transactions
 */
export function sanitizeTransactions(
  transactions: PaystackTransaction[],
  level: SanitizationLevel = SanitizationLevel.STANDARD,
) {
  return ResourceSanitizer.sanitizeArray(transactions, {
    resourceType: ResourceType.TRANSACTION,
    level,
  });
}

/**
 * Helper to sanitize customer tool responses
 * Uses STANDARD level by default
 *
 * @param customers - Array of customers
 * @param level - Sanitization level (defaults to STANDARD)
 * @returns Array of sanitized customers
 */
export function sanitizeCustomers(
  customers: PaystackCustomer[],
  level: SanitizationLevel = SanitizationLevel.STANDARD,
) {
  return ResourceSanitizer.sanitizeArray(customers, {
    resourceType: ResourceType.CUSTOMER,
    level,
  });
}

/**
 * Helper to sanitize refund tool responses
 * Uses STANDARD level by default
 *
 * @param refunds - Array of refunds
 * @param level - Sanitization level (defaults to STANDARD)
 * @returns Array of sanitized refunds
 */
export function sanitizeRefunds(refunds: PaystackRefund[], level: SanitizationLevel = SanitizationLevel.STANDARD) {
  return ResourceSanitizer.sanitizeArray(refunds, {
    resourceType: ResourceType.REFUND,
    level,
  });
}

/**
 * Helper to sanitize payout tool responses
 * Uses STANDARD level by default
 *
 * @param payouts - Array of payouts
 * @param level - Sanitization level (defaults to STANDARD)
 * @returns Array of sanitized payouts
 */
export function sanitizePayouts(payouts: PaystackPayout[], level: SanitizationLevel = SanitizationLevel.STANDARD) {
  return ResourceSanitizer.sanitizeArray(payouts, {
    resourceType: ResourceType.PAYOUT,
    level,
  });
}

/**
 * Helper to sanitize dispute tool responses
 * Uses STANDARD level by default
 *
 * @param disputes - Array of disputes
 * @param level - Sanitization level (defaults to STANDARD)
 * @returns Array of sanitized disputes
 */
export function sanitizeDisputes(disputes: PaystackDispute[], level: SanitizationLevel = SanitizationLevel.STANDARD) {
  return ResourceSanitizer.sanitizeArray(disputes, {
    resourceType: ResourceType.DISPUTE,
    level,
  });
}
