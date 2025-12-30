import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ObservabilityModule } from '@paystackhq/nestjs-observability';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { ChatModule } from './modules/chat/chat.module';
import { ChartsModule } from './modules/charts/charts.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { Environment } from './config/helpers';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import cacheConfig, { CacheConfig } from './config/cache.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Ignore .env file in test environments to allow config overrides to work
      ignoreEnvFile: process.env.NODE_ENV === Environment.TEST || process.env.NODE_ENV === Environment.E2E,
      load: [databaseConfig, jwtConfig, cacheConfig],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const cacheConfig = configService.get<CacheConfig>('cache');

        if (!cacheConfig) {
          throw new Error('Cache configuration is missing');
        }

        const redisStore = new KeyvRedis({
          url: cacheConfig.writeUrl,
          database: cacheConfig.db,
          username: cacheConfig.username,
          password: cacheConfig.password,
        });

        const keyv = new Keyv({
          store: redisStore,
          namespace: 'command-centre-cache',
          ttl: cacheConfig.ttl,
        });

        return {
          stores: [keyv],
          ttl: cacheConfig.ttl,
        };
      },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    ChatModule,
    ChartsModule,
    ObservabilityModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
