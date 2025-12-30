import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const testKey = 'health:redis';
    const testValue = Date.now().toString();
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.cacheManager.set(testKey, testValue, 2000);
      const fetched = await this.cacheManager.get<string>(testKey);
      await this.cacheManager.del(testKey);

      if (fetched === testValue) {
        return indicator.up({ message: 'ok' });
      }

      return indicator.down({ error: 'Read-after-write failed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return indicator.down({ error: message });
    }
  }
}
