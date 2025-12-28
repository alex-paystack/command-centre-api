import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { LangfuseSpanProcessor } from '@langfuse/otel';
import { filterResourceAttributes, filterSpanAttributes } from './attribute-filters';

/**
 * Creates a filtered version of a ReadableSpan using a Proxy.
 * Filters resource attributes and span attributes before exporting to Langfuse.
 *
 * @param span - Original span to filter
 * @returns Proxied span with filtered attributes
 */
function createFilteredSpan(span: ReadableSpan): ReadableSpan {
  const filteredAttributes = filterSpanAttributes(span.attributes);
  const filteredResource = {
    ...span.resource,
    attributes: filterResourceAttributes(span.resource.attributes),
  };

  return new Proxy(span, {
    get(target, prop) {
      if (prop === 'attributes') {
        return filteredAttributes;
      }
      if (prop === 'resource') {
        return filteredResource;
      }
      return target[prop as keyof ReadableSpan];
    },
  });
}

/**
 * Span processor that filters verbose attributes before exporting to Langfuse.
 *
 * This processor wraps LangfuseSpanProcessor and applies filtering to:
 * - Resource attributes: Removes `process.*` and `host.*` attributes
 * - Span attributes: Filters tools arrays to keep only name + description
 *
 * The filtering can be toggled via the `enableFiltering` parameter, which is
 * typically controlled by the `LANGFUSE_FILTER_VERBOSE_METADATA` environment variable.
 *
 * @example
 * ```typescript
 * const langfuseProcessor = new LangfuseSpanProcessor({...});
 * const filteringProcessor = new FilteringSpanProcessor(langfuseProcessor, true);
 * ```
 */
export class FilteringSpanProcessor implements SpanProcessor {
  /**
   * Creates a new FilteringSpanProcessor.
   *
   * @param langfuseProcessor - The LangfuseSpanProcessor to delegate to
   * @param enableFiltering - Whether to enable filtering (default: true)
   */
  constructor(
    private readonly langfuseProcessor: LangfuseSpanProcessor,
    private readonly enableFiltering: boolean = true,
  ) {}

  /**
   * Called when a span is started.
   * Passes through to LangfuseProcessor without modification.
   */
  onStart(span: Span, parentContext: Context): void {
    this.langfuseProcessor.onStart(span, parentContext);
  }

  /**
   * Called when a span is ended.
   * Filters attributes if filtering is enabled, then delegates to LangfuseProcessor.
   *
   * @param span - The span that has ended
   */
  onEnd(span: ReadableSpan): void {
    if (!this.enableFiltering) {
      this.langfuseProcessor.onEnd(span);
      return;
    }

    // Create filtered span and delegate to Langfuse processor
    const filteredSpan = createFilteredSpan(span);
    this.langfuseProcessor.onEnd(filteredSpan);
  }

  /**
   * Forces the processor to flush any buffered spans.
   * Delegates to LangfuseProcessor.
   */
  async forceFlush(): Promise<void> {
    return this.langfuseProcessor.forceFlush();
  }

  /**
   * Shuts down the processor.
   * Delegates to LangfuseProcessor.
   */
  async shutdown(): Promise<void> {
    return this.langfuseProcessor.shutdown();
  }
}
