import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoLogClass, NoTraceClass } from '@paystackhq/nestjs-observability';
import { HealthCheckService, HttpHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { PaystackResponse, APIError } from '~/common';
import { RedisHealthIndicator } from './redis.health';

export type HealthDetails = {
  application: { status: 'up'; message: string };
  mongodb?: { status: 'up' | 'down'; message: string };
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

    if (this.redis) {
      const result = await this.redis.isHealthy('redis');

      if (result.redis?.status === 'up') {
        details['redis'] = {
          status: 'up',
          message: 'Redis connectivity is working as expected',
        };
      } else {
        details['redis'] = {
          status: 'down',
          message: result.redis?.error ?? result.error ?? 'Redis health check failed',
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
