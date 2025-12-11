import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@paystackhq/nestjs-observability';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { DummyModule } from './modules/dummy/dummy.module';
import { Environment } from './config/helpers';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Ignore .env file in test environments to allow config overrides to work
      ignoreEnvFile: process.env.NODE_ENV === Environment.TEST || process.env.NODE_ENV === Environment.E2E,
      load: [databaseConfig,
      ],
    }),
    DatabaseModule,
    HealthModule,
    DummyModule,
    ObservabilityModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
