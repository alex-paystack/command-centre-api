import type { ResourceFieldConfigs } from './types';
import { SanitizationLevel } from './types';
import { ResourceType } from '../types';
import type { PaystackTransaction, PaystackCustomer, PaystackRefund, PaystackPayout, PaystackDispute } from '../types';

/**
 * Transaction field configurations
 *
 * Current full structure has 30+ fields including:
 * - Nested customer (12+ fields)
 * - Nested authorization (15+ fields)
 * - Nested log with history array
 * - Nested plan, split, subaccount
 * - Metadata, fees_split, additional_charges
 */
export const TRANSACTION_FIELD_CONFIG: ResourceFieldConfigs<PaystackTransaction> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'reference', 'amount', 'currency', 'status', 'channel', 'createdAt'],
    nested: {
      customer: {
        fields: ['id', 'email'],
      },
    },
  },

  [SanitizationLevel.STANDARD]: {
    fields: [
      'id',
      'reference',
      'amount',
      'currency',
      'status',
      'channel',
      'gateway_response',
      'fees',
      'paid_at',
      'createdAt',
      'domain',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code', 'phone'],
      },
      authorization: {
        fields: ['authorization_code', 'bin', 'last4', 'bank', 'brand', 'card_type', 'channel'],
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: [
      'id',
      'reference',
      'amount',
      'requested_amount',
      'currency',
      'status',
      'channel',
      'gateway_response',
      'message',
      'fees',
      'paid_at',
      'createdAt',
      'domain',
      'ip_address',
      'receipt_number',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code', 'phone', 'first_name', 'last_name'],
      },
      authorization: {
        fields: ['authorization_code', 'bin', 'last4', 'bank', 'brand', 'card_type', 'channel', 'country_code'],
      },
      subaccount: {
        fields: ['id', 'subaccount_code', 'business_name'],
      },
    },
  },
};

/**
 * Customer field configurations
 *
 * Current full structure has 12+ fields with nested:
 * - Authorizations array (full authorization objects)
 * - Dedicated account object
 * - Metadata
 */
export const CUSTOMER_FIELD_CONFIG: ResourceFieldConfigs<PaystackCustomer> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'email', 'customer_code'],
  },

  [SanitizationLevel.STANDARD]: {
    fields: ['id', 'email', 'customer_code', 'first_name', 'last_name', 'phone', 'risk_action', 'createdAt'],
    nested: {
      authorizations: {
        fields: ['authorization_code', 'bin', 'last4', 'bank', 'brand'],
        arrayLimit: 3,
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: [
      'id',
      'email',
      'customer_code',
      'first_name',
      'last_name',
      'phone',
      'risk_action',
      'international_format_phone',
      'identified',
      'createdAt',
    ],
    nested: {
      authorizations: {
        fields: ['authorization_code', 'bin', 'last4', 'bank', 'brand', 'card_type', 'exp_month', 'exp_year'],
        arrayLimit: 5,
      },
      dedicated_account: {
        fields: ['id', 'account_name', 'account_number', 'bank', 'currency'],
      },
    },
  },
};

/**
 * Refund field configurations
 *
 * Current full structure has 25+ fields with nested:
 * - Customer object (full customer)
 * - Transaction references
 */
export const REFUND_FIELD_CONFIG: ResourceFieldConfigs<PaystackRefund> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'amount', 'currency', 'status', 'transaction_reference', 'refunded_at'],
  },

  [SanitizationLevel.STANDARD]: {
    fields: [
      'id',
      'amount',
      'currency',
      'status',
      'transaction_reference',
      'refunded_at',
      'refunded_by',
      'refund_type',
      'domain',
      'createdAt',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code'],
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: [
      'id',
      'amount',
      'transaction_amount',
      'deducted_amount',
      'currency',
      'status',
      'transaction_reference',
      'refunded_at',
      'refunded_by',
      'refund_type',
      'customer_note',
      'merchant_note',
      'reason',
      'domain',
      'createdAt',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code', 'phone', 'first_name', 'last_name'],
      },
    },
  },
};

/**
 * Payout field configurations
 *
 * Current full structure has 15+ fields with nested:
 * - Subaccount object (with extended contact fields)
 */
export const PAYOUT_FIELD_CONFIG: ResourceFieldConfigs<PaystackPayout> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'total_amount', 'currency', 'status', 'settlement_date'],
  },

  [SanitizationLevel.STANDARD]: {
    fields: [
      'id',
      'total_amount',
      'effective_amount',
      'currency',
      'status',
      'settlement_date',
      'settled_by',
      'total_fees',
      'total_processed',
      'domain',
      'createdAt',
    ],
    nested: {
      subaccount: {
        fields: ['id', 'subaccount_code', 'business_name', 'primary_contact_email'],
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: [
      'id',
      'total_amount',
      'effective_amount',
      'deductions',
      'currency',
      'status',
      'settlement_date',
      'settled_by',
      'total_fees',
      'total_processed',
      'domain',
      'createdAt',
      'updatedAt',
    ],
    nested: {
      subaccount: {
        fields: [
          'id',
          'subaccount_code',
          'business_name',
          'account_number',
          'settlement_bank',
          'primary_contact_email',
          'primary_contact_name',
        ],
      },
    },
  },
};

/**
 * Dispute field configurations
 *
 * Current full structure has 20+ fields with nested:
 * - Customer object (full customer)
 * - Transaction object (full transaction)
 * - History array
 * - Messages array
 */
export const DISPUTE_FIELD_CONFIG: ResourceFieldConfigs<PaystackDispute> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'refund_amount', 'currency', 'status', 'category', 'dueAt'],
  },

  [SanitizationLevel.STANDARD]: {
    fields: [
      'id',
      'refund_amount',
      'currency',
      'status',
      'resolution',
      'category',
      'transaction_reference',
      'dueAt',
      'resolvedAt',
      'domain',
      'createdAt',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code'],
      },
      transaction: {
        fields: ['id', 'reference', 'amount', 'currency', 'status', 'channel'],
      },
      history: {
        fields: ['status', 'by', 'createdAt'],
        arrayLimit: 5, // Last 5 history items
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: [
      'id',
      'refund_amount',
      'currency',
      'status',
      'resolution',
      'category',
      'transaction_reference',
      'bin',
      'last4',
      'dueAt',
      'resolvedAt',
      'note',
      'domain',
      'createdAt',
      'updatedAt',
    ],
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code', 'phone', 'first_name', 'last_name'],
      },
      transaction: {
        fields: ['id', 'reference', 'amount', 'currency', 'status', 'channel', 'gateway_response', 'paid_at'],
      },
      history: {
        fields: ['status', 'by', 'createdAt'],
        arrayLimit: 10,
      },
      messages: {
        fields: ['sender', 'body', 'createdAt'],
        arrayLimit: 5,
      },
    },
  },
};

/**
 * Central configuration map
 * Maps resource types to their field configurations
 */
export const RESOURCE_CONFIGS = {
  [ResourceType.TRANSACTION]: TRANSACTION_FIELD_CONFIG,
  [ResourceType.CUSTOMER]: CUSTOMER_FIELD_CONFIG,
  [ResourceType.REFUND]: REFUND_FIELD_CONFIG,
  [ResourceType.PAYOUT]: PAYOUT_FIELD_CONFIG,
  [ResourceType.DISPUTE]: DISPUTE_FIELD_CONFIG,
} as const;
