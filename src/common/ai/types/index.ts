import { UIMessage } from 'ai';
import {
  CustomerRiskAction,
  RefundStatus,
  RefundType,
  TransactionStatus,
  Authorization,
  CustomerMetaData,
  CustomerDedicatedAccount,
  PaymentChannel,
  TransactionAdditionalCharge,
  TransactionCoupon,
  TransactionFeesSplit,
  Plan,
  Split,
  Subaccount,
  Log,
  Metadata,
  DisputeStatusSlug,
  DisputeResolutionSlug,
  DisputeCategory,
  DisputeMessage,
  DisputeHistoryItem,
  PaypalDispute,
  Currency,
  PayoutStatus,
} from './data';

export enum MessageClassificationIntent {
  DASHBOARD_INSIGHT = 'DASHBOARD_INSIGHT',
  PAYSTACK_PRODUCT_FAQ = 'PAYSTACK_PRODUCT_FAQ',
  ACCOUNT_HELP = 'ACCOUNT_HELP',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

export enum ChatResponseType {
  CHAT_RESPONSE = 'CHAT_RESPONSE',
  REFUSAL = 'REFUSAL',
}

export type ClassificationUIMessage = UIMessage<
  never,
  {
    refusal: {
      text: string;
    };
    clarification: {
      text: string;
    };
  }
>;

/**
 * Paystack Customer object
 */
export interface PaystackCustomer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  customer_code: string;
  phone: string;
  metadata?: CustomerMetaData;
  risk_action: CustomerRiskAction;
  international_format_phone?: string;
  identified?: boolean;
  createdAt?: string;
  authorizations?: Authorization[];
  dedicated_account?: null | CustomerDedicatedAccount;
}

/**
 * Paystack Refund object
 */
export interface PaystackRefund {
  id: number;
  integration: number;
  domain: 'live' | 'test';
  currency: string;
  transaction: number;
  amount: number;
  status: RefundStatus;
  dispute: number | null;
  refunded_at: string;
  refunded_by: string;
  customer_note?: string;
  merchant_note?: string;
  createdAt: string;
  transaction_reference: string;
  deducted_amount: string;
  fully_deducted: number;
  bank_reference: string;
  settlement?: number;
  reason?: string;
  refund_type: RefundType;
  transaction_amount: number;
  retriable: boolean;
  customer: PaystackCustomer;
  initiated_by?: string;
  refund_channel?: string;
  session_id?: string;
}

/**
 * Paystack Transaction object
 */
export interface PaystackTransaction {
  additional_charges?: TransactionAdditionalCharge[];
  amount: number;
  authorization: Authorization;
  channel: PaymentChannel;
  coupon?: TransactionCoupon;
  created_at: string;
  createdAt: string;
  currency: string;
  customer: PaystackCustomer;
  domain: string;
  fees: number;
  fees_split?: TransactionFeesSplit | null;
  gateway_response: string;
  id: number;
  ip_address: string | null;
  ip_address_geo?: {
    city: string;
    country: string;
    regionName: string;
  };
  log: Log;
  receipt_number: string;
  message: string | null;
  metadata: Metadata;
  order_id?: number;
  paid_at: string;
  paidAt: string;
  plan?: Plan | Record<string, never>;
  pos_transaction_data?: {
    rrn?: number;
    stan?: string;
    terminal_id?: string;
  };
  reference: string;
  requested_amount: number;
  split?: Split | Record<string, never>;
  status: TransactionStatus;
  status_reasons?: string[];
  subaccount: Subaccount | Record<string, never>;
  text?: string;
  preauthorization_reference?: string;
}

/**
 * Paystack Dispute object
 */
export interface PaystackDispute {
  id: number;
  refund_amount: number;
  currency: Currency;
  status: DisputeStatusSlug;
  resolution: DisputeResolutionSlug | null;
  domain: 'live' | 'test';
  transaction: PaystackTransaction;
  transaction_reference: string | null;
  paypal_dispute?: PaypalDispute | null;
  category: DisputeCategory;
  customer: PaystackCustomer;
  bin: string | null;
  last4: string | null;
  dueAt: string;
  resolvedAt: string;
  evidence: null;
  attachments: string | null;
  note: string | null;
  history: DisputeHistoryItem[];
  messages: DisputeMessage[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Paystack Payout object
 */
export interface PaystackPayout {
  createdAt: string;
  currency: string;
  deductions: number;
  domain: 'live' | 'test';
  effective_amount?: number;
  id: number;
  integration: number;
  settled_by: string;
  settlement_date: string;
  status: PayoutStatus;
  total_amount: number;
  total_fees: number;
  total_processed: number;
  updatedAt: string;
  subaccount: Subaccount & {
    primary_contact_email: string;
    primary_contact_name: string;
    primary_contact_phone: string;
  };
}
