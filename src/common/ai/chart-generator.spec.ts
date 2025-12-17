import { generateChartData } from './chart-generator';
import { AggregationType, ChartResourceType } from './chart-config';

describe('generateChartData', () => {
  const baseParams = {
    resourceType: ChartResourceType.TRANSACTION,
    aggregationType: AggregationType.BY_DAY,
    from: '2024-01-01',
    to: '2024-01-02',
  };

  it('yields the final success state so consumers receive it during iteration', async () => {
    const paystackService = {
      get: jest.fn().mockResolvedValue({ data: [] }),
    };

    const generator = generateChartData(baseParams, paystackService as never, 'jwt-token');

    const states: unknown[] = [];
    for await (const state of generator) {
      states.push(state);
    }

    expect(states.length).toBeGreaterThan(0);
    const finalState = states[states.length - 1] as Record<string, unknown>;
    expect(finalState.success).toBe(true);
    expect(finalState.message).toContain('No transactions found');
  });

  it('yields early validation errors (e.g., missing JWT) instead of hiding them', async () => {
    const paystackService = {
      get: jest.fn(),
    };

    const generator = generateChartData(baseParams, paystackService as never, '');

    const states: unknown[] = [];
    for await (const state of generator) {
      states.push(state);
    }

    expect(states).toHaveLength(1);
    const errorState = states[0] as Record<string, unknown>;
    expect(errorState.error).toMatch(/Authentication token not available/i);
    expect(paystackService.get).not.toHaveBeenCalled();
  });
});
