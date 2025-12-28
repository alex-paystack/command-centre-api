import { LangfuseSpanProcessor, ShouldExportSpan } from '@langfuse/otel';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { FilteringSpanProcessor } from './filtering-span-processor';

/**
 * Filter to only export AI related spans to Langfuse
 * This excludes NestJS infrastructure spans, HTTP spans, etc.
 */
const shouldExportSpan: ShouldExportSpan = (span) => {
  const instrumentationScope = span.otelSpan.instrumentationScope.name;

  return ['langfuse-sdk', 'ai'].includes(instrumentationScope);
};

/**
 * Creates and returns the LangfuseSpanProcessor for LLM observability.
 *
 * Configuration is read from environment variables:
 * - LANGFUSE_PUBLIC_KEY: Langfuse public key
 * - LANGFUSE_SECRET_KEY: Langfuse secret key
 * - LANGFUSE_BASE_URL: Langfuse base URL (defaults to https://cloud.langfuse.com)
 * - LANGFUSE_FLUSH_INTERVAL: Flush interval in milliseconds (defaults to 1000)
 * - LANGFUSE_FLUSH_AT: Flush at number of spans (defaults to 1)
 * - OTEL_SERVICE_ENV: Environment name for Langfuse (defaults to 'local')
 *
 * @returns Array of span processors containing the LangfuseSpanProcessor
 */
export function getSpanProcessors(): SpanProcessor[] {
  const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
  const secretKey = process.env['LANGFUSE_SECRET_KEY'];
  const flushInterval = process.env['LANGFUSE_FLUSH_INTERVAL'] ?? 5000;
  const flushAt = process.env['LANGFUSE_FLUSH_AT'] ?? 15;
  const langfuseEnabled = process.env['LANGFUSE_ENABLED'] === 'true';

  if (!langfuseEnabled) {
    // eslint-disable-next-line no-console
    console.log('Langfuse LLM observability disabled for environment: ${environment}');
    return [];
  }

  if (!publicKey || !secretKey) {
    // eslint-disable-next-line no-console
    console.warn(
      'Langfuse credentials not configured (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY). LLM observability disabled.',
    );
    return [];
  }

  const baseUrl = process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com';
  const environment = process.env['OTEL_SERVICE_ENV'] ?? 'local';

  const langfuseProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl,
    environment,
    shouldExportSpan,
    flushInterval: Number(flushInterval),
    flushAt: Number(flushAt),
  });

  // Wrap with filtering processor to reduce verbose metadata
  const enableFiltering = process.env['LANGFUSE_FILTER_VERBOSE_METADATA'] !== 'false';
  const filteringProcessor = new FilteringSpanProcessor(langfuseProcessor, enableFiltering);

  // eslint-disable-next-line no-console
  console.log(
    `Langfuse LLM observability enabled for environment: ${environment} (metadata filtering: ${enableFiltering ? 'enabled' : 'disabled'})`,
  );

  const processors: SpanProcessor[] = [filteringProcessor as SpanProcessor];
  return processors;
}
