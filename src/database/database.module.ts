import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { DatabaseConfig } from '../config/database.config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): DatabaseConfig => {
        const config = configService.getOrThrow<DatabaseConfig>('database');
        // Handle MongoDB-specific URL construction
        if (config.type === 'mongodb') {
          // If URL is provided, use it directly
          if (config.url) {
            return {
              ...config,
              url: config.url,
            };
          }
          
          // Otherwise, construct URL from individual components
          const { username, password, host, port, database } = config;
          const url = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
          
          return {
            ...config,
            url,
          };
        }
        return config;
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
