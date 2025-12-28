/* eslint-disable @typescript-eslint/unbound-method */
import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span } from '@opentelemetry/sdk-trace-base';
import type { LangfuseSpanProcessor } from '@langfuse/otel';
import { FilteringSpanProcessor } from './filtering-span-processor';

describe('FilteringSpanProcessor', () => {
  let mockLangfuseProcessor: jest.Mocked<LangfuseSpanProcessor>;
  let mockSpan: Span;
  let mockContext: Context;

  beforeEach(() => {
    mockLangfuseProcessor = {
      onStart: jest.fn(),
      onEnd: jest.fn(),
      forceFlush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LangfuseSpanProcessor>;

    mockSpan = {} as Span;

    mockContext = {} as Context;
  });

  describe('onStart', () => {
    it('should delegate to LangfuseProcessor', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      processor.onStart(mockSpan, mockContext);

      expect(mockLangfuseProcessor.onStart).toHaveBeenCalledWith(mockSpan, mockContext);
    });

    it('should pass through without modification', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      processor.onStart(mockSpan, mockContext);

      expect(mockLangfuseProcessor.onStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('onEnd', () => {
    let mockReadableSpan: ReadableSpan;

    beforeEach(() => {
      mockReadableSpan = {
        name: 'test-span',
        spanContext: () => ({}),
        startTime: [0, 0],
        endTime: [1, 0],
        status: { code: 0 },
        attributes: {
          'ai.settings.tools': [
            {
              name: 'getTool',
              description: 'Get a tool',
              parameters: { type: 'object' },
              schema: { $schema: 'http://json-schema.org/draft-07/schema#' },
            },
          ],
          'gen_ai.request.model': 'gpt-4o-mini',
        },
        resource: {
          attributes: {
            'service.name': 'command-centre-api',
            'process.pid': 12345,
            'host.name': 'server-01',
            'telemetry.sdk.name': 'opentelemetry',
          },
        },
      } as unknown as ReadableSpan;
    });

    it('should filter resource attributes when filtering is enabled', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      processor.onEnd(mockReadableSpan);

      expect(mockLangfuseProcessor.onEnd).toHaveBeenCalledTimes(1);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.resource.attributes).toEqual({
        'service.name': 'command-centre-api',
        'telemetry.sdk.name': 'opentelemetry',
      });
    });

    it('should remove tools from span attributes when filtering is enabled', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      processor.onEnd(mockReadableSpan);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.attributes['ai.settings.tools']).toBeUndefined();
      expect(filteredSpan.attributes['gen_ai.request.model']).toBe('gpt-4o-mini');
    });

    it('should not filter when filtering is disabled', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, false);

      processor.onEnd(mockReadableSpan);

      expect(mockLangfuseProcessor.onEnd).toHaveBeenCalledWith(mockReadableSpan);
    });

    it('should not mutate original span when filtering', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      const originalAttributes = { ...mockReadableSpan.attributes };
      const originalResourceAttributes = { ...mockReadableSpan.resource.attributes };

      processor.onEnd(mockReadableSpan);

      // Original span should remain unchanged
      expect(mockReadableSpan.attributes).toEqual(originalAttributes);
      expect(mockReadableSpan.resource.attributes).toEqual(originalResourceAttributes);
    });

    it('should preserve other span properties', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      processor.onEnd(mockReadableSpan);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.name).toBe('test-span');
      expect(filteredSpan.startTime).toEqual([0, 0]);
      expect(filteredSpan.endTime).toEqual([1, 0]);
      expect(filteredSpan.status).toEqual({ code: 0 });
    });

    it('should handle spans without tools', () => {
      const spanWithoutTools = {
        ...mockReadableSpan,
        attributes: {
          'gen_ai.request.model': 'gpt-4o-mini',
        },
      } as unknown as ReadableSpan;

      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      processor.onEnd(spanWithoutTools);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.attributes).toEqual({
        'gen_ai.request.model': 'gpt-4o-mini',
      });
    });

    it('should handle spans with empty attributes', () => {
      const spanWithEmptyAttrs = {
        ...mockReadableSpan,
        attributes: {},
        resource: {
          attributes: {},
        },
      } as unknown as ReadableSpan;

      const processor = new FilteringSpanProcessor(mockLangfuseProcessor, true);

      processor.onEnd(spanWithEmptyAttrs);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.attributes).toEqual({});
      expect(filteredSpan.resource.attributes).toEqual({});
    });
  });

  describe('forceFlush', () => {
    it('should delegate to LangfuseProcessor', async () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      await processor.forceFlush();

      expect(mockLangfuseProcessor.forceFlush).toHaveBeenCalledTimes(1);
    });

    it('should return promise from LangfuseProcessor', async () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      const result = await processor.forceFlush();

      expect(result).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should delegate to LangfuseProcessor', async () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      await processor.shutdown();

      expect(mockLangfuseProcessor.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should return promise from LangfuseProcessor', async () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      const result = await processor.shutdown();

      expect(result).toBeUndefined();
    });
  });

  describe('integration', () => {
    it('should remove tools when filtering is enabled by default', () => {
      const processor = new FilteringSpanProcessor(mockLangfuseProcessor);

      const mockReadableSpan = {
        attributes: {
          'ai.settings.tools': [{ name: 'tool', description: 'desc', schema: {} }],
          'other.attribute': 'value',
        },
        resource: {
          attributes: {
            'service.name': 'api',
            'process.pid': 123,
          },
        },
      } as unknown as ReadableSpan;

      processor.onEnd(mockReadableSpan);

      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.attributes['ai.settings.tools']).toBeUndefined();
      expect(filteredSpan.attributes['other.attribute']).toBe('value');
      expect(filteredSpan.resource.attributes).toEqual({
        'service.name': 'api',
      });
    });

    it('should respect filtering toggle', () => {
      const processorEnabled = new FilteringSpanProcessor(mockLangfuseProcessor, true);
      const processorDisabled = new FilteringSpanProcessor(mockLangfuseProcessor, false);

      const mockReadableSpan = {
        attributes: {
          tools: [{ name: 'tool', description: 'desc', schema: {} }],
        },
        resource: {
          attributes: {
            'process.pid': 123,
          },
        },
      } as unknown as ReadableSpan;

      // With filtering enabled
      processorEnabled.onEnd(mockReadableSpan);
      const filteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(filteredSpan.resource.attributes).toEqual({});

      // With filtering disabled
      mockLangfuseProcessor.onEnd.mockClear();
      processorDisabled.onEnd(mockReadableSpan);
      const unfilteredSpan = mockLangfuseProcessor.onEnd.mock.calls[0][0];
      expect(unfilteredSpan.resource.attributes).toEqual({
        'process.pid': 123,
      });
    });
  });
});
