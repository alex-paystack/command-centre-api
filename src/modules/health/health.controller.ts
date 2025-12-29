import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoLogClass, NoTraceClass } from '@paystackhq/nestjs-observability';
import { HealthCheckService, HttpHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { PaystackResponse, APIError } from '~/common';
import { RedisHealthIndicator } from './redis-health.indicator';

export type HealthDetails = {
  application: { status: 'up'; message: string };
  mongodb?: { status: 'up' | 'down'; message: string };
  redis?: { status: 'up' | 'down'; message: string };
};

@ApiTags('health')
@NoLogClass()
@NoTraceClass()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Service health check' })
  async check() {
    const details: HealthDetails = {
      application: {
        status: 'up',
        message: `Application is healthy - timestamp: ${new Date().toISOString()}`,
      },
    };
    const state: { unhealthy: boolean; issueCode: string | null; issueMessage: string | null } = {
      unhealthy: false,
      issueCode: null,
      issueMessage: null,
    };

    // Add database health checks based on configuration
    if (this.db) {
      try {
        await this.db.pingCheck('mongodb', {
          timeout: 3000,
        });
        details['mongodb'] = {
          status: 'up',
          message: 'Mongodb connectivity is working as expected',
        };
      } catch (error) {
        details['mongodb'] = {
          status: 'down',
          message: error instanceof Error ? error.message : String(error),
        };
        state.unhealthy = true;
        state.issueCode = state.issueCode ?? 'mongodb_unavailable';
        state.issueMessage = state.issueMessage ?? 'Mongodb is unavailable';
      }
    }

    // Add Redis health check
    if (this.redis) {
      try {
        const redisResult = await this.redis.isHealthy('redis');
        const redisStatus = redisResult.redis as { status: 'up' | 'down'; message?: string };

        details['redis'] = {
          status: redisStatus.status,
          message: redisStatus.message || 'Redis connectivity is working as expected',
        };

        // Mark as unhealthy if Redis is down
        if (redisStatus.status === 'down') {
          state.unhealthy = true;
          state.issueCode = state.issueCode ?? 'redis_unavailable';
          state.issueMessage = state.issueMessage ?? 'Redis is unavailable';
        }
      } catch (error) {
        // Fallback error handling
        details['redis'] = {
          status: 'down',
          message: error instanceof Error ? error.message : String(error),
        };
        state.unhealthy = true;
        state.issueCode = state.issueCode ?? 'redis_unavailable';
        state.issueMessage = state.issueMessage ?? 'Redis is unavailable';
      }
    }

    if (state.unhealthy) {
      const message = state.issueMessage ?? 'One or more health checks failed';
      throw new APIError(message, 'HEALTH_CHECK_FAILED', details, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return PaystackResponse.success(details, 'Service is healthy');
  }
}
