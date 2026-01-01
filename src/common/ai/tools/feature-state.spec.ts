import { createGetFeatureStateTool } from './feature-state';
import { PaystackApiService } from '../../services/paystack-api.service';
import { featureMap } from '../knowledge/feature-map';
import type { FeatureStateResult } from '../types/feature';

describe('Feature State Tool', () => {
  let mockPaystackService: jest.Mocked<PaystackApiService>;
  let mockGetAuthenticatedUser: jest.Mock;

  const mockToolCallOptions = {
    toolCallId: 'test-tool-call-id',
    messages: [],
  };

  beforeEach(() => {
    mockPaystackService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<PaystackApiService>;

    mockGetAuthenticatedUser = jest.fn().mockReturnValue({
      userId: 'test-user-id',
      jwtToken: 'test-token',
    });
  });

  it('returns state and description when integration fetch succeeds', async () => {
    mockPaystackService.get.mockResolvedValueOnce({
      status: true,
      message: 'ok',
      data: {
        transfer_approval: { enabled: true, level: 'dual', min_amount: 10000 },
      },
    });

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'transfer approval', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.success).toBe(true);
    expect(result?.feature?.slug).toBe('transfer-approval');
    expect(result?.state?.state).toBe('enabled');
    expect(result?.state?.ruleId).toBe('dual-on');
    expect(result?.description).toContain('support:transfer-approval');
  });

  it('falls back to description when integration fetch fails', async () => {
    mockPaystackService.get.mockRejectedValueOnce(new Error('Network'));

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'transfer approval', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.success).toBe(true);
    expect(result?.state).toBeNull();
    expect(result?.description).toBeTruthy();
    expect(result?.message).toContain('Live settings unavailable');
  });

  it('returns auth error when jwt is missing', async () => {
    mockGetAuthenticatedUser.mockReturnValueOnce({ userId: 'test-user-id', jwtToken: undefined });

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'transfer approval', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.success).toBe(false);
    expect(result?.error).toContain('Authentication token not available');
  });

  it('returns unknown_feature for unmatched feature', async () => {
    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'nonexistent feature', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.status).toBe('unknown_feature');
  });

  it('uses BM25 to resolve close synonyms', async () => {
    mockPaystackService.get.mockResolvedValueOnce({
      status: true,
      message: 'ok',
      data: { settlement: { schedule: 'weekly' } },
    });

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'payout schedule', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.feature?.slug).toBe('settlement-schedule');
  });

  it('respects rule ordering', async () => {
    mockPaystackService.get.mockResolvedValueOnce({
      status: true,
      message: 'ok',
      data: {
        transfer_approval: { enabled: true, level: 'single' },
      },
    });

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'transfer approval', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.state?.ruleId).toBe('single-on');
  });

  it('exposes ontology version for provenance', async () => {
    mockPaystackService.get.mockResolvedValueOnce({
      status: true,
      message: 'ok',
      data: {
        transfer_approval: { enabled: false },
      },
    });

    const tool = createGetFeatureStateTool(mockPaystackService, mockGetAuthenticatedUser);
    const result = (await tool.execute?.(
      { integrationId: 'int_123', feature: 'transfer approval', includeRag: true },
      mockToolCallOptions,
    )) as FeatureStateResult;

    expect(result?.provenance?.ontologyVersion).toBe(featureMap._meta.version);
  });
});
