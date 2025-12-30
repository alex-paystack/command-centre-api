import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { ChartCacheService } from './chart-cache.service';
import { AggregationType, ChartResourceType } from '~/common/ai/utilities/chart-config';

describe('ChartCacheService', () => {
  let service: ChartCacheService;
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const baseChartConfig = {
    resourceType: ChartResourceType.TRANSACTION,
    aggregationType: AggregationType.BY_DAY,
    from: '2024-01-01',
    to: '2024-01-31',
    status: 'success',
    currency: 'NGN',
    channel: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChartCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ChartCacheService>(ChartCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('buildCacheKey', () => {
    it('returns deterministic key for identical inputs', () => {
      const key1 = service.buildCacheKey('chart-1', 'user-1', baseChartConfig);
      const key2 = service.buildCacheKey('chart-1', 'user-1', {
        ...baseChartConfig,
        // order change should not affect result
        currency: 'NGN',
      });

      expect(key1).toBe(key2);
      expect(key1).toContain('saved-chart:user-1:chart-1');
    });

    it('produces different keys when config changes', () => {
      const keyBase = service.buildCacheKey('chart-1', 'user-1', baseChartConfig);
      const keyVariant = service.buildCacheKey('chart-1', 'user-1', {
        ...baseChartConfig,
        status: 'failed',
      });

      expect(keyBase).not.toBe(keyVariant);
    });
  });

  describe('safeGet', () => {
    it('returns cached value on success', async () => {
      mockCacheManager.get.mockResolvedValueOnce({ foo: 'bar' });

      const result = await service.safeGet<{ foo: string }>('key');

      expect(result).toEqual({ foo: 'bar' });
      expect(mockCacheManager.get).toHaveBeenCalledWith('key');
    });

    it('swallows errors and returns undefined', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockCacheManager.get.mockRejectedValueOnce(new Error('boom'));

      const result = await service.safeGet('key');

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('safeSet', () => {
    it('sets value with default TTL', async () => {
      mockCacheManager.set.mockResolvedValueOnce(undefined);

      await service.safeSet('key', { foo: 'bar' });

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'key',
        { foo: 'bar' },
        // 24 hours in milliseconds (ChartCacheService.CHART_CACHE_TTL_MS)
        86_400_000,
      );
    });

    it('logs and swallows errors on failure', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockCacheManager.set.mockRejectedValueOnce(new Error('boom'));

      await expect(service.safeSet('key', { foo: 'bar' })).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
