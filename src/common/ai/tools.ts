import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../services/paystack-api.service';
import type { PaystackTransaction, PaystackCustomer, PaystackRefund } from './types';

/**
 * Create the getTransactions tool
 */
export function createGetTransactionsTool(paystackService: PaystackApiService, getJwtToken: () => string | undefined) {
  return tool({
    description:
      'Fetch transaction data from Paystack. Use this to get payment transactions, check transaction status, analyze payment patterns, or retrieve transaction details. Supports filtering by date range, status, and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of transactions per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering transactions (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering transactions (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum(['success', 'failed', 'abandoned'])
        .optional()
        .describe('Filter by transaction status: success, failed, or abandoned'),
      channel: z
        .array(z.enum(['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer']))
        .optional()
        .describe('Filter by transaction channels: card, bank, ussd, mobile_money, or bank_transfer'),
      customer: z
        .string()
        .optional()
        .describe('Filter by the `id` field of the customer object, not the customer code'),
      amount: z.number().optional().describe('Filter by amount'),
      currency: z.string().optional().describe('Filter by currency'),
    }),
    execute: async ({ perPage, page, from, to, status, channel, customer, amount, currency }) => {
      const jwtToken = getJwtToken();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage,
          page,
          reduced_fields: true,
          ...(channel ? { channel } : {}),
          ...(customer ? { customer } : {}),
          ...(status ? { status } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(amount ? { amount } : {}),
          ...(currency ? { currency } : {}),
        };

        const response = await paystackService.get<PaystackTransaction[]>('/transaction', jwtToken, params);

        return {
          success: true,
          transactions: response.data,
          meta: response.meta,
          message: `Retrieved ${response.data.length} transaction(s)`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch transactions',
        };
      }
    },
  });
}

/**
 * Create the getCustomers tool
 */
export function createGetCustomersTool(paystackService: PaystackApiService, getJwtToken: () => string | undefined) {
  return tool({
    description:
      'Fetch customer data from Paystack. Use this to get customer information, analyze customer behavior, check customer transaction history, or retrieve customer details. Supports filtering by date range and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of customers per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      email: z.string().optional().describe('Filter by email'),
      account_number: z.string().optional().describe('Filter by account number'),
    }),
    execute: async ({ perPage, page, email, account_number }) => {
      const jwtToken = getJwtToken();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage,
          page,
          ...(email ? { email } : {}),
          ...(account_number ? { account_number } : {}),
        };

        const response = await paystackService.get<PaystackCustomer[]>('/customer', jwtToken, params);

        return {
          success: true,
          customers: response.data,
          meta: response.meta,
          message: `Retrieved ${response.data.length} customer(s)`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch customers',
        };
      }
    },
  });
}

/**
 * Create the getRefunds tool
 */
export function createGetRefundsTool(paystackService: PaystackApiService, getJwtToken: () => string | undefined) {
  return tool({
    description:
      'Fetch refund data from Paystack. Use this to get refund information, check refund status, analyze refund patterns, or retrieve refund details. Supports filtering by date range, transaction reference, and pagination.',
    inputSchema: z.object({
      status: z
        .enum(['pending', 'failed', 'processed', 'processing', 'retriable'])
        .optional()
        .describe('Filter by refund status'),
      perPage: z.number().optional().default(50).describe('Number of refunds per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering refunds (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering refunds (ISO 8601 format, e.g., 2024-12-31)'),
      amount: z.number().optional().describe('Filter by amount'),
      active: z.boolean().optional().describe('Filter by active status'),
      search: z.string().optional().describe('Filter by transaction search query'),
    }),
    execute: async ({ status, perPage, page, from, to, amount, active, search }) => {
      const jwtToken = getJwtToken();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage,
          page,
          ...(status ? { status } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          // TODO: Handle greater than or less than filters for amount
          ...(amount ? { amount } : {}),
          ...(active ? { active } : {}),
          ...(search ? { search } : {}),
        };

        const response = await paystackService.get<PaystackRefund[]>('/refund', jwtToken, params);

        return {
          success: true,
          refunds: response.data,
          meta: response.meta,
          message: `Retrieved ${response.data.length} refund(s)`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch refunds',
        };
      }
    },
  });
}

/**
 * Create AI tools with access to PaystackApiService
 * @param paystackService - The Paystack API service instance
 * @param getJwtToken - Function to retrieve the user's JWT authentication token
 */
export function createTools(
  paystackService: PaystackApiService,
  getJwtToken: () => string | undefined,
): Record<string, Tool<unknown, unknown>> {
  return {
    getTransactions: createGetTransactionsTool(paystackService, getJwtToken),
    getCustomers: createGetCustomersTool(paystackService, getJwtToken),
    getRefunds: createGetRefundsTool(paystackService, getJwtToken),
  };
}
