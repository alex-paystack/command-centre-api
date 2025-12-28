import { tool } from 'ai';
import { z } from 'zod';
import type { PaystackApiService } from '../../services/paystack-api.service';
import type {
  AuthenticatedUser,
  PaystackTransaction,
  PaystackExportResponse,
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
import { amountInBaseUnitToSubUnit } from '../utilities/utils';

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
      status: z.enum(Object.values(RefundStatus)).optional().describe('Filter by refund status'),
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
      status: z.enum(Object.values(PayoutStatus)).optional().describe('Filter by payout status'),
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
      status: z.enum(Object.values(DisputeStatusSlug)).optional().describe('Filter by dispute status'),
      transaction: z.number().optional().describe('Filter by transaction id'),
      category: z.enum(Object.values(DisputeCategory)).optional().describe('Filter by dispute category'),
    }),
    execute: async ({ from, to, status, transaction, category }) => {
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
