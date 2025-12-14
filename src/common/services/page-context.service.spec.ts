/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PageContextService } from './page-context.service';
import { PaystackApiService } from './paystack-api.service';
import { PageContextType } from '../ai/types';

describe('PageContextService', () => {
  let service: PageContextService;
  let paystackApiService: jest.Mocked<PaystackApiService>;

  beforeEach(async () => {
    const mockPaystackApiService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageContextService,
        {
          provide: PaystackApiService,
          useValue: mockPaystackApiService,
        },
      ],
    }).compile();

    service = module.get<PageContextService>(PageContextService);
    paystackApiService = module.get(PaystackApiService);
  });

  describe('enrichContext', () => {
    const jwtToken = 'test-jwt-token';

    it('should use provided resource data if available', async () => {
      const pageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
        resourceData: {
          id: 123,
          reference: 'ref_123',
          amount: 100000,
          status: 'success',
          channel: 'card',
          customer: { email: 'test@example.com', customer_code: 'CUS_123' },
          created_at: '2024-01-01T00:00:00Z',
          paid_at: '2024-01-01T00:00:00Z',
          gateway_response: 'Successful',
          domain: 'test',
          currency: 'NGN',
        },
      };

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(result).toHaveProperty('formattedData');
      expect(result.formattedData).toContain('Transaction Details');
      expect(result.formattedData).toContain('ref_123');
      expect(paystackApiService.get).not.toHaveBeenCalled();
    });

    it('should fetch transaction data if not provided', async () => {
      const pageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
      };

      const mockTransaction = {
        id: 123,
        reference: 'ref_123',
        amount: 100000,
        status: 'success',
        channel: 'card',
        customer: { email: 'test@example.com', customer_code: 'CUS_123' },
        created_at: '2024-01-01T00:00:00Z',
        paid_at: '2024-01-01T00:00:00Z',
        gateway_response: 'Successful',
        domain: 'test',
        currency: 'NGN',
      };

      paystackApiService.get.mockResolvedValue({
        status: true,
        message: 'Transactions retrieved',
        data: mockTransaction,
      });

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(paystackApiService.get).toHaveBeenCalledWith('/transaction/ref_123', jwtToken, {});
      expect(result.resourceData).toEqual(mockTransaction);
      expect(result.formattedData).toContain('Transaction Details');
    });

    it('should fetch customer data if not provided', async () => {
      const pageContext = {
        type: PageContextType.CUSTOMER,
        resourceId: 'CUS_123',
      };

      const mockCustomer = {
        id: 123,
        customer_code: 'CUS_123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2341234567890',
        risk_action: 'default',
      };

      paystackApiService.get.mockResolvedValue({
        status: true,
        message: 'Customer retrieved',
        data: mockCustomer,
      });

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(paystackApiService.get).toHaveBeenCalledWith('/customer/CUS_123', jwtToken, {});
      expect(result.resourceData).toEqual(mockCustomer);
      expect(result.formattedData).toContain('Customer Details');
    });

    it('should throw error for invalid transaction', async () => {
      const pageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'invalid_ref',
      };

      paystackApiService.get.mockResolvedValue({
        status: true,
        message: 'Transactions retrieved',
        data: null,
      });

      await expect(service.enrichContext(pageContext, jwtToken)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid resource data', async () => {
      const pageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
        resourceData: null,
      };

      await expect(service.enrichContext(pageContext, jwtToken)).rejects.toThrow(BadRequestException);
    });

    it('should format refund data correctly', async () => {
      const pageContext = {
        type: PageContextType.REFUND,
        resourceId: '123',
        resourceData: {
          id: 123,
          amount: 50000,
          currency: 'NGN',
          status: 'processed',
          transaction_reference: 'ref_123',
          customer: { email: 'test@example.com' },
          refunded_at: '2024-01-01T00:00:00Z',
          refunded_by: 'admin@example.com',
          refund_type: 'full',
          domain: 'test',
        },
      };

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(result.formattedData).toContain('Refund Details');
      expect(result.formattedData).toContain('NGN 500');
      expect(result.formattedData).toContain('processed');
    });

    it('should format payout data correctly', async () => {
      const pageContext = {
        type: PageContextType.PAYOUT,
        resourceId: '123',
        resourceData: {
          id: 123,
          total_amount: 1000000,
          effective_amount: 950000,
          currency: 'NGN',
          status: 'success',
          settlement_date: '2024-01-01',
          settled_by: 'system',
          total_fees: 50000,
          total_processed: 1000000,
          domain: 'test',
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(result.formattedData).toContain('Payout Details');
      expect(result.formattedData).toContain('NGN 10000');
      expect(result.formattedData).toContain('success');
    });

    it('should format dispute data correctly', async () => {
      const pageContext = {
        type: PageContextType.DISPUTE,
        resourceId: '123',
        resourceData: {
          id: 123,
          refund_amount: 100000,
          currency: 'NGN',
          status: 'awaiting-merchant-feedback',
          resolution: null,
          category: 'general',
          transaction_reference: 'ref_123',
          customer: { email: 'test@example.com' },
          dueAt: '2024-01-15T00:00:00Z',
          resolvedAt: null,
          domain: 'test',
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      const result = await service.enrichContext(pageContext, jwtToken);

      expect(result.formattedData).toContain('Dispute Details');
      expect(result.formattedData).toContain('NGN 1000');
      expect(result.formattedData).toContain('awaiting-merchant-feedback');
    });
  });
});
