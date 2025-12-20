import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoLogClass, NoTraceClass } from '@paystackhq/nestjs-observability';
import { HealthCheckService, HttpHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { PaystackResponse, APIError } from '~/common';
import { LangfuseService } from '~/common/observability/langfuse.service';

export type HealthDetails = {
  application: { status: 'up'; message: string };
  mongodb?: { status: 'up' | 'down'; message: string };
};

export type LangfuseHealthDetails = {
  status: 'up' | 'disabled' | 'error';
  enabled: boolean;
  baseUrl?: string;
  message: string;
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
    private langfuseService: LangfuseService,
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

    if (state.unhealthy) {
      const message = state.issueMessage ?? 'One or more health checks failed';
      throw new APIError(message, 'HEALTH_CHECK_FAILED', details, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return PaystackResponse.success(details, 'Service is healthy');
  }

  @Get('langfuse')
  @ApiOperation({ summary: 'Langfuse observability health check' })
  checkLangfuse() {
    const config = this.langfuseService.getConfig();
    const isEnabled = this.langfuseService.isEnabled();

    const details: LangfuseHealthDetails = {
      status: isEnabled ? 'up' : config?.enabled === false ? 'disabled' : 'error',
      enabled: config?.enabled || false,
      baseUrl: config?.baseUrl,
      message: isEnabled
        ? `Langfuse is operational at ${config?.baseUrl}`
        : config?.enabled === false
          ? 'Langfuse is disabled via LANGFUSE_ENABLED=false'
          : 'Langfuse configuration is invalid or credentials are missing',
    };

    return PaystackResponse.success(details, details.message);
  }
}
