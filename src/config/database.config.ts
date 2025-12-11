import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createConfig, parseEnv, Environment } from './helpers';
import path from 'path';

const databaseConfigSchema = z.object({
  type: z.enum(['postgres', 'mysql', 'mongodb']),
  host: z.string(),
  port: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  url: z.string().optional(),
  entities: z.array(z.string()),
  migrations: z.array(z.string()).optional(),
  synchronize: z.boolean(),
  logging: z.boolean(),
  autoLoadEntities: z.boolean().default(true),
  extra: z
    .object({
      ignoreUndefined: z.boolean().optional(),
    })
    .optional(),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema> & DataSourceOptions;

function getDatabaseConfig(): DatabaseConfig {
  return createConfig({
    schema: databaseConfigSchema,

    // 1️⃣ DEFAULTS - Base configuration values
    defaults: {
      type: 'mongodb' as const,
      port: 27017,
      // Pass through Mongo client options
      extra: {
        ignoreUndefined: true,
      },
      entities: [
        path.join(__dirname, '../database/entities/*.entity{.ts,.js}'),
        path.join(__dirname, '../modules/**/entities/*.entity{.ts,.js}'),
      ],
      migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')],
      synchronize: false,
      logging: false,
    },

    // 2️⃣ OVERRIDES - Environment-specific values
    overrides: {
      [Environment.DEVELOPMENT]: {
        logging: true,
        synchronize: true,
      },
      [Environment.STAGING]: {
        logging: true,
        synchronize: false,
      },
      [Environment.PRODUCTION]: {
        logging: false,
        synchronize: false,
      },
      [Environment.TEST]: {
        logging: false,
        synchronize: true,
        database: 'command-centre-api',
      },
      [Environment.E2E]: {
        logging: false,
        synchronize: true,
        database: 'command-centre-api',
        host: 'localhost',
        port: 27017,
        username: 'root',
        password: 'root',
      },
    },

    // 3️⃣ ENVIRONMENT VARIABLES - Highest priority
    fromEnv: () => {
      return parseEnv({
        type: `DATABASE_TYPE`,
        host: `DATABASE_HOST`,
        port: `DATABASE_PORT`,
        username: `DATABASE_USERNAME`,
        password: `DATABASE_PASSWORD`,
        database: `DATABASE_NAME`,
        url: `DATABASE_URL`,
        logging: `DATABASE_LOGGING`,
        synchronize: `DATABASE_SYNCHRONIZE`,
      });
    },
  }) as DatabaseConfig;
}

export default registerAs('database', getDatabaseConfig);

// Needed for typeorm migrations, don't use within NestJS
export const dataSource = () => new DataSource(getDatabaseConfig());
