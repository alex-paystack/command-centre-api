import {
  ResourceSanitizer,
  sanitizeTransactions,
  sanitizeCustomers,
  sanitizeRefunds,
  sanitizePayouts,
  sanitizeDisputes,
} from './sanitizer';
import { SanitizationLevel, ResourceType } from './types';
import type { PaystackTransaction, PaystackCustomer, PaystackRefund, PaystackPayout, PaystackDispute } from '../types';

describe('ResourceSanitizer', () => {
  describe('Transaction Sanitization', () => {
    const mockTransaction = {
      id: 1,
      reference: 'ref123',
      amount: 50000,
      currency: 'NGN',
      status: 'success',
      channel: 'card',
      gateway_response: 'Approved',
      fees: 750,
      paid_at: '2024-01-01T12:00:00Z',
      paidAt: '2024-01-01T12:00:00Z',
      created_at: '2024-01-01T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
      domain: 'live',
      customer: {
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        phone: '+2341234567890',
        first_name: 'John',
        last_name: 'Doe',
        risk_action: 'default',
      },
      authorization: {
        authorization_code: 'AUTH_xxx',
        bin: '408408',
        last4: '4081',
        exp_month: '12',
        exp_year: '2025',
        channel: 'card',
        card_type: 'visa',
        bank: 'Test Bank',
        country_code: 'NG',
        brand: 'visa',
        reusable: true,
        signature: 'SIG_xxx',
        account_name: null,
      },
      log: {
        start_time: 1234567890,
        time_spent: 5,
        attempts: 1,
        authentication: 'pin',
        errors: 0,
        success: true,
        mobile: false,
        input: [],
        history: [],
      },
      ip_address: '192.168.1.1',
      receipt_number: 'REC123',
      message: 'Successful',
      metadata: {},
      requested_amount: 50000,
      subaccount: {},
      plan: {},
      split: {},
      fees_split: null,
    } as unknown as PaystackTransaction;

    it('should sanitize transaction with MINIMAL level', () => {
      const result = sanitizeTransactions([mockTransaction], SanitizationLevel.MINIMAL)[0];

      // Should have minimal fields
      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('reference', 'ref123');
      expect(result).toHaveProperty('amount', 50000);
      expect(result).toHaveProperty('currency', 'NGN');
      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('channel', 'card');
      expect(result).toHaveProperty('createdAt');

      // Should have nested customer with limited fields
      expect(result.customer).toEqual({
        id: 100,
        email: 'test@example.com',
      });

      // Should not have authorization at minimal level
      expect(result.authorization).toBeUndefined();

      // Should not have verbose fields
      expect(result.log).toBeUndefined();
      expect(result.gateway_response).toBeUndefined();
      expect(result.fees).toBeUndefined();
    });

    it('should sanitize transaction with STANDARD level', () => {
      const result = sanitizeTransactions([mockTransaction])[0];

      // Should have standard fields
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('gateway_response', 'Approved');
      expect(result).toHaveProperty('fees', 750);
      expect(result).toHaveProperty('domain', 'live');

      // Should have customer with more fields
      expect(result.customer).toMatchObject({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        phone: '+2341234567890',
      });

      // Should have authorization with key fields
      expect(result.authorization).toMatchObject({
        authorization_code: 'AUTH_xxx',
        bin: '408408',
        last4: '4081',
        bank: 'Test Bank',
        brand: 'visa',
        card_type: 'visa',
        channel: 'card',
      });

      // Should still not have log
      expect(result.log).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should sanitize transaction with DETAILED level', () => {
      const result = sanitizeTransactions([mockTransaction], SanitizationLevel.DETAILED)[0];

      // Should have detailed fields
      expect(result).toHaveProperty('ip_address', '192.168.1.1');
      expect(result).toHaveProperty('receipt_number', 'REC123');
      expect(result).toHaveProperty('message', 'Successful');
      expect(result).toHaveProperty('requested_amount', 50000);

      // Should have customer with name fields
      expect(result.customer).toMatchObject({
        first_name: 'John',
        last_name: 'Doe',
      });

      // Should have authorization with country_code
      expect(result.authorization).toMatchObject({
        country_code: 'NG',
      });

      // Still should not have log
      expect(result.log).toBeUndefined();
    });

    it('should sanitize array of transactions', () => {
      const transactions = [mockTransaction, { ...mockTransaction, id: 2 }];
      const results = sanitizeTransactions(transactions, SanitizationLevel.MINIMAL);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id', 1);
      expect(results[1]).toHaveProperty('id', 2);
    });

    it('should preserve specified fields', () => {
      const result = ResourceSanitizer.sanitize(mockTransaction, {
        resourceType: ResourceType.TRANSACTION,
        level: SanitizationLevel.MINIMAL,
        preserveFields: ['gateway_response', 'fees'],
      });

      // Should have minimal fields + preserved fields
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('gateway_response', 'Approved');
      expect(result).toHaveProperty('fees', 750);
    });

    it('should use STANDARD level by default', () => {
      const result = sanitizeTransactions([mockTransaction]);

      // Should have standard-level fields
      expect(result[0]).toHaveProperty('gateway_response');
      expect(result[0].authorization).toBeDefined();
      expect(result[0].log).toBeUndefined();
    });
  });

  describe('Customer Sanitization', () => {
    const mockCustomer = {
      id: 100,
      email: 'test@example.com',
      customer_code: 'CUS_xxx',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+2341234567890',
      risk_action: 'default',
      createdAt: '2024-01-01T12:00:00Z',
      international_format_phone: '+234 123 456 7890',
      identified: true,
      authorizations: [
        {
          authorization_code: 'AUTH_1',
          bin: '408408',
          last4: '4081',
          bank: 'Bank 1',
          brand: 'visa',
          card_type: 'visa',
          exp_month: '12',
          exp_year: '2025',
        },
        {
          authorization_code: 'AUTH_2',
          bin: '539983',
          last4: '8381',
          bank: 'Bank 2',
          brand: 'mastercard',
          card_type: 'mastercard',
          exp_month: '06',
          exp_year: '2026',
        },
        {
          authorization_code: 'AUTH_3',
          bin: '506099',
          last4: '0229',
          bank: 'Bank 3',
          brand: 'verve',
          card_type: 'verve',
          exp_month: '03',
          exp_year: '2027',
        },
        {
          authorization_code: 'AUTH_4',
          bin: '408408',
          last4: '4082',
          bank: 'Bank 4',
          brand: 'visa',
          card_type: 'visa',
          exp_month: '09',
          exp_year: '2025',
        },
      ],
    } as unknown as PaystackCustomer;

    it('should sanitize customer with MINIMAL level', () => {
      const result = sanitizeCustomers([mockCustomer], SanitizationLevel.MINIMAL)[0];

      expect(result).toEqual({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
      });
    });

    it('should sanitize customer with STANDARD level', () => {
      const result = sanitizeCustomers([mockCustomer])[0];

      expect(result).toMatchObject({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2341234567890',
        risk_action: 'default',
        createdAt: '2024-01-01T12:00:00Z',
      });

      // Should have authorizations with basic fields only
      expect(result.authorizations).toHaveLength(3); // Limited to 3
      expect(result.authorizations?.[0]).toMatchObject({
        authorization_code: 'AUTH_1',
        bin: '408408',
        last4: '4081',
        bank: 'Bank 1',
        brand: 'visa',
      });
      // Should not have exp_month/exp_year at standard level
      expect(result.authorizations?.[0]).not.toHaveProperty('exp_month');
    });

    it('should limit nested array items', () => {
      const result = sanitizeCustomers([mockCustomer])[0];

      // Should have limited authorizations (config specifies 3)
      expect(result.authorizations).toHaveLength(3);
      expect(result.authorizations?.[0]).toMatchObject({
        authorization_code: 'AUTH_1',
        bin: '408408',
        last4: '4081',
      });
    });

    it('should sanitize customer with DETAILED level', () => {
      const result = sanitizeCustomers([mockCustomer], SanitizationLevel.DETAILED)[0];

      expect(result).toMatchObject({
        international_format_phone: '+234 123 456 7890',
        identified: true,
      });

      // Should have more authorization fields
      expect(result.authorizations?.[0]).toHaveProperty('exp_month');
      expect(result.authorizations?.[0]).toHaveProperty('exp_year');
      // Limited to 5 at detailed level
      expect(result.authorizations).toHaveLength(4); // Only 4 available in mock
    });

    it('should handle missing nested objects', () => {
      const customerWithoutAuths = { ...mockCustomer, authorizations: undefined };

      const result = sanitizeCustomers([customerWithoutAuths])[0];

      expect(result.authorizations).toBeUndefined();
      expect(result).toHaveProperty('email');
    });
  });

  describe('Refund Sanitization', () => {
    const mockRefund = {
      id: 1,
      amount: 50000,
      currency: 'NGN',
      status: 'processed',
      transaction_reference: 'TXN_REF_123',
      refunded_at: '2024-01-02T12:00:00Z',
      refunded_by: 'admin@example.com',
      refund_type: 'full',
      domain: 'live',
      createdAt: '2024-01-02T12:00:00Z',
      transaction_amount: 50000,
      deducted_amount: '50000',
      customer_note: 'Customer requested refund',
      merchant_note: 'Approved by admin',
      reason: 'duplicate',
      customer: {
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        phone: '+2341234567890',
        first_name: 'John',
        last_name: 'Doe',
        risk_action: 'default',
      },
    } as unknown as PaystackRefund;

    it('should sanitize refund with MINIMAL level', () => {
      const result = sanitizeRefunds([mockRefund], SanitizationLevel.MINIMAL)[0];

      expect(result).toMatchObject({
        id: 1,
        amount: 50000,
        currency: 'NGN',
        status: 'processed',
        transaction_reference: 'TXN_REF_123',
        refunded_at: '2024-01-02T12:00:00Z',
      });

      // Should not have customer at minimal level
      expect(result.customer).toBeUndefined();
    });

    it('should sanitize refund with STANDARD level', () => {
      const result = sanitizeRefunds([mockRefund])[0];

      expect(result).toMatchObject({
        refunded_by: 'admin@example.com',
        refund_type: 'full',
        domain: 'live',
      });

      // Should have customer with limited fields
      expect(result.customer).toEqual({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
      });

      // Should not have notes at standard level
      expect(result.customer_note).toBeUndefined();
      expect(result.merchant_note).toBeUndefined();
    });

    it('should sanitize refund with DETAILED level', () => {
      const result = sanitizeRefunds([mockRefund], SanitizationLevel.DETAILED)[0];

      expect(result).toMatchObject({
        transaction_amount: 50000,
        deducted_amount: '50000',
        customer_note: 'Customer requested refund',
        merchant_note: 'Approved by admin',
        reason: 'duplicate',
      });

      // Should have customer with more fields
      expect(result.customer).toMatchObject({
        phone: '+2341234567890',
        first_name: 'John',
        last_name: 'Doe',
      });
    });
  });

  describe('Payout Sanitization', () => {
    const mockPayout = {
      id: 1,
      total_amount: 100000,
      effective_amount: 98000,
      currency: 'NGN',
      status: 'success',
      settlement_date: '2024-01-01',
      settled_by: 'system',
      total_fees: 2000,
      total_processed: 100000,
      domain: 'live',
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-01T13:00:00Z',
      deductions: 0,
      integration: 123,
      subaccount: {
        id: 1,
        subaccount_code: 'SUB_xxx',
        business_name: 'Test Business',
        account_number: '1234567890',
        settlement_bank: 'Test Bank',
        primary_contact_email: 'contact@example.com',
        primary_contact_name: 'Contact Name',
        primary_contact_phone: '+2341234567890',
      },
    } as unknown as PaystackPayout;

    it('should sanitize payout with MINIMAL level', () => {
      const result = sanitizePayouts([mockPayout], SanitizationLevel.MINIMAL)[0];

      expect(result).toMatchObject({
        id: 1,
        total_amount: 100000,
        currency: 'NGN',
        status: 'success',
        settlement_date: '2024-01-01',
      });

      // Should not have subaccount at minimal
      expect(result.subaccount).toBeUndefined();
    });

    it('should sanitize payout with STANDARD level', () => {
      const result = sanitizePayouts([mockPayout])[0];

      expect(result).toMatchObject({
        effective_amount: 98000,
        settled_by: 'system',
        total_fees: 2000,
        total_processed: 100000,
        domain: 'live',
      });

      // Should have subaccount with basic fields
      expect(result.subaccount).toMatchObject({
        id: 1,
        subaccount_code: 'SUB_xxx',
        business_name: 'Test Business',
        primary_contact_email: 'contact@example.com',
      });

      // Should not have account details at standard
      expect(result.subaccount).not.toHaveProperty('account_number');
    });

    it('should sanitize payout with DETAILED level', () => {
      const result = sanitizePayouts([mockPayout], SanitizationLevel.DETAILED)[0];

      expect(result).toMatchObject({
        deductions: 0,
        updatedAt: '2024-01-01T13:00:00Z',
      });

      // Should have subaccount with more fields
      expect(result.subaccount).toMatchObject({
        account_number: '1234567890',
        settlement_bank: 'Test Bank',
        primary_contact_name: 'Contact Name',
      });
    });
  });

  describe('Dispute Sanitization', () => {
    const mockDispute = {
      id: 1,
      refund_amount: 50000,
      currency: 'NGN',
      status: 'awaiting-merchant-feedback',
      resolution: null,
      category: 'chargeback',
      domain: 'live',
      transaction_reference: 'TXN_REF_123',
      dueAt: '2024-01-10T12:00:00Z',
      resolvedAt: '2024-01-15T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-15T12:00:00Z',
      bin: '408408',
      last4: '4081',
      note: 'Customer disputes charge',
      customer: {
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
        phone: '+2341234567890',
        first_name: 'John',
        last_name: 'Doe',
        risk_action: 'default',
      },
      transaction: {
        id: 1,
        reference: 'TXN_REF_123',
        amount: 50000,
        currency: 'NGN',
        status: 'success',
        channel: 'card',
        gateway_response: 'Approved',
        paid_at: '2024-01-01T12:00:00Z',
      },
      history: [
        { status: 'pending', by: 'system', createdAt: '2024-01-01T12:00:00Z' },
        { status: 'awaiting-merchant-feedback', by: 'customer', createdAt: '2024-01-02T12:00:00Z' },
        { status: 'resolved', by: 'admin', createdAt: '2024-01-15T12:00:00Z' },
      ],
      messages: [
        { sender: 'customer', body: 'I did not make this transaction', createdAt: '2024-01-01T12:00:00Z' },
        { sender: 'merchant', body: 'We will investigate', createdAt: '2024-01-02T12:00:00Z' },
      ],
    } as unknown as PaystackDispute;

    it('should sanitize dispute with MINIMAL level', () => {
      const result = sanitizeDisputes([mockDispute], SanitizationLevel.MINIMAL)[0];

      expect(result).toMatchObject({
        id: 1,
        refund_amount: 50000,
        currency: 'NGN',
        status: 'awaiting-merchant-feedback',
        category: 'chargeback',
        dueAt: '2024-01-10T12:00:00Z',
      });

      // Should not have nested objects at minimal
      expect(result.customer).toBeUndefined();
      expect(result.transaction).toBeUndefined();
      expect(result.history).toBeUndefined();
    });

    it('should sanitize dispute with STANDARD level', () => {
      const result = sanitizeDisputes([mockDispute])[0];

      expect(result).toMatchObject({
        resolution: null,
        transaction_reference: 'TXN_REF_123',
        resolvedAt: '2024-01-15T12:00:00Z',
        domain: 'live',
      });

      // Should have customer with limited fields
      expect(result.customer).toEqual({
        id: 100,
        email: 'test@example.com',
        customer_code: 'CUS_xxx',
      });

      // Should have transaction with key fields
      expect(result.transaction).toMatchObject({
        id: 1,
        reference: 'TXN_REF_123',
        amount: 50000,
        currency: 'NGN',
        status: 'success',
        channel: 'card',
      });

      // Should have limited history (5 items max)
      expect(result.history).toHaveLength(3);
      expect(result.history?.[0]).toMatchObject({
        status: 'pending',
        by: 'system',
        createdAt: '2024-01-01T12:00:00Z',
      });

      // Should not have messages at standard
      expect(result.messages).toBeUndefined();
    });

    it('should sanitize dispute with DETAILED level', () => {
      const result = sanitizeDisputes([mockDispute], SanitizationLevel.DETAILED)[0];

      expect(result).toMatchObject({
        bin: '408408',
        last4: '4081',
        note: 'Customer disputes charge',
        updatedAt: '2024-01-15T12:00:00Z',
      });

      // Should have customer with more fields
      expect(result.customer).toMatchObject({
        phone: '+2341234567890',
        first_name: 'John',
        last_name: 'Doe',
      });

      // Should have transaction with more fields
      expect(result.transaction).toMatchObject({
        gateway_response: 'Approved',
        paid_at: '2024-01-01T12:00:00Z',
      });

      // Should have messages
      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[0]).toMatchObject({
        sender: 'customer',
        body: 'I did not make this transaction',
      });
    });

    it('should limit history array items', () => {
      const disputeWithManyHistory = {
        ...mockDispute,
        history: Array.from({ length: 15 }, (_, i) => ({
          status: 'pending',
          by: 'system',
          createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
        })),
      } as unknown as PaystackDispute;

      const result = sanitizeDisputes([disputeWithManyHistory])[0];

      // Should limit to 5 at standard level
      expect(result.history).toHaveLength(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      const results = sanitizeTransactions([], SanitizationLevel.STANDARD);
      expect(results).toEqual([]);
    });

    it('should handle null nested objects', () => {
      const transaction = {
        id: 1,
        reference: 'ref123',
        customer: null,
      } as unknown as PaystackTransaction;

      const result = sanitizeTransactions([transaction])[0];

      expect(result.customer).toBeNull();
    });

    it('should default to STANDARD level when not specified', () => {
      const mockTransaction = {
        id: 1,
        reference: 'ref123',
        gateway_response: 'Approved',
      } as unknown as PaystackTransaction;

      const result = sanitizeTransactions([mockTransaction])[0];

      // Should have standard level fields
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('gateway_response', 'Approved');
    });

    it('should handle missing fields gracefully', () => {
      const incompleteTransaction = {
        id: 1,
        reference: 'ref123',
      } as unknown as PaystackTransaction;

      const result = sanitizeTransactions([incompleteTransaction])[0];

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('reference');
      // Missing fields should just be absent
      expect(result.customer).toBeUndefined();
    });

    it('should build nested objects for deep dot paths', () => {
      const source = {
        customer: {
          address: {
            city: 'Lagos',
            country: 'NG',
            geo: { lat: 6.4551, lng: 3.3942 },
          },
        },
      } as Record<string, unknown>;

      const result = (
        ResourceSanitizer as unknown as {
          selectFields: (source: Record<string, unknown>, fields: string[]) => Record<string, unknown>;
        }
      ).selectFields(source, ['customer.address.city', 'customer.address.geo.lat']);

      expect(result).toEqual({
        customer: {
          address: {
            city: 'Lagos',
            geo: { lat: 6.4551 },
          },
        },
      });
    });
  });
});
