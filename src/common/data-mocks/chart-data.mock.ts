import { PaystackCustomer, PaystackTransaction, PaystackRefund, PaystackPayout, PaystackDispute } from '../ai/types';
import { AggregationType, ChartResourceType } from '../ai/chart-config';
import {
  Authorization,
  CardBrand,
  Currency,
  CustomerRiskAction,
  DisputeCategory,
  DisputeResolutionSlug,
  DisputeStatusSlug,
  Log,
  Metadata,
  PaymentChannel,
  PayoutStatus,
  RefundStatus,
  RefundType,
  Subaccount,
  TransactionStatus,
} from '../ai/types/data';

/**
 * Helper utilities for generating predictable, diverse mock data that still
 * looks interesting when charted (varied currencies, statuses, and dates).
 */
// Anchor dates close to Dec 2025 so charts match typical dashboard ranges
const baseEpoch = Date.UTC(2025, 11, 1); // Dec 01, 2025 UTC

const dateAt = (offsetDays: number, hour = 10): string =>
  new Date(baseEpoch + offsetDays * 86_400_000 + hour * 3_600_000).toISOString();

const makeAuthorization = (idx: number, currency: Currency): Authorization => ({
  authorization_code: `AUTH_${9000 + idx}`,
  bin: `${408408 + idx}`,
  last4: `${1000 + (idx % 9000)}`.slice(-4),
  exp_month: `${((idx % 12) + 1).toString().padStart(2, '0')}`,
  exp_year: `${2026 + (idx % 3)}`,
  channel: 'card',
  card_type: 'credit',
  bank: 'Mock Bank',
  country_code: currency === Currency.USD ? 'US' : 'NG',
  brand: idx % 3 === 0 ? CardBrand.VISA : idx % 3 === 1 ? CardBrand.MASTERCARD : CardBrand.VERVE,
  reusable: true,
  signature: `SIG_${8200 + idx}`,
});

const makeLog = (idx: number): Log => ({
  start_time: 1_700_000_000 + idx * 11,
  time_spent: 2500 + idx * 7,
  attempts: 1 + (idx % 2),
  authentication: idx % 3 === 0 ? 'pin' : 'otp',
  errors: idx % 7 === 0 ? 1 : 0,
  success: idx % 7 !== 0,
  mobile: idx % 2 === 0,
  input: [],
  history: [
    { type: 'attempt', message: 'auth', time: 1 },
    ...(idx % 4 === 0 ? [{ type: 'risk', message: 'fraud_check', time: 2 }] : []),
  ],
});

const makeMetadata = (idx: number): Metadata => ({
  referrer: idx % 4 === 0 ? 'adwords' : 'organic',
  num_days_tracked: 28 + idx,
  custom_fields: [
    { variable_name: 'segment', display_name: 'Segment', value: idx % 2 === 0 ? 'pro' : 'starter' },
    { variable_name: 'device', display_name: 'Device', value: idx % 3 === 0 ? 'web' : 'mobile' },
  ],
  status_reason: idx % 6 === 0 ? ['issuer_declined'] : undefined,
});

const makeSubaccount = (idx: number, currency: Currency): Subaccount => ({
  id: 7100 + idx,
  active: true,
  currency,
  metadata: '{"tier":"gold"}',
  description: `Ops settlement bucket ${idx}`,
  business_name: `Growth Hub ${idx}`,
  account_number: `0099${(200 + idx).toString().slice(-3)}`,
  subaccount_code: `SUB_${7100 + idx}`,
  bank_id: 999,
  branch_code: '001',
  is_verified: idx % 5 !== 0,
  settlement_bank: 'Mock Bank',
  percentage_charge: 15 + (idx % 5),
});

/**
 * Customers shared across all resource mocks
 */
export const chartMockCustomers: PaystackCustomer[] = [
  {
    id: 9001,
    first_name: 'Tolu',
    last_name: 'Adeyemi',
    email: 'tolu.adeyemi@customer.test',
    customer_code: 'CUS_CHART_9001',
    phone: '+2348130010001',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+234 813 001 0001',
    identified: true,
    createdAt: dateAt(0, 9),
    authorizations: [makeAuthorization(1, Currency.NGN)],
  },
  {
    id: 9002,
    first_name: 'Nia',
    last_name: 'Okoro',
    email: 'nia.okoro@customer.test',
    customer_code: 'CUS_CHART_9002',
    phone: '+254711200002',
    risk_action: CustomerRiskAction.DEFAULT,
    international_format_phone: '+254 711 200 002',
    identified: true,
    createdAt: dateAt(1, 11),
  },
  {
    id: 9003,
    first_name: 'Kwame',
    last_name: 'Boateng',
    email: 'kwame.boateng@customer.test',
    customer_code: 'CUS_CHART_9003',
    phone: '+233240030003',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+233 240 030 003',
    identified: true,
    createdAt: dateAt(2, 8),
    authorizations: [makeAuthorization(2, Currency.GHS)],
  },
  {
    id: 9004,
    first_name: 'Aisha',
    last_name: 'Mahmoud',
    email: 'aisha.mahmoud@customer.test',
    customer_code: 'CUS_CHART_9004',
    phone: '+201050040004',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+20 105 004 0004',
    identified: true,
    createdAt: dateAt(3, 15),
  },
  {
    id: 9005,
    first_name: 'Lerato',
    last_name: 'Mokoena',
    email: 'lerato.mokoena@customer.test',
    customer_code: 'CUS_CHART_9005',
    phone: '+27821234567',
    risk_action: CustomerRiskAction.DENY,
    international_format_phone: '+27 82 123 4567',
    identified: false,
    createdAt: dateAt(4, 17),
  },
  {
    id: 9006,
    first_name: 'James',
    last_name: 'Owens',
    email: 'james.owens@customer.test',
    customer_code: 'CUS_CHART_9006',
    phone: '+14155550006',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+1 415 555 0006',
    identified: true,
    createdAt: dateAt(5, 10),
    authorizations: [makeAuthorization(6, Currency.USD)],
  },
  {
    id: 9007,
    first_name: 'Fatou',
    last_name: 'Ndiaye',
    email: 'fatou.ndiaye@customer.test',
    customer_code: 'CUS_CHART_9007',
    phone: '+221701230007',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+221 70 123 0007',
    identified: true,
    createdAt: dateAt(6, 13),
  },
  {
    id: 9008,
    first_name: 'Zain',
    last_name: 'Hassan',
    email: 'zain.hassan@customer.test',
    customer_code: 'CUS_CHART_9008',
    phone: '+234906000008',
    risk_action: CustomerRiskAction.BAN,
    international_format_phone: '+234 906 000 0008',
    identified: false,
    createdAt: dateAt(7, 16),
  },
  {
    id: 9009,
    first_name: 'Imani',
    last_name: 'Kamau',
    email: 'imani.kamau@customer.test',
    customer_code: 'CUS_CHART_9009',
    phone: '+254733090009',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+254 733 090 009',
    identified: true,
    createdAt: dateAt(8, 9),
  },
  {
    id: 9010,
    first_name: 'Musa',
    last_name: 'Lawal',
    email: 'musa.lawal@customer.test',
    customer_code: 'CUS_CHART_9010',
    phone: '+2348141000010',
    risk_action: CustomerRiskAction.DEFAULT,
    international_format_phone: '+234 814 100 0010',
    identified: true,
    createdAt: dateAt(9, 12),
  },
  {
    id: 9011,
    first_name: 'Sara',
    last_name: 'Okoye',
    email: 'sara.okoye@customer.test',
    customer_code: 'CUS_CHART_9011',
    phone: '+2348181100011',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+234 818 110 0011',
    identified: true,
    createdAt: dateAt(10, 7),
    authorizations: [makeAuthorization(11, Currency.NGN)],
  },
  {
    id: 9012,
    first_name: 'Theo',
    last_name: 'van Rooyen',
    email: 'theo.rooyen@customer.test',
    customer_code: 'CUS_CHART_9012',
    phone: '+27830000012',
    risk_action: CustomerRiskAction.ALLOW,
    international_format_phone: '+27 83 000 0012',
    identified: true,
    createdAt: dateAt(11, 18),
  },
];

const currencies = [Currency.NGN, Currency.GHS, Currency.KES];

// const transactionStatuses = [
//   TransactionStatus.SUCCESS,
//   TransactionStatus.FAILED,
//   TransactionStatus.ABANDONED,
// ];

/**
 * 30 transactions with overlapping days, mixed currencies (NGN/GHS/KES),
 * varied statuses, and non-linear amounts to create more interesting charts.
 */
const dayOffsets = [
  0, 0, 1, 1, 2, 3, 3, 4, 6, 6, 6, 7, 8, 9, 10, 12, 12, 13, 14, 15, 16, 18, 19, 20, 22, 24, 25, 26, 28, 29,
];

const channelOptions = [
  PaymentChannel.CARD,
  PaymentChannel.USSD,
  PaymentChannel.BANK_TRANSFER,
  PaymentChannel.MOBILE_MONEY,
  PaymentChannel.QR,
  PaymentChannel.APPLE_PAY,
];

const currencyWave = [
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
  Currency.KES,
  Currency.NGN,
  Currency.GHS,
];

const statusWave = [
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.ABANDONED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.SUCCESS,
  TransactionStatus.ABANDONED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.ABANDONED,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.ABANDONED,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.ABANDONED,
  TransactionStatus.SUCCESS,
  TransactionStatus.SUCCESS,
  TransactionStatus.FAILED,
  TransactionStatus.SUCCESS,
];

export const chartMockTransactions: PaystackTransaction[] = Array.from({ length: 30 }, (_, idx) => {
  const currency = currencyWave[idx];
  const status = statusWave[idx];
  const channel = channelOptions[idx % channelOptions.length];
  const amount = (400 + (idx % 9) * 55 + (idx % 4 === 0 ? 120 : 0) + (idx % 7 === 0 ? 80 : 0)) * 100; // subunits
  const createdAt = dateAt(dayOffsets[idx], 8 + (idx % 6));
  const customer = chartMockCustomers[idx % chartMockCustomers.length];

  return {
    additional_charges:
      idx % 6 === 0 ? [{ amount: 1500, currency, formula: 'vat', source: 'tax', status: 'applied' }] : undefined,
    amount,
    authorization: makeAuthorization(idx + 20, currency),
    channel,
    coupon: idx % 9 === 0 ? { id: 7000 + idx, code: `PROMO${idx}` } : undefined,
    created_at: createdAt,
    createdAt,
    currency,
    customer,
    domain: idx % 2 === 0 ? 'test' : 'live',
    fees: Math.round(amount * 0.017),
    fees_split: idx % 7 === 0 ? { integration: 70, subaccount: 20, paystack: 10 } : undefined,
    gateway_response:
      status === TransactionStatus.SUCCESS
        ? 'Approved'
        : status === TransactionStatus.ABANDONED
          ? 'Abandoned'
          : 'Declined',
    id: 5000 + idx,
    ip_address: `102.88.0.${10 + idx}`,
    ip_address_geo: idx % 4 === 0 ? { city: 'Lagos', country: 'Nigeria', regionName: 'LA' } : undefined,
    log: makeLog(idx),
    receipt_number: `RCPT-${2025 + Math.floor(idx / 12)}-${100 + idx}`,
    message: status === TransactionStatus.FAILED ? 'Insufficient funds' : null,
    metadata: makeMetadata(idx),
    order_id: idx % 5 === 0 ? 90_000 + idx : undefined,
    paid_at: createdAt,
    paidAt: createdAt,
    plan: {},
    pos_transaction_data:
      idx % 5 === 0 ? { rrn: 100_000 + idx, stan: `ST${idx}`, terminal_id: `TID${1000 + idx}` } : undefined,
    reference: `TRX-${dateAt(0).slice(0, 10).replace(/-/g, '')}-${idx}`,
    requested_amount: amount,
    split: {},
    status,
    status_reasons: status !== TransactionStatus.SUCCESS ? ['issuer_declined'] : undefined,
    subaccount: makeSubaccount(idx, currency),
    text: undefined,
    preauthorization_reference: idx % 9 === 0 ? `PREAUTH-${idx}` : undefined,
  };
});

const refundStatuses = [RefundStatus.PROCESSED, RefundStatus.PROCESSING, RefundStatus.PENDING, RefundStatus.FAILED];

/**
 * 30 refunds mapped from the transactions with mixed types and outcomes
 */
export const chartMockRefunds: PaystackRefund[] = chartMockTransactions.map((transaction, idx) => {
  const status = refundStatuses[idx % refundStatuses.length];
  const refund_type = idx % 2 === 0 ? RefundType.PARTIAL : RefundType.FULL;
  const amount = Math.round(transaction.amount * (idx % 2 === 0 ? 0.55 : 1));
  const refunded_at = dateAt(idx + 1, 12);

  return {
    id: 7200 + idx,
    integration: 8800 + idx,
    domain: transaction.domain as 'live' | 'test',
    currency: transaction.currency,
    transaction: transaction.id,
    amount,
    status,
    dispute: idx % 6 === 0 ? 4000 + idx : null,
    refunded_at,
    refunded_by: idx % 3 === 0 ? 'ops@paystack.com' : 'automation',
    customer_note: idx % 4 === 0 ? 'Duplicate charge' : undefined,
    merchant_note: idx % 5 === 0 ? 'Goodwill refund' : undefined,
    createdAt: refunded_at,
    transaction_reference: transaction.reference,
    deducted_amount: `${Math.round(amount * 0.02)}`,
    fully_deducted: refund_type === RefundType.FULL ? 1 : 0,
    bank_reference: `BANKREF-${transaction.id}`,
    settlement: idx % 5 === 0 ? 10_000 + idx : undefined,
    reason: refund_type === RefundType.FULL ? 'Service disruption' : 'Partial fulfilment',
    refund_type,
    transaction_amount: transaction.amount,
    retriable: status === RefundStatus.FAILED,
    customer: transaction.customer,
    initiated_by: idx % 2 === 0 ? 'customer' : 'merchant',
    refund_channel: idx % 3 === 0 ? 'card' : 'bank',
    session_id: `session-${idx}`,
  };
});

const payoutStatuses = [
  PayoutStatus.SUCCESS,
  PayoutStatus.PROCESSING,
  PayoutStatus.PENDING,
  PayoutStatus.FAILED,
  PayoutStatus.OPEN,
  PayoutStatus.COMPUTING,
];

/**
 * 30 payouts with staggered dates and varied currencies/statuses
 */
export const chartMockPayouts: PaystackPayout[] = Array.from({ length: 30 }, (_, idx) => {
  const currency = currencies[(idx + 1) % currencies.length];
  const status = payoutStatuses[idx % payoutStatuses.length];
  const total_amount = (800 + idx * 35) * 100;
  const total_fees = Math.round(total_amount * 0.008 + (idx % 3) * 120);
  const deductions = total_fees + (idx % 2 === 0 ? 1500 : 950);
  const total_processed = total_amount - deductions;
  const createdAt = dateAt(idx, 7);

  return {
    createdAt,
    currency,
    deductions,
    domain: idx % 2 === 0 ? 'live' : 'test',
    effective_amount: status === PayoutStatus.SUCCESS ? total_processed - 500 : undefined,
    id: 8400 + idx,
    integration: 9900 + idx,
    settled_by: idx % 3 === 0 ? 'api' : 'dashboard',
    settlement_date: dateAt(idx + 2, 9),
    status,
    total_amount,
    total_fees,
    total_processed,
    updatedAt: dateAt(idx + 1, 8),
    subaccount: {
      ...makeSubaccount(idx + 50, currency),
      primary_contact_email: `ops+${idx}@merchant.test`,
      primary_contact_name: `Ops Contact ${idx}`,
      primary_contact_phone: `+234810000${String(100 + idx).slice(-3)}`,
    },
  };
});

const disputeResolutions = [
  DisputeResolutionSlug.MERCHANT_ACCEPTED,
  DisputeResolutionSlug.DECLINED,
  DisputeResolutionSlug.AUTO_ACCEPTED,
  DisputeResolutionSlug.CONVERTED_TO_CHARGEBACK,
  DisputeResolutionSlug.FRAUDULENT_RECOVERED,
  null,
];

const disputeCategories = [DisputeCategory.FRAUD, DisputeCategory.CHARGEBACK];

/**
 * 30 disputes referencing the transactions, giving rich category/resolution mixes
 */
export const chartMockDisputes: PaystackDispute[] = chartMockTransactions.map((transaction, idx) => {
  const status = idx % 2 === 0 ? DisputeStatusSlug.RESOLVED : DisputeStatusSlug.AWAITING_MERCHANT_FEEDBACK;
  const resolution = status === DisputeStatusSlug.RESOLVED ? disputeResolutions[idx % disputeResolutions.length] : null;
  const createdAt = dateAt(idx, 6);
  const refund_amount = Math.round(transaction.amount * (0.25 + (idx % 5) * 0.1));

  return {
    id: 8800 + idx,
    refund_amount,
    currency: transaction.currency as Currency,
    status,
    resolution,
    domain: idx % 2 === 0 ? 'test' : 'live',
    transaction,
    transaction_reference: transaction.reference,
    paypal_dispute: null,
    category: disputeCategories[idx % disputeCategories.length],
    customer: transaction.customer,
    bin: transaction.authorization.bin,
    last4: transaction.authorization.last4,
    dueAt: dateAt(idx + 5, 6),
    resolvedAt: status === DisputeStatusSlug.RESOLVED ? dateAt(idx + 8, 6) : dateAt(idx + 3, 6),
    evidence: null,
    attachments: idx % 4 === 0 ? `https://mock-bucket/disputes/${idx}/evidence.pdf` : null,
    note: idx % 3 === 0 ? 'Customer claims double charge' : null,
    history: [
      { status: 'opened', by: 'paystack', createdAt },
      { status: 'review', by: 'merchant', createdAt: dateAt(idx + 2, 5) },
      { status, by: status === DisputeStatusSlug.RESOLVED ? 'paystack' : 'issuer', createdAt: dateAt(idx + 4, 4) },
    ],
    messages: [
      { sender: 'customer', body: 'I did not authorize this payment', createdAt },
      { sender: 'merchant', body: 'We are investigating', createdAt: dateAt(idx + 1, 5) },
    ],
    createdAt,
    updatedAt: dateAt(idx + 9, 7),
  };
});

/**
 * Convenience bundle for consumers to grab everything at once.
 */
export const chartMockDataBank = {
  customers: chartMockCustomers,
  transactions: chartMockTransactions,
  refunds: chartMockRefunds,
  payouts: chartMockPayouts,
  disputes: chartMockDisputes,
};

/**
 * Quick hints for agent writers about what works well when charted
 */
export const chartMockMetadata = {
  availableResourceTypes: [
    ChartResourceType.TRANSACTION,
    ChartResourceType.REFUND,
    ChartResourceType.PAYOUT,
    ChartResourceType.DISPUTE,
  ],
  suggestedAggregations: [
    AggregationType.BY_DAY,
    AggregationType.BY_WEEK,
    AggregationType.BY_STATUS,
    AggregationType.BY_CATEGORY,
    AggregationType.BY_TYPE,
    AggregationType.BY_RESOLUTION,
  ],
};
