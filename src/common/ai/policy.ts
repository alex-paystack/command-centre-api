import { MessageClassificationIntent } from './types';

export const policy = {
  allowed: new Set<MessageClassificationIntent>([
    MessageClassificationIntent.DASHBOARD_INSIGHT,
    MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
    MessageClassificationIntent.ACCOUNT_HELP,
  ]),
  refusalText:
    'I can only help with questions about your Paystack merchant dashboard (transactions, refunds, customers, disputes, payouts) and Paystack product usage. Ask me something like “What’s my revenue today?”',
};
