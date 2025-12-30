import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { createHash } from 'crypto';
import { SaveChartDto } from './dto/save-chart.dto';

@Injectable()
export class ChartCacheService {
  private static readonly CHART_CACHE_TTL_MS = 86_400_000; // 24 hours
  private readonly logger = new Logger(ChartCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  buildCacheKey(
    chartId: string,
    userId: string,
    chartConfig: {
      resourceType: SaveChartDto['resourceType'];
      aggregationType: SaveChartDto['aggregationType'];
      from?: SaveChartDto['from'];
      to?: SaveChartDto['to'];
      status?: SaveChartDto['status'];
      currency?: SaveChartDto['currency'];
      channel?: SaveChartDto['channel'];
    },
  ) {
    const normalizedConfig = {
      resourceType: chartConfig.resourceType,
      aggregationType: chartConfig.aggregationType,
      from: chartConfig.from ?? null,
      to: chartConfig.to ?? null,
      status: chartConfig.status ?? null,
      currency: chartConfig.currency ?? null,
      channel: chartConfig.channel ?? null,
    };

    const hash = createHash('sha256').update(JSON.stringify(normalizedConfig)).digest('hex');
    return `saved-chart:${userId}:${chartId}:${hash}`;
  }

  async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }

  async safeSet<T>(key: string, value: T) {
    try {
      await this.cacheManager.set(key, value, ChartCacheService.CHART_CACHE_TTL_MS);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
