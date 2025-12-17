import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../services/paystack-api.service';
import type {
  PaystackTransaction,
  PaystackCustomer,
  PaystackRefund,
  PaystackPayout,
  PaystackDispute,
  PageContextType,
  PaystackExportResponse,
} from './types/index';
import {
  DisputeCategory,
  DisputeStatusSlug,
  PaymentChannel,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from './types/data';
import { amountInBaseUnitToSubUnit, validateDateRange } from './utils';
import { aggregateRecords, calculateSummary, generateChartLabel, getChartType } from './aggregation';
import {
  AggregationType,
  ChartResourceType,
  VALID_AGGREGATIONS,
  API_ENDPOINTS,
  getFieldConfig,
  toChartableRecords,
  isValidAggregation,
  getResourceDisplayName,
  ChartableResource,
  STATUS_VALUES,
} from './chart-config';
import { parseISO, format } from 'date-fns';

interface AuthenticatedUser {
  userId: string;
  jwtToken: string;
}

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
 * Create the exportTransactions tool
 */
export function createExportTransactionsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Export transaction data from Paystack via email. Use this when users want to download or receive their transaction data as a file. Supports similar filters as getTransactions. The export file will be sent to the email associated with the authenticated user.',
    inputSchema: z.object({
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
    execute: async ({ from, to, status, channel, customer, amount, currency }) => {
      const { jwtToken, userId } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          reduced_fields: true,
          ...(channel && { channel }),
          ...(customer && { customer }),
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...(amount && { amount: amountInBaseUnitToSubUnit(amount) }),
          ...(currency && { currency }),
        };

        const transactionResponse = await paystackService.get<PaystackTransaction[]>('/transaction', jwtToken, params);

        if (transactionResponse.data.length === 0) {
          return {
            error: 'No transactions found for the given filters',
          };
        }

        const exportResponse = await paystackService.get<PaystackExportResponse>(
          '/transaction/export_by_column',
          jwtToken,
          {
            ...params,
            destination: 'email',
            user: userId,
            columns: [
              'id',
              'amount',
              'status',
              'created_at',
              'reference',
              'customer_email',
              'channel',
              'currency',
              'fees',
              'amount_due',
              'bank',
              'card_type',
            ],
          },
        );

        return {
          success: exportResponse.status,
          message: `Transaction export has been queued and will be sent to your email shortly. If you do not receive it, please check your spam folder.`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to export transactions',
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
 * Create the exportRefunds tool
 */
export function createExportRefundsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Export refund data from Paystack via email. Use this when users want to download or receive their refund data as a file. Supports similar filters as getRefunds. The export file will be sent to the email associated with the authenticated user.',
    inputSchema: z.object({
      status: z
        .enum([RefundStatus.PENDING, RefundStatus.FAILED, RefundStatus.PROCESSED, RefundStatus.PROCESSING, 'retriable'])
        .optional()
        .describe('Filter by refund status'),
      from: z.string().optional().describe('Start date for filtering refunds (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering refunds (ISO 8601 format, e.g., 2024-12-31)'),
      search: z.string().optional().describe('Filter by transaction search query'),
    }),
    execute: async ({ status, from, to, search }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...(search && { search }),
        };

        const refundResponse = await paystackService.get<PaystackRefund[]>('/refund', jwtToken, params);

        if (refundResponse.data.length === 0) {
          return {
            error: 'No refunds found for the given filters',
          };
        }

        const exportResponse = await paystackService.get<PaystackExportResponse>('/refund/export', jwtToken, {
          ...params,
          destination: 'email',
        });

        return {
          success: exportResponse.status,
          message: `Refund export has been queued and will be sent to your email shortly. If you do not receive it, please check your spam folder.`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to export refunds',
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
 * Create the exportPayouts tool
 * Note: Unlike other exports, payout exports return an S3 URL for immediate download
 */
export function createExportPayoutsTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Export payout data from Paystack. Use this when users want to download or receive their payout data as a file. Supports similar filters as getPayouts. The tool returns an S3 URL for the user to download the payout data.',
    inputSchema: z.object({
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
    }),
    execute: async ({ from, to, status, subaccount }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      try {
        const params: Record<string, unknown> = {
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(subaccount && { subaccount }),
        };

        const payoutResponse = await paystackService.get<PaystackPayout[]>('/settlement', jwtToken, params);

        if (payoutResponse.data.length === 0) {
          return {
            error: 'No payouts found for the given filters',
          };
        }

        const exportResponse = await paystackService.get<PaystackExportResponse>('/settlement/export', jwtToken, {
          ...params,
          model: 'settlement',
        });

        return {
          success: exportResponse.status,
          message: `Payout export has been generated. Use the provided S3 URL to download the payout data.`,
          data: {
            path: exportResponse.data?.path,
            expiresAt: exportResponse.data?.expiresAt,
          },
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to export payouts',
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

/**
 * Create the exportDisputes tool
 */
export function createExportDisputesTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Export dispute data from Paystack via email. Use this when users want to download or receive their dispute data as a file. Supports similar filters as getDisputes. The export file will be sent to the email associated with the authenticated user.',
    inputSchema: z.object({
      from: z.string().optional().describe('Start date for filtering disputes (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering disputes (ISO 8601 format, e.g., 2024-12-31)'),
      status: z
        .enum([DisputeStatusSlug.RESOLVED, DisputeStatusSlug.AWAITING_MERCHANT_FEEDBACK])
        .optional()
        .describe('Filter by dispute status'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      category: z
        .enum([DisputeCategory.FRAUD, DisputeCategory.CHARGEBACK])
        .optional()
        .describe('Filter by dispute category'),
    }),
    execute: async ({ from, to, status, transaction, category }) => {
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
          ...(from && { from }),
          ...(to && { to }),
          ...(status && { status }),
          ...(transaction && { transaction }),
          ...(category && { category }),
        };

        const disputeResponse = await paystackService.get<PaystackDispute[]>('/dispute', jwtToken, params);

        if (disputeResponse.data.length === 0) {
          return {
            error: 'No disputes found for the given filters',
          };
        }

        const exportResponse = await paystackService.get<PaystackExportResponse>('/dispute/export', jwtToken, {
          ...params,
          destination: 'email',
        });

        return {
          success: exportResponse.status,
          message: `Dispute export has been queued and will be sent to your email shortly. If you do not receive it, please check your spam folder.`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to export disputes',
        };
      }
    },
  });
}

/**
 * Create the generateChartData tool
 * Supports multiple resource types: transaction, refund, payout, dispute
 */
export function createGenerateChartDataTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description: `Generate chart data for analytics on transactions, refunds, payouts, or disputes. Use this to create visualizations of trends, patterns, and distributions across different resource types.

**Resource Types & Supported Aggregations:**
- transaction: by-day, by-hour, by-week, by-month, by-status
- refund: by-day, by-hour, by-week, by-month, by-status, by-type (full/partial)
- payout: by-day, by-hour, by-week, by-month, by-status
- dispute: by-day, by-hour, by-week, by-month, by-status, by-category (fraud/chargeback), by-resolution

Returns Recharts-compatible data with count, volume, and average metrics.`,
    inputSchema: z.object({
      resourceType: z
        .enum([
          ChartResourceType.TRANSACTION,
          ChartResourceType.REFUND,
          ChartResourceType.PAYOUT,
          ChartResourceType.DISPUTE,
        ])
        .default(ChartResourceType.TRANSACTION)
        .describe('Type of resource to generate chart data for (default: transaction)'),
      aggregationType: z
        .enum([
          AggregationType.BY_DAY,
          AggregationType.BY_HOUR,
          AggregationType.BY_WEEK,
          AggregationType.BY_MONTH,
          AggregationType.BY_STATUS,
          AggregationType.BY_TYPE,
          AggregationType.BY_CATEGORY,
          AggregationType.BY_RESOLUTION,
        ])
        .describe(
          'Type of aggregation. Time-based (by-day, by-hour, by-week, by-month) and by-status work for all resources. by-type is for refunds only. by-category and by-resolution are for disputes only.',
        ),
      from: z.string().optional().describe('Start date for filtering (ISO 8601 format, e.g., 2024-01-01)'),
      to: z.string().optional().describe('End date for filtering (ISO 8601 format, e.g., 2024-12-31)'),
      status: z.string().optional().describe('Filter by status (values depend on resource type)'),
      currency: z.string().optional().describe('Filter by currency (e.g., NGN, USD, GHS)'),
    }),
    execute: async function* ({ resourceType, aggregationType, from, to, status, currency }) {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return {
          error: 'Authentication token not available. Please ensure you are logged in.',
        };
      }

      if (!isValidAggregation(resourceType, aggregationType)) {
        const validAggregations = VALID_AGGREGATIONS[resourceType].join(', ');

        return {
          error: `Invalid aggregation type '${aggregationType}' for resource type '${resourceType}'. Valid options are: ${validAggregations}`,
        };
      }

      if (status && !STATUS_VALUES[resourceType].includes(status)) {
        return {
          error: `Invalid status '${status}' for resource type '${resourceType}'. Valid options are: ${STATUS_VALUES[resourceType].join(', ')}`,
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
        const dateRange = { from, to };
        const chartType = getChartType(aggregationType);
        const resourceDisplayName = getResourceDisplayName(resourceType);
        const resourceDisplayNamePlural = `${resourceDisplayName.toLowerCase()}s`;
        const endpoint = API_ENDPOINTS[resourceType];
        const fieldConfig = getFieldConfig(resourceType);

        yield {
          loading: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          message: `Fetching ${resourceDisplayNamePlural}...`,
        };

        // Fetch records with increased perPage for better aggregation (up to 500)
        const allRecords: ChartableResource[] = [];
        const perPage = 100; // Max per request
        // TODO: Review this limit
        const maxPages = 10; // Fetch up to 1000 records total

        for (let page = 1; page <= maxPages; page++) {
          const params = {
            perPage,
            page,
            use_cursor: false,
            ...(resourceType === ChartResourceType.TRANSACTION && { reduced_fields: true }),
            ...(status && { status }),
            ...(from && { from }),
            ...(to && { to }),
            ...(currency && { currency }),
          };

          const response = await paystackService.get<ChartableResource[]>(endpoint, jwtToken, params);

          allRecords.push(...response.data);

          if (page < maxPages && response.data.length === perPage) {
            yield {
              loading: true,
              label: generateChartLabel(aggregationType, dateRange, resourceType),
              chartType,
              message: `Fetching ${resourceDisplayNamePlural}... (${allRecords.length} loaded)`,
            };
          }

          // Stop if we've received fewer than perPage (no more data)
          if (response.data.length < perPage) {
            break;
          }
        }

        if (allRecords.length === 0) {
          yield {
            success: true,
            label: generateChartLabel(aggregationType, dateRange, resourceType),
            chartType,
            chartData: [],
            chartSeries: [],
            summary: {
              totalCount: 0,
              totalVolume: 0,
              overallAverage: 0,
              ...(from || to
                ? {
                    dateRange: {
                      from: from ? format(parseISO(from), 'MMM d, yyyy') : 'N/A',
                      to: to ? format(parseISO(to), 'MMM d, yyyy') : 'N/A',
                    },
                  }
                : {}),
            },
            message: `No ${resourceDisplayNamePlural} found for the specified criteria`,
          };
          return;
        }

        yield {
          loading: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          message: `Processing ${allRecords.length} ${resourceDisplayNamePlural}...`,
        };

        const chartableRecords = toChartableRecords(allRecords, fieldConfig);

        const aggregationResult = aggregateRecords(chartableRecords, aggregationType);

        const summary = calculateSummary(chartableRecords, dateRange);

        const dataPointCount = aggregationResult.chartSeries
          ? aggregationResult.chartSeries.reduce((sum, series) => sum + series.points.length, 0)
          : (aggregationResult.chartData?.length ?? 0);

        yield {
          success: true,
          label: generateChartLabel(aggregationType, dateRange, resourceType),
          chartType,
          chartData: aggregationResult.chartData,
          chartSeries: aggregationResult.chartSeries,
          summary,
          message: `Generated chart data with ${dataPointCount} data points from ${allRecords.length} ${resourceDisplayNamePlural}`,
        };
      } catch (error: unknown) {
        return {
          error: error instanceof Error ? error.message : 'Failed to generate chart data',
        };
      }
    },
  });
}

/**
 * Create AI tools with access to PaystackApiService
 * @param paystackService - The Paystack API service instance
 * @param getAuthenticatedUser - Function to retrieve the authenticated user
 */
export function createTools(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
): Record<string, Tool<unknown, unknown>> {
  return {
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
  return Object.fromEntries(Object.entries(allTools).filter(([name]) => allowedTools.includes(name)));
}
