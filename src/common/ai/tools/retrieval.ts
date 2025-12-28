import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type {
  AuthenticatedUser,
  PaystackTransaction,
  PaystackCustomer,
  PaystackRefund,
  PaystackPayout,
  PaystackDispute,
} from '../types';
import { ToolIntent } from '../types';
import {
  TransactionStatus,
  PaymentChannel,
  RefundStatus,
  PayoutStatus,
  DisputeStatusSlug,
  DisputeCategory,
} from '../types/data';
import { amountInBaseUnitToSubUnit, validateDateRange } from '../utilities/utils';

/**
 * Create the getTransactions tool
 */
export function createGetTransactionsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch transaction data from Paystack or get transaction counts. Use intent="count" to get only the total count without fetching full data (saves tokens). Use intent="fetch" (default) to retrieve full transaction details. Supports filtering by date range, status, channel, and pagination.',
    inputSchema: z.object({
      intent: z
        .enum(Object.values(ToolIntent))
        .optional()
        .describe('Operation intent: "fetch" returns full data, "count" returns only the total count'),
      perPage: z.number().optional().default(50).describe('Number of transactions per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering transactions (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering transactions (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum(Object.values(TransactionStatus))
        .optional()
        .describe('Filter by transaction status: success, failed, or abandoned'),
      channel: z
        .enum(Object.values(PaymentChannel))
        .optional()
        .describe('Filter by transaction channels: card, bank, ussd, mobile_money, or bank_transfer'),
      customer: z
        .string()
        .optional()
        .describe('Filter by the `id` field of the customer object, not the customer code'),
      amount: z.number().optional().describe('Filter by amount'),
      currency: z.string().optional().describe('Filter by currency'),
    }),
    execute: async ({ intent, perPage, page, from, to, status, channel, customer, amount, currency }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      // Validate date range does not exceed 30 days
      const dateValidation = validateDateRange(from, to);

      if (!dateValidation.isValid) {
        return {
          error: dateValidation.error,
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage: intent === ToolIntent.COUNT ? 1 : perPage,
          page,
          reduced_fields: true,
          ...(channel && { channel }),
          ...(customer && { customer }),
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...(amount && { amount: amountInBaseUnitToSubUnit(amount) }),
          ...(currency && { currency }),
        };

        const response = await paystackService.get<PaystackTransaction[]>('/transaction', jwtToken, params);

        if (intent === ToolIntent.COUNT) {
          return {
            success: true,
            count: response.meta?.total ?? 0,
            message: `Found ${response.meta?.total ?? 0} transaction(s)`,
          };
        }

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
export function createGetCustomersTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch customer data from Paystack or get customer counts. Use intent="count" to get only the total count without fetching full data (saves tokens). Use intent="fetch" (default) to retrieve full customer details. Supports filtering by email, account number, and pagination.',
    inputSchema: z.object({
      intent: z
        .enum(Object.values(ToolIntent))
        .optional()
        .describe('Operation intent: "fetch" returns full data, "count" returns only the total count'),
      perPage: z.number().optional().default(50).describe('Number of customers per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      email: z.string().optional().describe('Filter by email'),
      account_number: z.string().optional().describe('Filter by account number'),
    }),
    execute: async ({ intent, perPage, page, email, account_number }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage: intent === ToolIntent.COUNT ? 1 : perPage,
          page,
          ...(email && { email }),
          ...(account_number && { account_number }),
        };

        const response = await paystackService.get<PaystackCustomer[]>('/customer', jwtToken, params);

        if (intent === ToolIntent.COUNT) {
          return {
            success: true,
            count: response.meta?.total ?? 0,
            message: `Found ${response.meta?.total ?? 0} customer(s)`,
          };
        }

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
export function createGetRefundsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch refund data from Paystack or get refund counts. Use intent="count" to get only the total count without fetching full data (saves tokens). Use intent="fetch" (default) to retrieve full refund details. Supports filtering by date range, status, transaction reference, and pagination.',
    inputSchema: z.object({
      intent: z
        .enum(Object.values(ToolIntent))
        .optional()
        .describe('Operation intent: "fetch" returns full data, "count" returns only the total count'),
      status: z.enum(Object.values(RefundStatus)).optional().describe('Filter by refund status'),
      perPage: z.number().optional().default(50).describe('Number of refunds per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering refunds (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering refunds (ISO 8601 format, e.g., 2024-12-31)'),
      amount: z.number().optional().describe('Filter by amount'),
      amount_operator: z.enum(['gt', 'lt', 'eq']).optional().describe('Filter by amount operator').default('eq'),
      active: z.boolean().optional().describe('Filter by active status'),
      search: z.string().optional().describe('Filter by transaction search query'),
    }),
    execute: async ({ intent, status, perPage, page, from, to, amount, amount_operator = 'eq', active, search }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      // Validate date range does not exceed 30 days
      const dateValidation = validateDateRange(from, to);

      if (!dateValidation.isValid) {
        return {
          error: dateValidation.error,
        };
      }

      try {
        const amountFilter =
          amount != undefined
            ? amount_operator === 'eq'
              ? { amount: amountInBaseUnitToSubUnit(amount) }
              : { amount: JSON.stringify({ [amount_operator]: amountInBaseUnitToSubUnit(amount) }) }
            : {};

        const params: Record<string, unknown> = {
          perPage: intent === ToolIntent.COUNT ? 1 : perPage,
          page,
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...amountFilter,
          ...(active && { active }),
          ...(search && { search }),
        };

        const response = await paystackService.get<PaystackRefund[]>('/refund', jwtToken, params);

        if (intent === ToolIntent.COUNT) {
          return {
            success: true,
            count: response.meta?.total ?? 0,
            message: `Found ${response.meta?.total ?? 0} refund(s)`,
          };
        }

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
 * Create the getPayouts tool
 */
export function createGetPayoutsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch payout data from Paystack or get payout counts. Use intent="count" to get only the total count without fetching full data (saves tokens). Use intent="fetch" (default) to retrieve full payout details. Supports filtering by date range, status, subaccount, and pagination.',
    inputSchema: z.object({
      intent: z
        .enum(Object.values(ToolIntent))
        .optional()
        .describe('Operation intent: "fetch" returns full data, "count" returns only the total count'),
      perPage: z.number().optional().default(50).describe('Number of payouts per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering payouts (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering payouts (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.enum(Object.values(PayoutStatus)).optional().describe('Filter by payout status'),
      subaccount: z.string().optional().describe('Filter by subaccount'),
      id: z.string().optional().describe('Filter by payout id'),
    }),
    execute: async ({ intent, perPage, page, from, to, status, subaccount, id }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      // Validate date range does not exceed 30 days
      const dateValidation = validateDateRange(from, to);

      if (!dateValidation.isValid) {
        return {
          error: dateValidation.error,
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage: intent === ToolIntent.COUNT ? 1 : perPage,
          page,
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(subaccount && { subaccount }),
          ...(id && { id }),
        };

        const response = await paystackService.get<PaystackPayout[]>('/settlement', jwtToken, params);

        if (intent === ToolIntent.COUNT) {
          return {
            success: true,
            count: response.meta?.total ?? 0,
            message: `Found ${response.meta?.total ?? 0} payout(s)`,
          };
        }

        return {
          success: true,
          payouts: response.data,
          meta: response.meta,
          message: `Retrieved ${response.data.length} payout(s)`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch payouts',
        };
      }
    },
  });
}

/**
 * Create the getDisputes tool
 */
export function createGetDisputesTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch dispute data from Paystack or get dispute counts. Use intent="count" to get only the total count without fetching full data (saves tokens). Use intent="fetch" (default) to retrieve full dispute details. Supports filtering by date range, status, transaction, and pagination.',
    inputSchema: z.object({
      intent: z
        .enum(Object.values(ToolIntent))
        .optional()
        .describe('Operation intent: "fetch" returns full data, "count" returns only the total count'),
      perPage: z.number().optional().default(50).describe('Number of disputes per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering disputes (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering disputes (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.enum(Object.values(DisputeStatusSlug)).optional().describe('Filter by dispute status'),
      ignore_resolved: z.enum(['yes', 'no']).optional().describe('Ignore resolved disputes'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      category: z.enum(Object.values(DisputeCategory)).optional().describe('Filter by dispute category'),
    }),
    execute: async ({ intent, perPage, page, from, to, status, ignore_resolved, transaction, category }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      // Validate date range does not exceed 30 days
      const dateValidation = validateDateRange(from, to);

      if (!dateValidation.isValid) {
        return {
          error: dateValidation.error,
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage: intent === ToolIntent.COUNT ? 1 : perPage,
          page,
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(ignore_resolved && { ignore_resolved }),
          ...(transaction && { transaction }),
          ...(category && { category }),
        };

        const response = await paystackService.get<PaystackDispute[]>('/dispute', jwtToken, params);

        if (intent === ToolIntent.COUNT) {
          return {
            success: true,
            count: response.meta?.total ?? 0,
            message: `Found ${response.meta?.total ?? 0} dispute(s)`,
          };
        }

        return {
          success: true,
          disputes: response.data,
          meta: response.meta,
          message: `Retrieved ${response.data.length} dispute(s)`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch disputes',
        };
      }
    },
  });
}
