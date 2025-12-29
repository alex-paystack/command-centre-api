import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { APP_GUARD } from '@nestjs/core';
import { ObservabilityModule } from '@paystackhq/nestjs-observability';
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
import cacheConfig from './config/cache.config';
import { DatabaseModule } from './database/database.module';
import type { CacheConfig } from './config/cache.config';

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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const cacheConfig = configService.get<CacheConfig>('cache');

        if (!cacheConfig) {
          throw new Error('Cache configuration not found');
        }

        // cache-manager with Keyv expects TTL in milliseconds
        // Build Redis URL with authentication and database
        let redisUrl = cacheConfig.writeUrl;

        // If authentication is provided, add it to the URL
        if (cacheConfig.username && cacheConfig.password) {
          const url = new URL(redisUrl);
          url.username = cacheConfig.username;
          url.password = cacheConfig.password;
          redisUrl = url.toString();
        }

        // Add database number to URL
        const url = new URL(redisUrl);
        url.pathname = `/${cacheConfig.db}`;
        redisUrl = url.toString();

        const keyvRedis = new KeyvRedis(redisUrl);

        const keyv = new Keyv({
          store: keyvRedis,
          ttl: cacheConfig.ttl, // Keyv uses milliseconds
        });

        return {
          stores: keyv, // NestJS cache-manager expects "stores" (plural), not "store"
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
