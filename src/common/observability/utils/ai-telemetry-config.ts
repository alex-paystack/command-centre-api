import type { LangfuseService } from '../langfuse.service';

// AttributeValue type compatible with Vercel AI SDK
type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

/**
 * Configuration for AI operation telemetry
 */
export interface AITelemetryConfig {
  functionId: string;
  metadata?: Record<string, AttributeValue>;
  promptName?: string;
  promptVersion?: number;
}

/**
 * Telemetry configuration for Vercel AI SDK
 */
export interface VercelAITelemetryConfig {
  experimental_telemetry?: {
    isEnabled: boolean;
    functionId?: string;
    metadata?: Record<string, AttributeValue>;
  };
}

/**
 * Create telemetry configuration for Vercel AI SDK operations
 * Returns proper experimental_telemetry config or disabled state
 *
 * @param langfuseService The Langfuse service instance
 * @param config Telemetry configuration
 * @returns Vercel AI SDK telemetry config
 */
export function createAITelemetryConfig(
  langfuseService: LangfuseService,
  config: AITelemetryConfig,
): VercelAITelemetryConfig {
  // If Langfuse is disabled, return disabled telemetry
  if (!langfuseService.isEnabled()) {
    return {
      experimental_telemetry: {
        isEnabled: false,
      },
    };
  }

  // Build metadata with prompt information if provided
  const metadata: Record<string, AttributeValue> = {
    ...(config.metadata || {}),
  };

  // Add prompt metadata if provided
  if (config.promptName) {
    metadata.langfusePromptName = config.promptName;
    metadata.langfusePromptVersion = config.promptVersion || 1;
  }

  return {
    experimental_telemetry: {
      isEnabled: true,
      functionId: config.functionId,
      metadata,
    },
  };
}

/**
 * Helper to merge telemetry config with other parameters
 * Usage: const params = { model, ...mergeTelemetryConfig(langfuseService, config) }
 *
 * @param langfuseService The Langfuse service instance
 * @param config Telemetry configuration
 * @returns Object to spread into AI SDK parameters
 */
export function mergeTelemetryConfig(
  langfuseService: LangfuseService,
  config: AITelemetryConfig,
): VercelAITelemetryConfig {
  return createAITelemetryConfig(langfuseService, config);
}
