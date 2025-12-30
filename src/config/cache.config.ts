import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { createConfig, parseEnv, Environment } from './helpers';

const cacheConfigSchema = z.object({
  readUrl: z.string(),
  writeUrl: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  db: z.number(),
  ttl: z.number(),
});

export type CacheConfig = z.infer<typeof cacheConfigSchema>;

export default registerAs(
  'cache',
  (): CacheConfig =>
    createConfig({
      schema: cacheConfigSchema,

      // 1️⃣ DEFAULTS - Base configuration values
      defaults: {
        readUrl: 'redis://localhost:6379',
        writeUrl: 'redis://localhost:6379',
        db: 0,
        ttl: 10800000, // 3 hours (3 * 60 * 60 * 1000) in milliseconds
      },

      // 2️⃣ OVERRIDES - Environment-specific values
      overrides: {
        [Environment.DEVELOPMENT]: {},
        [Environment.STAGING]: {},
        [Environment.PRODUCTION]: {},
        [Environment.TEST]: {
          db: 1,
        },
        [Environment.E2E]: {
          readUrl: 'redis://localhost:6379',
          writeUrl: 'redis://localhost:6379',
          db: 1,
          ttl: 3600000, // 1 hour for tests (ms)
        },
      },

      // 3️⃣ ENVIRONMENT VARIABLES - Highest priority
      fromEnv: () => {
        const env = parseEnv({
          readUrl: 'REDIS_READ_URL',
          writeUrl: 'REDIS_WRITE_URL',
          username: 'REDIS_USERNAME',
          password: 'REDIS_PASSWORD',
          db: 'REDIS_DB',
          ttl: 'CACHE_TTL',
        }) as CacheConfig;

        // If READ_URL is not set, use WRITE_URL for both
        if (!env.readUrl && env.writeUrl) {
          env.readUrl = env.writeUrl;
        }

        return env;
      },
    }),
);
