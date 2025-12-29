import {
  findUnsupportedFilters,
  buildUnsupportedFilterError,
  TRANSACTION_ALLOWED_FILTERS,
  CUSTOMER_ALLOWED_FILTERS,
  REFUND_ALLOWED_FILTERS,
  PAYOUT_ALLOWED_FILTERS,
  DISPUTE_ALLOWED_FILTERS,
} from './retreival-filter-validation';

describe('Retrieval Filter Validation', () => {
  describe('findUnsupportedFilters', () => {
    describe('with transaction filters', () => {
      it('should return empty array when all filters are supported', () => {
        const input = {
          perPage: 50,
          page: 1,
          status: 'success',
          from: '2024-01-01',
          to: '2024-01-31',
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });

      it('should identify single unsupported filter', () => {
        const input = {
          perPage: 50,
          invalidFilter: 'value',
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual(['invalidFilter']);
      });

      it('should identify multiple unsupported filters', () => {
        const input = {
          perPage: 50,
          invalidFilter1: 'value1',
          invalidFilter2: 'value2',
          status: 'success',
          unknownParam: 'value3',
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toContain('invalidFilter1');
        expect(unsupported).toContain('invalidFilter2');
        expect(unsupported).toContain('unknownParam');
        expect(unsupported).toHaveLength(3);
      });

      it('should handle empty input object', () => {
        const input = {};

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });

      it('should validate all transaction-specific filters', () => {
        const input = {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-01-31',
          status: 'success',
          channel: 'card',
          customer: 'CUST_123',
          amount: 10000,
          currency: 'NGN',
          subaccountCode: 'ACCT_123',
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });
    });

    describe('with customer filters', () => {
      it('should return empty array for valid customer filters', () => {
        const input = {
          perPage: 50,
          page: 1,
          email: 'test@example.com',
          accountNumber: '0123456789',
        };

        const unsupported = findUnsupportedFilters(input, CUSTOMER_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });

      it('should reject date filters for customers', () => {
        const input = {
          perPage: 50,
          from: '2024-01-01',
          to: '2024-01-31',
        };

        const unsupported = findUnsupportedFilters(input, CUSTOMER_ALLOWED_FILTERS);

        expect(unsupported).toContain('from');
        expect(unsupported).toContain('to');
      });
    });

    describe('with refund filters', () => {
      it('should return empty array for valid refund filters', () => {
        const input = {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-01-31',
          status: 'processed',
          amount: 5000,
          amountOperator: 'gte',
          transaction: 'TRX_123',
          search: 'query',
        };

        const unsupported = findUnsupportedFilters(input, REFUND_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });

      it('should reject invalid refund filters', () => {
        const input = {
          perPage: 50,
          channel: 'card',
        };

        const unsupported = findUnsupportedFilters(input, REFUND_ALLOWED_FILTERS);

        expect(unsupported).toContain('channel');
      });
    });

    describe('with payout filters', () => {
      it('should return empty array for valid payout filters', () => {
        const input = {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-01-31',
          status: 'success',
          subaccount: 'SUBACC_123',
          payoutId: 'PAYOUT_123',
        };

        const unsupported = findUnsupportedFilters(input, PAYOUT_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });
    });

    describe('with dispute filters', () => {
      it('should return empty array for valid dispute filters', () => {
        const input = {
          perPage: 50,
          page: 1,
          from: '2024-01-01',
          to: '2024-01-31',
          status: 'awaiting-merchant-feedback',
          ignoreResolved: true,
          transaction: 'TRX_123',
          category: 'chargeback',
          resolution: 'merchant-accepted',
        };

        const unsupported = findUnsupportedFilters(input, DISPUTE_ALLOWED_FILTERS);

        expect(unsupported).toEqual([]);
      });
    });

    describe('edge cases', () => {
      it('should handle input with null values', () => {
        const input = {
          perPage: 50,
          status: null,
          invalidFilter: null,
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual(['invalidFilter']);
      });

      it('should handle input with undefined values', () => {
        const input = {
          perPage: 50,
          status: undefined,
          invalidFilter: undefined,
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toEqual(['invalidFilter']);
      });

      it('should be case-sensitive', () => {
        const input = {
          PerPage: 50, // Wrong case
          PAGE: 1, // Wrong case
        };

        const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

        expect(unsupported).toContain('PerPage');
        expect(unsupported).toContain('PAGE');
      });
    });
  });

  describe('buildUnsupportedFilterError', () => {
    describe('singular unsupported filter', () => {
      it('should build error message with singular grammar', () => {
        const unsupportedFilters = ['invalidFilter'];
        const result = buildUnsupportedFilterError('transactions', unsupportedFilters, TRANSACTION_ALLOWED_FILTERS);

        expect(result.error).toContain('invalidFilter is not available for transactions');
      });

      it('should include all supported filters in error message', () => {
        const unsupportedFilters = ['foo'];
        const result = buildUnsupportedFilterError('transactions', unsupportedFilters, TRANSACTION_ALLOWED_FILTERS);

        expect(result.error).toContain('Supported filters: perPage, page, from, to, status, channel');
      });
    });

    describe('multiple unsupported filters', () => {
      it('should build error message with plural grammar', () => {
        const unsupportedFilters = ['filter1', 'filter2'];
        const result = buildUnsupportedFilterError('customers', unsupportedFilters, CUSTOMER_ALLOWED_FILTERS);

        expect(result.error).toContain('filter1, filter2 are not available for customers');
      });

      it('should join multiple filters with commas', () => {
        const unsupportedFilters = ['filter1', 'filter2', 'filter3'];
        const result = buildUnsupportedFilterError('refunds', unsupportedFilters, REFUND_ALLOWED_FILTERS);

        expect(result.error).toContain('filter1, filter2, filter3');
      });
    });

    describe('different resource labels', () => {
      it('should use correct resource label for transactions', () => {
        const result = buildUnsupportedFilterError('transactions', ['foo'], TRANSACTION_ALLOWED_FILTERS);

        expect(result.error).toContain('for transactions');
      });

      it('should use correct resource label for customers', () => {
        const result = buildUnsupportedFilterError('customers', ['foo'], CUSTOMER_ALLOWED_FILTERS);

        expect(result.error).toContain('for customers');
      });

      it('should use correct resource label for refunds', () => {
        const result = buildUnsupportedFilterError('refunds', ['foo'], REFUND_ALLOWED_FILTERS);

        expect(result.error).toContain('for refunds');
      });

      it('should use correct resource label for payouts', () => {
        const result = buildUnsupportedFilterError('payouts', ['foo'], PAYOUT_ALLOWED_FILTERS);

        expect(result.error).toContain('for payouts');
      });

      it('should use correct resource label for disputes', () => {
        const result = buildUnsupportedFilterError('disputes', ['foo'], DISPUTE_ALLOWED_FILTERS);

        expect(result.error).toContain('for disputes');
      });
    });

    describe('error message format', () => {
      it('should match expected structure for single filter', () => {
        const result = buildUnsupportedFilterError('transactions', ['foo'], ['perPage', 'page', 'status']);

        expect(result.error).toBe(
          'The filter option foo is not available for transactions. Supported filters: perPage, page, status.',
        );
      });

      it('should match expected structure for multiple filters', () => {
        const result = buildUnsupportedFilterError('customers', ['foo', 'bar'], ['perPage', 'page']);

        expect(result.error).toBe(
          'The filter options foo, bar are not available for customers. Supported filters: perPage, page.',
        );
      });

      it('should handle many supported filters', () => {
        const result = buildUnsupportedFilterError('transactions', ['invalid'], TRANSACTION_ALLOWED_FILTERS);

        expect(result.error).toContain(
          'perPage, page, from, to, status, channel, customer, amount, currency, subaccountCode',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty unsupported filters array', () => {
        const result = buildUnsupportedFilterError('transactions', [], TRANSACTION_ALLOWED_FILTERS);

        // With empty array, should still produce a message (though this scenario shouldn't happen in practice)
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      });

      it('should handle special characters in filter names', () => {
        const result = buildUnsupportedFilterError('transactions', ['filter_name', 'filter-name'], ['perPage']);

        expect(result.error).toContain('filter_name');
        expect(result.error).toContain('filter-name');
      });
    });
  });

  describe('integration: findUnsupportedFilters + buildUnsupportedFilterError', () => {
    it('should work together to produce complete validation flow', () => {
      const input = {
        perPage: 50,
        invalidFilter1: 'value1',
        status: 'success',
        unknownParam: 'value2',
      };

      const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

      if (unsupported.length > 0) {
        const errorResult = buildUnsupportedFilterError('transactions', unsupported, TRANSACTION_ALLOWED_FILTERS);

        expect(errorResult.error).toContain('invalidFilter1');
        expect(errorResult.error).toContain('unknownParam');
        expect(errorResult.error).toContain('are not available');
        expect(errorResult.error).toContain('for transactions');
      }
    });

    it('should handle valid filters without error', () => {
      const input = {
        perPage: 50,
        page: 1,
        status: 'success',
      };

      const unsupported = findUnsupportedFilters(input, TRANSACTION_ALLOWED_FILTERS);

      expect(unsupported).toEqual([]);
    });
  });
});
