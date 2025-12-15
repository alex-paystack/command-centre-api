import { validateDateRange } from './utils';

describe('validateDateRange', () => {
  describe('when no dates are provided', () => {
    it('should return valid when both from and to are undefined', () => {
      const result = validateDateRange(undefined, undefined);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.daysDifference).toBeUndefined();
    });

    it('should return valid when both from and to are not provided', () => {
      const result = validateDateRange();

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('when only one date is provided', () => {
    it('should return valid when only from date is provided within 30 days of today', () => {
      const today = new Date();
      const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
      const result = validateDateRange(tenDaysAgo.toISOString().split('T')[0], undefined);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when only from date exceeds 30 days from today', () => {
      const today = new Date();
      const fortyDaysAgo = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000);
      const result = validateDateRange(fortyDaysAgo.toISOString().split('T')[0], undefined);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('should return valid when only to date is provided within 30 days of today', () => {
      const today = new Date();
      const tenDaysAhead = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
      const result = validateDateRange(undefined, tenDaysAhead.toISOString().split('T')[0]);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when only to date exceeds 30 days from today', () => {
      const today = new Date();
      const fortyDaysAhead = new Date(today.getTime() + 40 * 24 * 60 * 60 * 1000);
      const result = validateDateRange(undefined, fortyDaysAhead.toISOString().split('T')[0]);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('30 days');
    });
  });

  describe('date format validation', () => {
    it('should return error for invalid from date format', () => {
      const result = validateDateRange('invalid-date', '2024-01-31');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Invalid 'from' date format: invalid-date. Please use ISO 8601 format (e.g., 2024-01-01)",
      );
    });

    it('should return error for invalid to date format', () => {
      const result = validateDateRange('2024-01-01', 'not-a-date');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid 'to' date format: not-a-date. Please use ISO 8601 format (e.g., 2024-01-01)");
    });

    it('should return error for both invalid dates', () => {
      const result = validateDateRange('bad-from', 'bad-to');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid 'from' date format: bad-from. Please use ISO 8601 format (e.g., 2024-01-01)");
    });

    it('should accept ISO 8601 date formats', () => {
      const result = validateDateRange('2024-01-01', '2024-01-15');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('date range logic validation', () => {
    it('should return error when from date is after to date', () => {
      const result = validateDateRange('2024-01-31', '2024-01-01');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("The 'from' date cannot be after the 'to' date");
    });

    it('should accept when from date equals to date (same day)', () => {
      const result = validateDateRange('2024-01-01', '2024-01-01');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(0);
    });
  });

  describe('30-day limit validation', () => {
    it('should return valid for a range of exactly 30 days', () => {
      const result = validateDateRange('2024-01-01', '2024-01-31');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(30);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for a range less than 30 days', () => {
      const result = validateDateRange('2024-01-01', '2024-01-15');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(14);
    });

    it('should return valid for a 1-day range', () => {
      const result = validateDateRange('2024-01-01', '2024-01-02');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(1);
    });

    it('should return error for a range exceeding 30 days', () => {
      const result = validateDateRange('2024-01-01', '2024-02-01');

      expect(result.isValid).toBe(false);
      expect(result.daysDifference).toBe(31);
      expect(result.error).toBe(
        'Date range exceeds the maximum allowed period of 30 days. The requested range is 31 days. Please narrow your date range.',
      );
    });

    it('should return error for a range of 60 days', () => {
      const result = validateDateRange('2024-01-01', '2024-03-01');

      expect(result.isValid).toBe(false);
      expect(result.daysDifference).toBe(60);
      expect(result.error).toContain('60 days');
    });

    it('should return error for a range of 90 days', () => {
      const result = validateDateRange('2024-01-01', '2024-03-31');

      expect(result.isValid).toBe(false);
      expect(result.daysDifference).toBe(90);
      expect(result.error).toContain('90 days');
    });
  });

  describe('edge cases', () => {
    it('should handle leap year correctly (Feb 29)', () => {
      const result = validateDateRange('2024-02-01', '2024-02-29');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(28);
    });

    it('should handle year boundary correctly', () => {
      const result = validateDateRange('2023-12-15', '2024-01-14');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(30);
    });

    it('should handle dates with time components (ISO 8601 datetime)', () => {
      const result = validateDateRange('2024-01-01T00:00:00Z', '2024-01-15T23:59:59Z');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(14);
    });

    it('should handle dates far in the future', () => {
      const result = validateDateRange('2024-01-01', '2024-12-31');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('365 days');
    });

    it('should handle dates with different month lengths', () => {
      // January has 31 days
      const result = validateDateRange('2024-01-01', '2024-01-31');
      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(30);
    });
  });

  describe('real-world scenarios', () => {
    it('should validate "last 7 days" range', () => {
      const today = new Date('2024-06-15');
      const weekAgo = new Date('2024-06-08');

      const result = validateDateRange(weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(7);
    });

    it('should validate "last 30 days" range', () => {
      const today = new Date('2024-06-15');
      const thirtyDaysAgo = new Date('2024-05-16');

      const result = validateDateRange(thirtyDaysAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(30);
    });

    it('should reject "last 60 days" range', () => {
      const today = new Date('2024-06-15');
      const sixtyDaysAgo = new Date('2024-04-16');

      const result = validateDateRange(sixtyDaysAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);

      expect(result.isValid).toBe(false);
      expect(result.daysDifference).toBe(60);
      expect(result.error).toContain('60 days');
    });

    it('should validate "this month" range (max 31 days)', () => {
      const result = validateDateRange('2024-01-01', '2024-01-31');

      expect(result.isValid).toBe(true);
      expect(result.daysDifference).toBe(30);
    });

    it('should reject "last quarter" range (90 days)', () => {
      const result = validateDateRange('2024-01-01', '2024-03-31');

      expect(result.isValid).toBe(false);
      expect(result.daysDifference).toBe(90);
    });
  });
});
