// TODO: Make types more specific

/**
 * Paystack Transaction status
 */
export type TransactionStatus = 'success' | 'failed' | 'abandoned';

/**
 * Paystack Transaction response
 */
export interface PaystackTransaction {
  id: number;
  domain: string;
  status: TransactionStatus;
  reference: string;
  amount: number;
  message: string | null;
  gateway_response: string;
  paid_at: string | null;
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  fees: number | null;
  customer: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    customer_code: string;
    phone: string | null;
    metadata: Record<string, unknown> | null;
    risk_action: string;
  };
  authorization: {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    channel: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    reusable: boolean;
    signature: string;
    account_name: string | null;
  } | null;
  plan?: unknown;
  subaccount?: unknown;
  split?: unknown;
  order_id: string | null;
  paidAt?: string | null;
  createdAt?: string;
  requested_amount?: number;
  transaction_date?: string;
}

/**
 * Paystack Customer response
 */
export interface PaystackCustomer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  customer_code: string;
  phone: string | null;
  metadata: Record<string, unknown> | null;
  risk_action: string;
  international_format_phone: string | null;
  integration: number;
  domain: string;
  identified: boolean;
  identifications: Array<Record<string, unknown>> | null;
  createdAt: string;
  updatedAt: string;
  total_transactions: number;
  total_transaction_value: Array<{
    currency: string;
    amount: number;
  }>;
  dedicated_account: Record<string, unknown> | null;
}

/**
 * Paystack Refund response
 */
export interface PaystackRefund {
  id: number;
  integration: number;
  domain: string;
  transaction: number;
  dispute: number | null;
  amount: number;
  currency: string;
  status: string;
  refunded_by: string;
  refunded_at: string;
  expected_at: string;
  settlement: number | null;
  customer_note: string | null;
  merchant_note: string | null;
  deducted_amount: number;
  fully_deducted: boolean;
  createdAt: string;
  updatedAt: string;
}
