import { validateChartParams } from './chart-validation';
import { AggregationType, ChartResourceType } from './chart-config';
import { PaymentChannel } from './types/data';

describe('validateChartParams', () => {
  it('accepts a valid aggregation/resource combination', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_STATUS,
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects invalid aggregation for resource type', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_TYPE, // refund-only
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('Invalid aggregation type');
  });

  it('rejects invalid status for resource type', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_STATUS,
      status: 'not-a-status',
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('Invalid status');
  });

  it('allows transaction channel when value is valid', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_CHANNEL,
      channel: PaymentChannel.CARD,
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects invalid channel value', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_CHANNEL,
      channel: 'made-up-channel' as PaymentChannel,
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('Invalid channel');
  });

  it('rejects channel when resource type is not transaction', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.REFUND,
      aggregationType: AggregationType.BY_STATUS,
      channel: PaymentChannel.BANK,
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('only supported for transactions');
  });

  it('rejects invalid date format', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-13-01', // invalid month
      to: '2024-01-15',
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain("Invalid 'from' date format");
  });

  it('rejects from date after to date', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-02-10',
      to: '2024-02-01',
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('cannot be after');
  });

  it('rejects date ranges exceeding 30 days', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-01-01',
      to: '2024-02-15', // 45 days apart
    });

    expect(result.isValid).toBe(false);
    expect((result as { error: string }).error).toContain('Date range exceeds the maximum allowed period');
  });

  it('accepts date ranges within 30 days', () => {
    const result = validateChartParams({
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-01-01',
      to: '2024-01-15',
    });

    expect(result.isValid).toBe(true);
  });
});
