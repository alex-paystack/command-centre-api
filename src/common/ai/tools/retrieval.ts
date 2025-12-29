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
  DisputeResolutionSlug,
} from '../types/data';
import { amountInBaseUnitToSubUnit, validateDateRange } from '../utilities/utils';
import {
  sanitizeTransactions,
  sanitizeCustomers,
  sanitizeRefunds,
  sanitizePayouts,
  sanitizeDisputes,
} from '../sanitization';
import {
  TRANSACTION_ALLOWED_FILTERS,
  CUSTOMER_ALLOWED_FILTERS,
  REFUND_ALLOWED_FILTERS,
  PAYOUT_ALLOWED_FILTERS,
  DISPUTE_ALLOWED_FILTERS,
  findUnsupportedFilters,
  buildUnsupportedFilterError,
} from '../utilities/retreival-filter-validation';

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
    inputSchema: z.looseObject({
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
      subaccountCode: z.string().optional().describe('Filter by subaccount code'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const unsupportedFilters = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('transactions', unsupportedFilters, TRANSACTION_ALLOWED_FILTERS);
      }

      const { perPage, page, from, to, status, channel, customer, amount, currency, subaccountCode } = input;

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
          ...(subaccountCode && { subaccount_code: subaccountCode }),
        };

        const response = await paystackService.get<PaystackTransaction[]>('/transaction', jwtToken, params);

        const sanitizedTransactions = sanitizeTransactions(response.data);

        return {
          success: true,
          transactions: sanitizedTransactions,
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
    inputSchema: z.looseObject({
      perPage: z.number().optional().default(50).describe('Number of customers per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      email: z.string().optional().describe('Filter by email'),
      accountNumber: z.string().optional().describe('Filter by account number'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const unsupportedFilters = findUnsupportedFilters(input, CUSTOMER_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('customers', unsupportedFilters, CUSTOMER_ALLOWED_FILTERS);
      }

      const { perPage, page, email, accountNumber } = input;

      try {
        const params: Record<string, unknown> = {
          perPage,
          page,
          ...(email && { email }),
          ...(accountNumber && { account_number: accountNumber }),
        };

        const response = await paystackService.get<PaystackCustomer[]>('/customer', jwtToken, params);

        const sanitizedCustomers = sanitizeCustomers(response.data);

        return {
          success: true,
          customers: sanitizedCustomers,
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
    inputSchema: z.looseObject({
      status: z.enum(Object.values(RefundStatus)).optional().describe('Filter by refund status'),
      perPage: z.number().optional().default(50).describe('Number of refunds per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering refunds (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering refunds (ISO 8601 format, e.g., 2024-12-31)'),
      amount: z.number().optional().describe('Filter by amount'),
      amountOperator: z.enum(['gt', 'lt', 'eq']).optional().describe('Filter by amount operator').default('eq'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      search: z.string().optional().describe('Filter by bank reference or refund id'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const unsupportedFilters = findUnsupportedFilters(input, REFUND_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('refunds', unsupportedFilters, REFUND_ALLOWED_FILTERS);
      }

      const { status, perPage, page, from, to, amount, amountOperator = 'eq', transaction, search } = input;

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
            ? amountOperator === 'eq'
              ? { amount: amountInBaseUnitToSubUnit(amount) }
              : { amount: JSON.stringify({ [amountOperator]: amountInBaseUnitToSubUnit(amount) }) }
            : {};

        const params: Record<string, unknown> = {
          perPage,
          page,
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...amountFilter,
          ...(transaction && { transaction }),
          ...(search && { search }),
        };

        const response = await paystackService.get<PaystackRefund[]>('/refund', jwtToken, params);

        const sanitizedRefunds = sanitizeRefunds(response.data);

        return {
          success: true,
          refunds: sanitizedRefunds,
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
    inputSchema: z.looseObject({
      perPage: z.number().optional().default(50).describe('Number of payouts per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering payouts (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering payouts (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.enum(Object.values(PayoutStatus)).optional().describe('Filter by payout status'),
      subaccount: z.string().optional().describe('Filter by subaccount'),
      payoutId: z.string().optional().describe('Filter by payout id'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const unsupportedFilters = findUnsupportedFilters(input, PAYOUT_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('payouts', unsupportedFilters, PAYOUT_ALLOWED_FILTERS);
      }

      const { perPage, page, from, to, status, subaccount, payoutId } = input;

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
          ...(payoutId && { id: payoutId }),
        };

        const response = await paystackService.get<PaystackPayout[]>('/settlement', jwtToken, params);

        const sanitizedPayouts = sanitizePayouts(response.data);

        return {
          success: true,
          payouts: sanitizedPayouts,
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
    inputSchema: z.looseObject({
      perPage: z.number().optional().default(50).describe('Number of disputes per page (default: 50, max: 100)'),
      page: z.number().optional().default(1).describe('Page number for pagination (default: 1)'),
      from: z.string().optional().describe('Start date for filtering disputes (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering disputes (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.enum(Object.values(DisputeStatusSlug)).optional().describe('Filter by dispute status'),
      ignoreResolved: z.enum(['yes', 'no']).optional().describe('Ignore resolved disputes'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      category: z.enum(Object.values(DisputeCategory)).optional().describe('Filter by dispute category'),
      resolution: z.enum(Object.values(DisputeResolutionSlug)).optional().describe('Filter by dispute resolution'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      const unsupportedFilters = findUnsupportedFilters(input, DISPUTE_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('disputes', unsupportedFilters, DISPUTE_ALLOWED_FILTERS);
      }

      const { perPage, page, from, to, status, ignoreResolved, transaction, category, resolution } = input;

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
          ...(ignoreResolved && { ignore_resolved: ignoreResolved }),
          ...(transaction && { transaction }),
          ...(category && { category }),
          ...(resolution && { resolution }),
        };

        const response = await paystackService.get<PaystackDispute[]>('/dispute', jwtToken, params);

        const sanitizedDisputes = sanitizeDisputes(response.data);

        return {
          success: true,
          disputes: sanitizedDisputes,
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
