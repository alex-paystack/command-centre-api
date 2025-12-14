import { MessageClassificationIntent } from './types';

export const policy = {
  allowed: new Set<MessageClassificationIntent>([
    MessageClassificationIntent.DASHBOARD_INSIGHT,
    MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
    MessageClassificationIntent.ACCOUNT_HELP,
    MessageClassificationIntent.ASSISTANT_CAPABILITIES,
  ]),
  refusalText:
    'I can only help with questions about your Paystack merchant dashboard (transactions, refunds, customers, disputes, payouts) and Paystack product usage. Ask me something like “What’s my revenue today?”',
  assistantCapabilitiesText: `I can assist you with various aspects of your payment operations through Paystack, focusing on the following areas:

1. **Fetch Transaction Data:** I can retrieve detailed transaction information, including status (success, failed, abandoned), payment channels, and amounts.
2. **Customer Information:** If you need insights about your customers, I can provide data on customer behavior, transaction history, and other relevant metrics.
3. **Refund Management:** I can check the status of refunds, analyze refund patterns, and retrieve details on specific refunds.
4. **Payout Information:** I can provide details on payouts, including their status and processing timelines.
5. **Dispute Management:** I can fetch information on disputes or chargebacks and their current statuses.
6. **Trend Visualization:** I can generate visual data (charts) to help you understand your revenue trends, transaction patterns, and distribution by status.

If you have a specific query or need data analysis, feel free to ask!`,
};
