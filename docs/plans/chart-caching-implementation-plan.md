# Chart Data Caching Implementation Plan

## Overview

Add Redis-based caching for chart data in SavedChartService to improve performance when users request the same chart with unchanged parameters.

**Requirements:**

- Cache TTL: 3 hours (10,800,000 ms)
- Scope: Only saved charts (GET /charts/:id endpoint)
- Strategy: Separate cache entries for each parameter combination
- Cache Level: Processed chart data (ChartSuccessState)
- Graceful degradation: Cache failures should not break chart generation

## Current State

- ✅ cache.config.ts exists with Zod schema and environment-specific overrides
- ❌ Redis not in docker-compose.yml
- ❌ No cache packages installed
- ❌ CacheModule not configured in app.module.ts
- ❌ SavedChartService has TODO comment for caching (line 82)

## Implementation Steps

### 1. Infrastructure Setup

#### 1.1 Add Redis to Docker Compose

**File:** `docker-compose.yml`

Add Redis service after mongodb:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - '${HOST_REDIS_PORT:-6379}:6379'
  volumes:
    - redis_data:/data
  networks:
    - paystack-net
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 5s
    timeout: 3s
    retries: 5
```

Update volumes section:

```yaml
volumes:
  mongodb_data:
  redis_data: # Add this
```

Update app service dependencies:

```yaml
app:
  depends_on:
    - mongodb
    - redis # Add this
```

#### 1.2 Update Environment Variables

**File:** `.env.example`

Add Redis configuration section:

```env
# Redis Configuration (for chart data caching)
REDIS_READ_URL=redis://redis:6379
REDIS_WRITE_URL=redis://redis:6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=10800000  # 3 hours in milliseconds
```

#### 1.3 Update Cache Config TTL

**File:** `src/config/cache.config.ts`

Change default TTL from 7 days to 3 hours:

```typescript
defaults: {
  readUrl: 'redis://localhost:6379',
  writeUrl: 'redis://localhost:6379',
  db: 0,
  ttl: 10800000, // 3 hours (was 604800000)
},
```

### 2. Package Installation & Module Configuration

#### 2.1 Install Packages

```bash
pnpm add @nestjs/cache-manager cache-manager cache-manager-redis-store
pnpm add -D @types/cache-manager-redis-store
```

#### 2.2 Configure CacheModule

**File:** `src/app.module.ts`

Import dependencies at top:

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import cacheConfig from './config/cache.config';
import type { CacheConfig } from './config/cache.config';
```

Add cacheConfig to ConfigModule.load:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  ignoreEnvFile: process.env.NODE_ENV === Environment.TEST || process.env.NODE_ENV === Environment.E2E,
  load: [databaseConfig, jwtConfig, cacheConfig], // Add cacheConfig
}),
```

Add CacheModule after ConfigModule:

```typescript
CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const cacheConfig = configService.get<CacheConfig>('cache');

    return {
      store: await redisStore({
        url: cacheConfig.writeUrl,
        username: cacheConfig.username,
        password: cacheConfig.password,
        database: cacheConfig.db,
        ttl: cacheConfig.ttl,
      }),
      ttl: cacheConfig.ttl,
    };
  },
}),
```

### 3. Cache Key Generation Utility

#### 3.1 Create Cache Key Utility

**New File:** `src/modules/charts/utilities/cache-key.util.ts`

```typescript
import { createHash } from 'crypto';
import { ChartResourceType, AggregationType } from '~/common/ai/utilities/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

export interface CacheKeyParams {
  chartId: string;
  resourceType: ChartResourceType;
  aggregationType: AggregationType;
  from?: string;
  to?: string;
  status?: string;
  currency?: string;
  channel?: PaymentChannel;
}

/**
 * Generates deterministic cache key for chart data
 * Format: chart:{chartId}:{hash}
 */
export function generateCacheKey(params: CacheKeyParams): string {
  // Normalize optional params to null for consistent hashing
  const canonicalParams = {
    aggregationType: params.aggregationType,
    channel: params.channel ?? null,
    currency: params.currency ?? null,
    from: params.from ?? null,
    resourceType: params.resourceType,
    status: params.status ?? null,
    to: params.to ?? null,
  };

  const paramsString = JSON.stringify(canonicalParams);
  const hash = createHash('sha256').update(paramsString).digest('hex').substring(0, 12);

  return `chart:${params.chartId}:${hash}`;
}

export function getChartCachePattern(chartId: string): string {
  return `chart:${chartId}:*`;
}
```

#### 3.2 Create Unit Tests

**New File:** `src/modules/charts/utilities/cache-key.util.spec.ts`

Test cases:

- Consistent keys for identical parameters
- Different keys for different parameters
- Undefined/null treated consistently
- ChartId included in key
- Channel parameter handling

### 4. SavedChartService Integration

**File:** `src/modules/charts/saved-chart.service.ts`

#### 4.1 Add Imports

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { generateCacheKey } from './utilities/cache-key.util';
```

#### 4.2 Add CachedChartData Interface

```typescript
interface CachedChartData {
  label: string;
  chartType: string;
  chartData: ChartSuccessState['chartData'];
  chartSeries: ChartSuccessState['chartSeries'];
  summary: ChartSuccessState['summary'];
  message: string;
}
```

#### 4.3 Inject Logger and CacheManager

```typescript
export class SavedChartService {
  private readonly logger = new Logger(SavedChartService.name);

  constructor(
    private readonly savedChartRepository: SavedChartRepository,
    private readonly paystackApiService: PaystackApiService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}
}
```

#### 4.4 Modify getSavedChartWithData Method

Replace line 82 (TODO comment) through line 105 with:

```typescript
// Generate cache key from merged configuration
const cacheKey = generateCacheKey({
  chartId,
  resourceType: chartConfig.resourceType,
  aggregationType: chartConfig.aggregationType,
  from: chartConfig.from,
  to: chartConfig.to,
  status: chartConfig.status,
  currency: chartConfig.currency,
  channel: chartConfig.channel,
});

// Try cache first
try {
  const cachedData = await this.cacheManager.get<CachedChartData>(cacheKey);
  if (cachedData) {
    this.logger.log(`Cache hit for chart ${chartId} (key: ${cacheKey})`);

    const response = SavedChartResponseDto.fromEntity(savedChart) as SavedChartWithDataResponseDto;
    response.label = cachedData.label;
    response.chartType = cachedData.chartType;
    response.chartData = cachedData.chartData;
    response.chartSeries = cachedData.chartSeries;
    response.summary = cachedData.summary;
    response.message = cachedData.message;
    return response;
  }

  this.logger.log(`Cache miss for chart ${chartId} (key: ${cacheKey})`);
} catch (error) {
  this.logger.error(`Cache retrieval error for chart ${chartId}: ${error.message}`, error.stack);
}

// Cache miss or error - generate data
const generator = generateChartData(chartConfig, this.paystackApiService, jwtToken);

let finalResult: ChartGenerationState | undefined;
for await (const state of generator) {
  finalResult = state;
}

if (finalResult && 'error' in finalResult) {
  throw new ValidationError(finalResult.error, ErrorCodes.INVALID_PARAMS);
}

if (finalResult && 'success' in finalResult) {
  // Cache the result (fire-and-forget)
  const dataToCache: CachedChartData = {
    label: finalResult.label,
    chartType: finalResult.chartType,
    chartData: finalResult.chartData,
    chartSeries: finalResult.chartSeries,
    summary: finalResult.summary,
    message: finalResult.message,
  };

  try {
    await this.cacheManager.set(cacheKey, dataToCache);
    this.logger.log(`Cached chart data for chart ${chartId} (key: ${cacheKey})`);
  } catch (error) {
    this.logger.error(`Cache write error for chart ${chartId}: ${error.message}`, error.stack);
  }

  const response = SavedChartResponseDto.fromEntity(savedChart) as SavedChartWithDataResponseDto;
  response.label = finalResult.label;
  response.chartType = finalResult.chartType;
  response.chartData = finalResult.chartData;
  response.chartSeries = finalResult.chartSeries;
  response.summary = finalResult.summary;
  response.message = finalResult.message;
  return response;
}

throw new ValidationError('Failed to generate chart data', ErrorCodes.INVALID_PARAMS);
```

### 5. Testing

#### 5.1 Update SavedChartService Unit Tests

**File:** `src/modules/charts/saved-chart.service.spec.ts`

Add cache-related test cases:

- Cache hit returns cached data without generation
- Cache miss triggers generation and caching
- Cache retrieval errors trigger graceful degradation
- Cache write errors don't break response
- Different parameters generate different cache keys
- Same parameters use same cache key

#### 5.2 Integration Tests (Optional)

**New File:** `src/modules/charts/saved-chart-cache.integration.spec.ts`

Test with real Redis instance (requires Redis running on port 6379).

#### 5.3 E2E Tests

**File:** `test/e2e/charts/charts-cache.e2e-spec.ts`

Test cache behavior through full HTTP request/response cycle.

### 6. Health Check & Observability

#### 6.1 Create Redis Health Indicator

**New File:** `src/modules/health/redis-health.indicator.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const store = (this.cacheManager as any).store;
      await store.client.ping();
      return this.getStatus(key, true, { message: 'Redis is healthy' });
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'Redis health check failed',
      });
    }
  }
}
```

#### 6.2 Update Health Module

**File:** `src/modules/health/health.module.ts`

Add RedisHealthIndicator to providers:

```typescript
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator], // Add this
})
export class HealthModule {}
```

#### 6.3 Update Health Controller

**File:** `src/modules/health/health.controller.ts`

Add Redis health check to existing checks:

```typescript
import { RedisHealthIndicator } from './redis-health.indicator';

export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator, // Add this
  ) {}

  async check() {
    // ... existing code ...

    // Add Redis health check after MongoDB check
    if (this.redis) {
      try {
        await this.redis.isHealthy('redis');
        details['redis'] = {
          status: 'up',
          message: 'Redis connectivity is working as expected',
        };
      } catch (error) {
        details['redis'] = {
          status: 'down',
          message: error instanceof Error ? error.message : String(error),
        };
        state.unhealthy = true;
        state.issueCode = state.issueCode ?? 'redis_unavailable';
        state.issueMessage = state.issueMessage ?? 'Redis is unavailable';
      }
    }

    // ... rest of existing code ...
  }
}
```

## Critical Files Summary

### New Files (3)

1. `src/modules/charts/utilities/cache-key.util.ts` - Cache key generation
2. `src/modules/charts/utilities/cache-key.util.spec.ts` - Cache key tests
3. `src/modules/health/redis-health.indicator.ts` - Redis health check

### Modified Files (7)

1. `docker-compose.yml` - Add Redis service
2. `.env.example` - Add Redis environment variables
3. `src/config/cache.config.ts` - Update TTL to 3 hours
4. `src/app.module.ts` - Configure CacheModule with Redis
5. `src/modules/charts/saved-chart.service.ts` - Add caching logic
6. `src/modules/charts/saved-chart.service.spec.ts` - Add cache tests
7. `src/modules/health/health.module.ts` - Register RedisHealthIndicator
8. `src/modules/health/health.controller.ts` - Add Redis health check

## Performance Expectations

**Before Caching:**

- Chart generation: 2-5 seconds (API calls + processing)

**After Caching (cache hit):**

- Chart retrieval: < 100ms (Redis GET)

**Expected Cache Hit Rate:**

- Initial: 30-40%
- Mature: 60-70%

## Key Design Decisions

1. **3-hour TTL**: Balances performance with data freshness
2. **Separate cache entries per parameter combo**: Accurate data for each variation
3. **Graceful degradation**: Cache failures never break chart generation
4. **Fire-and-forget caching**: Cache writes don't block responses
5. **Deterministic cache keys**: SHA-256 hash ensures collision-free keys
6. **Logger integration**: Cache hits/misses logged for observability

## Testing Checklist

- [ ] Cache key utility unit tests pass
- [ ] SavedChartService unit tests with mocked cache pass
- [ ] Integration tests with real Redis pass (optional)
- [ ] E2E tests verify cache behavior
- [ ] Redis health check returns correct status
- [ ] Cache hit logging works
- [ ] Cache miss logging works
- [ ] Graceful degradation on Redis failure works
- [ ] Performance improvement verified (cached < 100ms)
