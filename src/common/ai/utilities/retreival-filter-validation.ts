const GENERIC_ALLOWED_FILTERS = ['perPage', 'page'] as const;

const DATE_ALLOWED_FILTERS = ['from', 'to'] as const;

export const TRANSACTION_ALLOWED_FILTERS = [
  ...GENERIC_ALLOWED_FILTERS,
  ...DATE_ALLOWED_FILTERS,
  'status',
  'channel',
  'customer',
  'amount',
  'currency',
  'subaccountCode',
] as const;

export const CUSTOMER_ALLOWED_FILTERS = [...GENERIC_ALLOWED_FILTERS, 'email', 'account_number'] as const;

export const REFUND_ALLOWED_FILTERS = [
  ...GENERIC_ALLOWED_FILTERS,
  ...DATE_ALLOWED_FILTERS,
  'status',
  'amount',
  'amount_operator',
  'transaction',
  'search',
] as const;

export const PAYOUT_ALLOWED_FILTERS = [
  ...GENERIC_ALLOWED_FILTERS,
  ...DATE_ALLOWED_FILTERS,
  'status',
  'subaccount',
  'id',
] as const;

export const DISPUTE_ALLOWED_FILTERS = [
  ...GENERIC_ALLOWED_FILTERS,
  ...DATE_ALLOWED_FILTERS,
  'status',
  'ignore_resolved',
  'transaction',
  'category',
  'resolution',
] as const;

export function findUnsupportedFilters(input: Record<string, unknown>, allowedFilters: readonly string[]) {
  return Object.keys(input).filter((key) => !allowedFilters.includes(key));
}

export function buildUnsupportedFilterError(
  resourceLabel: string,
  unsupportedFilters: string[],
  allowedFilters: readonly string[],
) {
  const plural = unsupportedFilters.length > 1;

  return {
    error: `The filter option${plural ? 's' : ''} ${unsupportedFilters.join(', ')} ${plural ? 'are' : 'is'} not available for ${resourceLabel}. Supported filters: ${allowedFilters.join(', ')}.`,
  };
}
