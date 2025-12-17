import { Injectable } from '@nestjs/common';
import { PaystackApiService } from './paystack-api.service';
import { PageContextType } from '../ai/types';
import type {
  PageContext,
  EnrichedPageContext,
  PaystackTransaction,
  PaystackCustomer,
  PaystackRefund,
  PaystackPayout,
  PaystackDispute,
} from '../ai/types';
import { amountInSubUnitToBaseUnit } from '../ai/utils';
import { NotFoundError, ValidationError } from '../exceptions/api.exception';
import { ErrorCodes } from '../exceptions/error-codes';

@Injectable()
export class PageContextService {
  constructor(private readonly paystackApiService: PaystackApiService) {}

  /**
   * Enrich page context by fetching resource data
   */
  async enrichContext(pageContext: PageContext, jwtToken: string): Promise<EnrichedPageContext> {
    const resourceData = await this.fetchResourceData(pageContext.type, pageContext.resourceId, jwtToken);

    const formattedData = this.formatResourceData(pageContext.type, resourceData);

    return {
      type: pageContext.type,
      resourceId: pageContext.resourceId,
      resourceData,
      formattedData,
    };
  }

  /**
   * Fetch resource data from Paystack API
   */
  private async fetchResourceData(resourceType: PageContextType, resourceId: string, jwtToken: string) {
    try {
      switch (resourceType) {
        case PageContextType.TRANSACTION: {
          const response = await this.paystackApiService.get<PaystackTransaction>(
            `/transaction/${resourceId}`,
            jwtToken,
            {},
          );
          return response.data;
        }

        case PageContextType.CUSTOMER: {
          const response = await this.paystackApiService.get<PaystackCustomer>(`/customer/${resourceId}`, jwtToken, {});
          return response.data;
        }

        case PageContextType.REFUND: {
          const response = await this.paystackApiService.get<PaystackRefund>(`/refund/${resourceId}`, jwtToken, {});
          return response.data;
        }

        case PageContextType.PAYOUT: {
          const params = { id: resourceId };
          const response = await this.paystackApiService.get<PaystackPayout>('/settlement', jwtToken, params);
          return response.data;
        }

        case PageContextType.DISPUTE: {
          const response = await this.paystackApiService.get<PaystackDispute>(`/dispute/${resourceId}`, jwtToken, {});
          return response.data;
        }

        default:
          throw new ValidationError(
            `Unsupported resource type: ${String(resourceType)}`,
            ErrorCodes.INVALID_RESOURCE_TYPE,
          );
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new NotFoundError(`${resourceType} with ID ${resourceId} not found`, ErrorCodes.RESOURCE_NOT_FOUND);
    }
  }

  /**
   * Format resource data for prompt injection
   */
  private formatResourceData(resourceType: PageContextType, resourceData: unknown) {
    const data = resourceData as Record<string, unknown>;

    switch (resourceType) {
      case PageContextType.TRANSACTION:
        return this.formatTransaction(data as unknown as PaystackTransaction);
      case PageContextType.CUSTOMER:
        return this.formatCustomer(data as unknown as PaystackCustomer);
      case PageContextType.REFUND:
        return this.formatRefund(data as unknown as PaystackRefund);
      case PageContextType.PAYOUT:
        return this.formatPayout(data as unknown as PaystackPayout);
      case PageContextType.DISPUTE:
        return this.formatDispute(data as unknown as PaystackDispute);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private formatTransaction(transaction: PaystackTransaction) {
    const amount = amountInSubUnitToBaseUnit(transaction.amount);
    const currency = transaction.currency;

    return `Transaction Details:
    - ID: ${transaction.id}
    - Reference: ${transaction.reference}
    - Amount: ${currency} ${amount}
    - Status: ${transaction.status}
    - Channel: ${transaction.channel}
    - Customer Email: ${transaction.customer?.email || 'N/A'}
    - Customer Code: ${transaction.customer?.customer_code || 'N/A'}
    - Customer ID: ${transaction.customer?.id || 'N/A'}
    - Created At: ${transaction.createdAt}
    - Paid At: ${transaction.paid_at || 'N/A'}
    - Gateway Response: ${transaction.gateway_response || 'N/A'}
    - Domain: ${transaction.domain}${transaction.ip_address ? `\n- IP Address: ${transaction.ip_address}` : ''}${transaction.fees ? `\n- Fees: ${currency} ${amountInSubUnitToBaseUnit(transaction.fees)}` : ''}`;
  }

  private formatCustomer(customer: PaystackCustomer) {
    return `Customer Details:
    - ID: ${customer.id}
    - Customer Code: ${customer.customer_code}
    - Email: ${customer.email}
    - Name: ${customer.first_name || ''} ${customer.last_name || ''}
    - Phone: ${customer.phone || 'N/A'}
    - Risk Action: ${customer.risk_action}
    - Created At: ${customer.createdAt || 'N/A'}${customer.authorizations?.length ? `\n- Saved Cards: ${customer.authorizations.length}` : ''}`;
  }

  private formatRefund(refund: PaystackRefund) {
    const amount = amountInSubUnitToBaseUnit(refund.amount);

    return `Refund Details:
    - ID: ${refund.id}
    - Amount: ${refund.currency} ${amount}
    - Status: ${refund.status}
    - Transaction Reference: ${refund.transaction_reference}
    - Customer Email: ${refund.customer?.email || 'N/A'}
    - Refunded At: ${refund.refunded_at}
    - Refunded By: ${refund.refunded_by || 'N/A'}
    - Refund Type: ${refund.refund_type}
    - Domain: ${refund.domain}${refund.customer_note ? `\n- Customer Note: ${refund.customer_note}` : ''}${refund.merchant_note ? `\n- Merchant Note: ${refund.merchant_note}` : ''}`;
  }

  private formatPayout(payout: PaystackPayout) {
    const totalAmount = amountInSubUnitToBaseUnit(payout.total_amount);
    const effectiveAmount = payout.effective_amount ? amountInSubUnitToBaseUnit(payout.effective_amount) : 'N/A';

    return `Payout Details:
      - ID: ${payout.id}
      - Total Amount: ${payout.currency} ${totalAmount}
      - Effective Amount: ${payout.currency} ${effectiveAmount}
      - Status: ${payout.status}
      - Settlement Date: ${payout.settlement_date}
      - Settled By: ${payout.settled_by || 'N/A'}
      - Total Fees: ${payout.currency} ${amountInSubUnitToBaseUnit(payout.total_fees)}
      - Total Processed: ${payout.currency} ${amountInSubUnitToBaseUnit(payout.total_processed)}
      - Domain: ${payout.domain}
      - Created At: ${payout.createdAt}`;
  }

  private formatDispute(dispute: PaystackDispute) {
    const refundAmount = amountInSubUnitToBaseUnit(dispute.refund_amount);

    return `Dispute Details:
      - ID: ${dispute.id}
      - Refund Amount: ${dispute.currency} ${refundAmount}
      - Status: ${dispute.status}
      - Resolution: ${dispute.resolution || 'N/A'}
      - Category: ${dispute.category}
      - Transaction Reference: ${dispute.transaction_reference || 'N/A'}
      - Customer Email: ${dispute.customer?.email || 'N/A'}
      - Due At: ${dispute.dueAt}
      - Resolved At: ${dispute.resolvedAt || 'N/A'}
      - Domain: ${dispute.domain}
      - Created At: ${dispute.createdAt}${dispute.note ? `\n- Note: ${dispute.note}` : ''}`;
  }
}
