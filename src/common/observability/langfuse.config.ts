/**
 * Langfuse configuration interface and validation
 */

export interface LangfuseConfig {
  enabled: boolean;
  secretKey?: string;
  publicKey?: string;
  baseUrl: string;
  flushInterval: number;
  flushAt: number;
  requestTimeout: number;
  sampleRate: number;
  maskInputs: boolean;
  maskOutputs: boolean;
}

export interface LangfuseConfigValidation {
  isValid: boolean;
  config?: LangfuseConfig;
  warnings?: string[];
  error?: string;
}

/**
 * Validates Langfuse configuration
 * @param config Partial configuration from environment variables
 * @returns Validation result with parsed config or error messages
 */
export function validateLangfuseConfig(config: Partial<LangfuseConfig>): LangfuseConfigValidation {
  const warnings: string[] = [];

  // If disabled, return valid but not configured
  if (!config.enabled) {
    return {
      isValid: true,
      config: {
        enabled: false,
        baseUrl: config.baseUrl || 'https://cloud.langfuse.com',
        flushInterval: config.flushInterval !== undefined ? config.flushInterval : 5000,
        flushAt: config.flushAt !== undefined ? config.flushAt : 15,
        requestTimeout: config.requestTimeout !== undefined ? config.requestTimeout : 10000,
        sampleRate: config.sampleRate !== undefined ? config.sampleRate : 1.0,
        maskInputs: config.maskInputs ?? false,
        maskOutputs: config.maskOutputs ?? false,
      },
      warnings: ['Langfuse is disabled via LANGFUSE_ENABLED=false'],
    };
  }

  // If enabled, validate required credentials
  if (!config.secretKey || config.secretKey.trim() === '') {
    return {
      isValid: false,
      error: 'LANGFUSE_SECRET_KEY is required when LANGFUSE_ENABLED=true',
    };
  }

  if (!config.publicKey || config.publicKey.trim() === '') {
    return {
      isValid: false,
      error: 'LANGFUSE_PUBLIC_KEY is required when LANGFUSE_ENABLED=true',
    };
  }

  // Validate baseUrl format
  const baseUrl = config.baseUrl || 'https://cloud.langfuse.com';
  try {
    const url = new URL(baseUrl);
    if (!url.protocol.startsWith('http')) {
      return {
        isValid: false,
        error: `Invalid LANGFUSE_BASE_URL: Must use http or https protocol, got ${url.protocol}`,
      };
    }
  } catch {
    return {
      isValid: false,
      error: `Invalid LANGFUSE_BASE_URL: ${baseUrl} is not a valid URL`,
    };
  }

  // Validate numeric values
  const flushInterval = config.flushInterval !== undefined ? config.flushInterval : 5000;
  if (flushInterval < 1000) {
    warnings.push('LANGFUSE_FLUSH_INTERVAL is below 1000ms, may cause performance issues');
  }

  const flushAt = config.flushAt !== undefined ? config.flushAt : 15;
  if (flushAt < 1) {
    warnings.push('LANGFUSE_FLUSH_AT must be at least 1, using default 15');
  }

  const requestTimeout = config.requestTimeout !== undefined ? config.requestTimeout : 10000;
  if (requestTimeout < 1000) {
    warnings.push('LANGFUSE_REQUEST_TIMEOUT is below 1000ms, may cause timeout errors');
  }

  const sampleRate = config.sampleRate !== undefined ? config.sampleRate : 1.0;
  if (sampleRate < 0 || sampleRate > 1) {
    return {
      isValid: false,
      error: 'LANGFUSE_SAMPLE_RATE must be between 0.0 and 1.0',
    };
  }

  // Detect deployment type based on URL
  if (baseUrl.includes('cloud.langfuse.com')) {
    warnings.push('Using Langfuse Cloud (EU)');
  } else if (baseUrl.includes('us.cloud.langfuse.com')) {
    warnings.push('Using Langfuse Cloud (US)');
  } else {
    warnings.push(`Using self-hosted Langfuse at ${baseUrl}`);
  }

  return {
    isValid: true,
    config: {
      enabled: true,
      secretKey: config.secretKey,
      publicKey: config.publicKey,
      baseUrl,
      flushInterval,
      flushAt,
      requestTimeout,
      sampleRate,
      maskInputs: config.maskInputs ?? false,
      maskOutputs: config.maskOutputs ?? false,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parses environment variables into LangfuseConfig
 * @param env Environment variables object
 * @returns Partial LangfuseConfig
 */
export function parseEnvironmentConfig(env: Record<string, string | undefined>): Partial<LangfuseConfig> {
  return {
    enabled: env.LANGFUSE_ENABLED === 'true',
    secretKey: env.LANGFUSE_SECRET_KEY,
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    flushInterval: env.LANGFUSE_FLUSH_INTERVAL !== undefined ? parseInt(env.LANGFUSE_FLUSH_INTERVAL, 10) : 5000,
    flushAt: env.LANGFUSE_FLUSH_AT !== undefined ? parseInt(env.LANGFUSE_FLUSH_AT, 10) : 15,
    requestTimeout: env.LANGFUSE_REQUEST_TIMEOUT !== undefined ? parseInt(env.LANGFUSE_REQUEST_TIMEOUT, 10) : 10000,
    sampleRate: env.LANGFUSE_SAMPLE_RATE !== undefined ? parseFloat(env.LANGFUSE_SAMPLE_RATE) : 1.0,
    maskInputs: env.LANGFUSE_MASK_INPUTS === 'true',
    maskOutputs: env.LANGFUSE_MASK_OUTPUTS === 'true',
  };
}
