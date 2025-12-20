import { Tool } from 'ai';
import type { PaystackApiService } from '~/common/services/paystack-api.service';
import type { AuthenticatedUser, PageContextType } from '../types';
import { createGetTransactionsTool } from './retrieval';
import { createGetCustomersTool } from './retrieval';
import { createGetRefundsTool } from './retrieval';
import { createGetPayoutsTool } from './retrieval';
import { createGetDisputesTool } from './retrieval';
import { createGenerateChartDataTool } from './visualization';
import { createExportTransactionsTool } from './export';
import { createExportRefundsTool } from './export';
import { createExportPayoutsTool } from './export';
import { createExportDisputesTool } from './export';
import { LangfuseRuntime } from '~/common/observability/langfuse.runtime';

const wrapToolsWithLangfuse = (
  tools: Record<string, Tool<unknown, unknown>>,
): Record<string, Tool<unknown, unknown>> => {
  const entries = Object.entries(tools);
  const wrappedEntries = entries.map(([name, toolDef]) => {
    if (!toolDef.execute) {
      return [name, toolDef] as const;
    }
    return [name, { ...toolDef, execute: LangfuseRuntime.wrapToolExecute(name, toolDef.execute) }] as const;
  });
  return Object.fromEntries(wrappedEntries) as Record<string, Tool<unknown, unknown>>;
};

/**
 * Create AI tools with access to PaystackApiService
 * @param paystackService - The Paystack API service instance
 * @param getAuthenticatedUser - Function to retrieve the authenticated user
 */
export function createTools(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
): Record<string, Tool<unknown, unknown>> {
  const tools = {
    getTransactions: createGetTransactionsTool(paystackService, getAuthenticatedUser),
    getCustomers: createGetCustomersTool(paystackService, getAuthenticatedUser),
    getRefunds: createGetRefundsTool(paystackService, getAuthenticatedUser),
    getPayouts: createGetPayoutsTool(paystackService, getAuthenticatedUser),
    getDisputes: createGetDisputesTool(paystackService, getAuthenticatedUser),
    generateChartData: createGenerateChartDataTool(paystackService, getAuthenticatedUser),
    exportTransactions: createExportTransactionsTool(paystackService, getAuthenticatedUser),
    exportRefunds: createExportRefundsTool(paystackService, getAuthenticatedUser),
    exportDisputes: createExportDisputesTool(paystackService, getAuthenticatedUser),
    exportPayouts: createExportPayoutsTool(paystackService, getAuthenticatedUser),
  };
  return wrapToolsWithLangfuse(tools);
}

/**
 * Resource-specific tool mapping for page-scoped chat
 * Maps each resource type to the relevant tools for that context
 */
const RESOURCE_TOOL_MAP: Record<PageContextType, string[]> = {
  transaction: ['getCustomers', 'getRefunds', 'getDisputes'],
  customer: ['getTransactions', 'getRefunds', 'exportTransactions'],
  refund: ['getTransactions', 'getCustomers'],
  payout: ['getTransactions'],
  dispute: ['getTransactions', 'getCustomers', 'getRefunds'],
};

/**
 * Create page-scoped tools based on resource type
 * Returns a filtered set of tools relevant to the specific resource context
 * @param paystackService - The Paystack API service instance
 * @param getAuthenticatedUser - Function to retrieve the authenticated user
 * @param contextType - The type of resource context (transaction, customer, etc.)
 */
export function createPageScopedTools(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
  contextType: PageContextType,
): Record<string, Tool<unknown, unknown>> {
  const allTools = createTools(paystackService, getAuthenticatedUser);
  const allowedTools = RESOURCE_TOOL_MAP[contextType];
  const filteredEntries = Object.entries(allTools).filter(([name]) => allowedTools.includes(name));
  return Object.fromEntries(filteredEntries) as Record<string, Tool<unknown, unknown>>;
}
