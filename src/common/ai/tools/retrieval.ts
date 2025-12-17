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
import {
  TransactionStatus,
  PaymentChannel,
  RefundStatus,
  PayoutStatus,
  DisputeStatusSlug,
  DisputeCategory,
} from '../types/data';
import { amountInBaseUnitToSubUnit, validateDateRange } from '../utils';

/**
 * Create the getTransactions tool
 */
export function createGetTransactionsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch transaction data from Paystack. Use this to get payment transactions, check transaction status, analyze payment patterns, or retrieve transaction details. Supports filtering by date range, status, and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of transactions per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering transactions (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering transactions (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum([TransactionStatus.SUCCESS, TransactionStatus.FAILED, TransactionStatus.ABANDONED])
        .optional()
        .describe('Filter by transaction status: success, failed, or abandoned'),
      channel: z
        .array(
          z.enum([
            PaymentChannel.CARD,
            PaymentChannel.BANK,
            PaymentChannel.USSD,
            PaymentChannel.MOBILE_MONEY,
            PaymentChannel.BANK_TRANSFER,
            PaymentChannel.DIRECT_DEBIT,
            PaymentChannel.DEBIT_ORDER,
            PaymentChannel.PAYATTITUDE,
            PaymentChannel.APPLE_PAY,
            PaymentChannel.PAYPAL,
            PaymentChannel.PREAUTH,
            PaymentChannel.CAPITEC_PAY,
          ]),
        )
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
          perPage,
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
      'Fetch customer data from Paystack. Use this to get customer information, analyze customer behavior, check customer transaction history, or retrieve customer details. Supports filtering by date range and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of customers per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      email: z.string().optional().describe('Filter by email'),
      account_number: z.string().optional().describe('Filter by account number'),
    }),
    execute: async ({ perPage, page, email, account_number }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          perPage,
          page,
          ...(email && { email }),
          ...(account_number && { account_number }),
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
export function createGetRefundsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch refund data from Paystack. Use this to get refund information, check refund status, analyze refund patterns, or retrieve refund details. Supports filtering by date range, transaction reference, and pagination.',
    inputSchema: z.object({
      status: z
        .enum([RefundStatus.PENDING, RefundStatus.FAILED, RefundStatus.PROCESSED, RefundStatus.PROCESSING, 'retriable'])
        .optional()
        .describe('Filter by refund status'),
      perPage: z.number().optional().default(50).describe('Number of refunds per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering refunds (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering refunds (ISO 8601 format, e.g., 2024-12-31)'),
      amount: z.number().optional().describe('Filter by amount'),
      amount_operator: z.enum(['gt', 'lt', 'eq']).optional().describe('Filter by amount operator').default('eq'),
      active: z.boolean().optional().describe('Filter by active status'),
      search: z.string().optional().describe('Filter by transaction search query'),
    }),
    execute: async ({ status, perPage, page, from, to, amount, amount_operator = 'eq', active, search }) => {
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
          perPage,
          page,
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...amountFilter,
          ...(active && { active }),
          ...(search && { search }),
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
 * Create the getPayouts tool
 */
export function createGetPayoutsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Fetch payout data from Paystack. Use this to get payout information, check payout status, analyze payout patterns, or retrieve payout details. Supports filtering by date range, status, and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of payouts per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering payouts (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering payouts (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum([
          PayoutStatus.SUCCESS,
          PayoutStatus.FAILED,
          PayoutStatus.PENDING,
          PayoutStatus.COMPUTING,
          PayoutStatus.MANUALPROCESSING,
          PayoutStatus.OPEN,
          PayoutStatus.PROCESSING,
        ])
        .optional()
        .describe('Filter by payout status'),
      subaccount: z.string().optional().describe('Filter by subaccount'),
      id: z.string().optional().describe('Filter by payout id'),
    }),
    execute: async ({ perPage, page, from, to, status, subaccount, id }) => {
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
          perPage,
          page,
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(subaccount && { subaccount }),
          ...(id && { id }),
        };

        const response = await paystackService.get<PaystackPayout[]>('/settlement', jwtToken, params);

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
      'Fetch dispute data from Paystack. Use this to get dispute information, check dispute status, analyze dispute patterns, or retrieve dispute details. Supports filtering by date range, status, and pagination.',
    inputSchema: z.object({
      perPage: z.number().optional().default(50).describe('Number of disputes per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering disputes (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering disputes (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum([DisputeStatusSlug.RESOLVED, DisputeStatusSlug.AWAITING_MERCHANT_FEEDBACK])
        .optional()
        .describe('Filter by dispute status'),
      ignore_resolved: z.enum(['yes', 'no']).optional().describe('Ignore resolved disputes'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      category: z
        .enum([DisputeCategory.FRAUD, DisputeCategory.CHARGEBACK])
        .optional()
        .describe('Filter by dispute category'),
    }),
    execute: async ({ perPage, page, from, to, status, ignore_resolved, transaction, category }) => {
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
          perPage,
          page,
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(ignore_resolved && { ignore_resolved }),
          ...(transaction && { transaction }),
          ...(category && { category }),
        };

        const response = await paystackService.get<PaystackDispute[]>('/dispute', jwtToken, params);

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
