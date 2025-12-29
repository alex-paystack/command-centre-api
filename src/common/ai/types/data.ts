enum CardBrand {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  VERVE = 'verve',
}

enum CustomerRiskAction {
  ALLOW = 'allow',
  DEFAULT = 'default',
  DENY = 'deny',
  BAN = 'ban',
}

enum PayoutStatus {
  SUCCESS = 'success',
  COMPUTING = 'computing',
  PENDING = 'pending',
  FAILED = 'failed',
  MANUALPROCESSING = 'manualprocessing',
  OPEN = 'open',
  PROCESSING = 'processing',
}

enum DisputeCategory {
  FRAUD = 'fraud',
  CHARGEBACK = 'chargeback',
}

enum DisputeStatusSlug {
  RESOLVED = 'resolved',
  AWAITING_MERCHANT_FEEDBACK = 'awaiting-merchant-feedback',
}

enum DisputeResolutionSlug {
  FRAUDULENT_RECOVERED = 'fraudulent-recovered',
  FRAUDULENT_LOST = 'fraudulent-lost',
  MERCHANT_ACCEPTED = 'merchant-accepted',
  AUTO_ACCEPTED = 'auto-accepted',
  PAYSTACK_ACCEPTED = 'paystack-accepted',
  DECLINED = 'declined',
  CONVERTED_TO_CHARGEBACK = 'converted-to-chargeback',
}

enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  KES = 'KES',
  ZAR = 'ZAR',
  GHS = 'GHS',
  XOF = 'XOF',
  EGP = 'EGP',
}

enum PlanInterval {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  BIANNUALLY = 'biannually',
  ANNUALLY = 'annually',
}

enum RefundStatus {
  PENDING = 'pending',
  FAILED = 'failed',
  PROCESSED = 'processed',
  PROCESSING = 'processing',
  RETRIABLE = 'retriable',
}

enum RefundType {
  FULL = 'full',
  PARTIAL = 'partial',
}

enum TransactionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
}

enum PaymentChannel {
  CARD = 'card',
  USSD = 'ussd',
  BANK = 'bank',
  QR = 'qr',
  EFT = 'eft',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_MONEY = 'mobile_money',
  DIRECT_DEBIT = 'direct_debit',
  DEBIT_ORDER = 'debit_order',
  PAYATTITUDE = 'payattitude',
  APPLE_PAY = 'apple_pay',
  PAYPAL = 'paypal',
  PREAUTH = 'preauth',
  CAPITEC_PAY = 'capitec_pay',
}

type Authorization = {
  authorization_code: string;
  bin: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  channel: string;
  card_type: string;
  bank: string;
  country_code: string;
  brand: CardBrand;
  reusable: number | boolean;
  signature: string;
  account_name?: string | null;
  narration?: string;
  sender_name?: string;
  sender_bank?: string;
  sender_bank_account_number?: string;
  receiver_bank_account_number?: string;
  receiver_bank?: string;
  mobile_money_number?: string;
};

type CustomerMetaData = {
  calling_code?: string;
  subscriber_number?: string;
};

type Assignment = {
  account_type: string;
  assignee_id: number;
  assignee_type: string;
  integration: number;
};

type SplitConfigSubaccount = {
  share: number;
  subaccount: {
    account_number: string;
    business_name: string;
    currency: string;
    description: string;
    id: number;
    metadata: null;
    primary_contact_email: string | null;
    primary_contact_name: string | null;
    primary_contact_phone: string | null;
    settlement_bank: string;
    subaccount_code: string;
  };
};

type SplitConfig = {
  active: boolean;
  bearer_subaccount: number | null;
  bearer_type: string;
  createdAt: string;
  currency: Currency;
  domain: string;
  id: number;
  integration: number;
  is_dynamic: boolean;
  name: string;
  split_code: string;
  subaccounts: SplitConfigSubaccount[];
  total_subaccounts: number;
  type: string;
  updatedAt: string;
};

type CustomerDedicatedAccount = {
  bank: {
    name: string;
    id: number;
    slug: string;
  };
  id: number;
  account_name: string;
  account_number: string;
  created_at: string;
  updated_at: string;
  currency: Currency;
  split_config: SplitConfig | null;
  active: boolean;
  assigned: boolean;
  assignment: Assignment;
};

type TransactionAdditionalCharge = {
  amount: number;
  currency: string;
  formula: string;
  source: string;
  status: string;
};

type TransactionFeesSplit = {
  integration: number;
  subaccount: number;
  paystack: number;
};

type Plan = {
  amount: number;
  currency: string;
  description: string | null;
  id: number;
  interval: PlanInterval;
  name: string;
  plan_code: string;
  send_invoices: boolean;
  send_sms: boolean;
};

type Split = {
  id: number;
  name: string;
  split_code: string;
  shares: {
    integration: number;
    paystack: number;
    subaccounts: Array<{
      id: number;
      amount: number;
      subaccount_code: string;
    }>;
  };
};

type Subaccount = {
  id: number;
  integration?: number;
  domain?: string;
  active: boolean;
  currency: string | null;
  metadata?: string;
  description: string;
  business_name: string;
  account_number: string;
  subaccount_code: string;
  bank_id: number;
  branch_code: string;
  is_verified: boolean;
  settlement_bank: number | string;
  settlement_schedule?: string;
  percentage_charge: number;
  migrate?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type TransactionCoupon = {
  id: number;
  code: string;
};

type Log = {
  start_time: number;
  time_spent: number;
  attempts: number;
  authentication: string;
  errors: number;
  success: boolean;
  mobile: boolean;
  input: unknown[];
  history: TransactionLogHistory[];
};

type TransactionLogHistory = {
  type: string;
  message: string;
  time: number;
};

type CustomFields = {
  variable_name: string;
  display_name: string;
  value: string | boolean | number;
};

type Metadata = {
  referrer?: string;
  num_days_tracked?: number;
  custom_fields: CustomFields[];
  status_reason?: string[];
};

type DisputeMessage = {
  sender: string;
  body: string;
  createdAt: string;
};

type DisputeHistoryItem = {
  status: string;
  by: string;
  createdAt: string;
};

type PaypalDispute = {
  created_at: string;
  dispute_channel: string;
  dispute_life_cycle_stage: string;
  is_urgent: boolean;
  paypal_created_at: string;
  paypal_dispute_id: string;
  paypal_status: string;
  seller_response_due_date: string;
  seller_transaction_id: string;
  updated_at: string;
};

export {
  CardBrand,
  CustomerRiskAction,
  RefundStatus,
  RefundType,
  TransactionStatus,
  Authorization,
  CustomerMetaData,
  Assignment,
  SplitConfigSubaccount,
  SplitConfig,
  CustomerDedicatedAccount,
  PaymentChannel,
  TransactionAdditionalCharge,
  TransactionFeesSplit,
  Plan,
  Split,
  Subaccount,
  TransactionCoupon,
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
};
