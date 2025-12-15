import { MessageClassificationIntent } from './types';

export const policy = {
  allowed: new Set<MessageClassificationIntent>([
    MessageClassificationIntent.DASHBOARD_INSIGHT,
    MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
    MessageClassificationIntent.ACCOUNT_HELP,
    MessageClassificationIntent.ASSISTANT_CAPABILITIES,
  ]),
  outOfScopeRefusalText:
    'I can only help with questions about your Paystack merchant dashboard (transactions, refunds, customers, disputes, payouts) and Paystack product usage. Ask me something like “What’s my revenue today?”',
  outOfPageScopeRefusalText:
    'I can only help with questions about this specific {{RESOURCE_TYPE}}. Ask me something like “What’s the status of this {{RESOURCE_TYPE}}?”',
};
