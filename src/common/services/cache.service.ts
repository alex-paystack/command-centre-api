import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private static readonly DEFAULT_TTL_MS = 86_400_000; // 24 hours

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async safeGet<T>(key: string) {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }

  async safeSet<T>(key: string, value: T, ttlMs = CacheService.DEFAULT_TTL_MS) {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
