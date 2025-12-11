import { z } from 'zod';

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
  E2E = 'e2e',
}

export function createConfig<T>(params: {
  schema: z.ZodSchema<T>;
  defaults: Partial<T>;
  overrides?: Record<Environment, Partial<T>>;
  fromEnv?: () => Partial<T>;
}): T {
  const env = process.env.NODE_ENV ?? Environment.DEVELOPMENT;

  return params.schema.parse({
    ...params.defaults,
    ...params.overrides?.[env],
    ...params.fromEnv?.(),
  });
}

export function parseEnv<T>(mappings: Record<string, string>): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, envVar] of Object.entries(mappings)) {
    const value = process.env[envVar];
    if (!value) continue;

    // Auto-detect type based on value
    if (value === 'true' || value === 'false') {
      result[key] = value === 'true';
    } else if (!isNaN(Number(value))) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
