import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('returns cached value on success', async () => {
    mockCacheManager.get.mockResolvedValueOnce({ foo: 'bar' });

    const result = await service.safeGet<{ foo: string }>('key');

    expect(result).toEqual({ foo: 'bar' });
    expect(mockCacheManager.get).toHaveBeenCalledWith('key');
  });

  it('swallows errors on get and returns undefined', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockCacheManager.get.mockRejectedValueOnce(new Error('boom'));

    const result = await service.safeGet('key');

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('sets value with default TTL', async () => {
    mockCacheManager.set.mockResolvedValueOnce(undefined);

    await service.safeSet('key', { foo: 'bar' });

    expect(mockCacheManager.set).toHaveBeenCalledWith('key', { foo: 'bar' }, 86_400_000);
  });

  it('sets value with custom TTL', async () => {
    mockCacheManager.set.mockResolvedValueOnce(undefined);

    await service.safeSet('key', { foo: 'bar' }, 1000);

    expect(mockCacheManager.set).toHaveBeenCalledWith('key', { foo: 'bar' }, 1000);
  });

  it('swallows errors on set', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockCacheManager.set.mockRejectedValueOnce(new Error('boom'));

    await expect(service.safeSet('key', { foo: 'bar' })).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });
});
