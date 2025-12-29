import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly health: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Try to get the underlying Redis store and client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const store = (this.cacheManager as any).store as { client: { ping: () => Promise<string> } };

      // Ping Redis
      await store.client.ping();

      // Return healthy status using HealthIndicatorService
      return this.health.check(key).up({ message: 'Redis is healthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Redis health check failed';

      // Return unhealthy status using HealthIndicatorService
      return this.health.check(key).down({ message: errorMessage });
    }
  }
}
