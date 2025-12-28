/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { filterResourceAttributes, filterSpanAttributes } from './attribute-filters';

describe('Attribute Filters', () => {
  describe('filterResourceAttributes', () => {
    it('should remove process.* attributes', () => {
      const attributes = {
        'service.name': 'api',
        'process.pid': 12345,
        'process.runtime.name': 'nodejs',
        'process.command': '/usr/bin/node',
        'telemetry.sdk.name': 'opentelemetry',
      };

      const filtered = filterResourceAttributes(attributes);

      expect(filtered).toEqual({
        'service.name': 'api',
        'telemetry.sdk.name': 'opentelemetry',
      });
    });

    it('should remove host.* attributes', () => {
      const attributes = {
        'service.name': 'api',
        'host.name': 'server-01',
        'host.arch': 'x64',
        'host.type': 'linux',
        'telemetry.sdk.version': '1.0.0',
      };

      const filtered = filterResourceAttributes(attributes);

      expect(filtered).toEqual({
        'service.name': 'api',
        'telemetry.sdk.version': '1.0.0',
      });
    });

    it('should keep all non-process/host attributes', () => {
      const attributes = {
        'service.name': 'api',
        'service.version': '1.0.0',
        'telemetry.sdk.name': 'opentelemetry',
        'custom.attribute': 'value',
      };

      const filtered = filterResourceAttributes(attributes);

      expect(filtered).toEqual(attributes);
    });

    it('should handle null input', () => {
      const filtered = filterResourceAttributes(null as any);

      expect(filtered).toEqual({});
    });

    it('should handle undefined input', () => {
      const filtered = filterResourceAttributes(undefined as any);

      expect(filtered).toEqual({});
    });

    it('should handle empty object', () => {
      const filtered = filterResourceAttributes({});

      expect(filtered).toEqual({});
    });
  });

  describe('filterSpanAttributes', () => {
    it('should remove root-level tools key', () => {
      const attributes = {
        tools: [
          {
            name: 'getTool',
            description: 'Get a tool',
            parameters: { type: 'object' },
          },
        ],
        'gen_ai.request.model': 'gpt-4o-mini',
      };

      const filtered = filterSpanAttributes(attributes);

      expect(filtered).toEqual({
        'gen_ai.request.model': 'gpt-4o-mini',
      });
    });

    it('should remove keys ending with .tools', () => {
      const attributes = {
        'ai.settings.tools': [
          {
            name: 'getTool',
            description: 'Get a tool',
            parameters: { type: 'object' },
          },
        ],
        'gen_ai.request.model': 'gpt-4o-mini',
      };

      const filtered = filterSpanAttributes(attributes);

      expect(filtered).toEqual({
        'gen_ai.request.model': 'gpt-4o-mini',
      });
    });

    it('should remove multiple tool keys', () => {
      const attributes = {
        tools: [{ name: 'tool1' }],
        'ai.settings.tools': [{ name: 'tool2' }],
        'custom.tools': [{ name: 'tool3' }],
        'gen_ai.request.model': 'gpt-4o-mini',
        'other.attribute': 'value',
      };

      const filtered = filterSpanAttributes(attributes);

      expect(filtered).toEqual({
        'gen_ai.request.model': 'gpt-4o-mini',
        'other.attribute': 'value',
      });
    });

    it('should handle null input', () => {
      const filtered = filterSpanAttributes(null as any);

      expect(filtered).toEqual({});
    });

    it('should handle undefined input', () => {
      const filtered = filterSpanAttributes(undefined as any);

      expect(filtered).toEqual({});
    });

    it('should handle empty object', () => {
      const filtered = filterSpanAttributes({});

      expect(filtered).toEqual({});
    });

    it('should preserve attributes without tools', () => {
      const attributes = {
        'gen_ai.request.model': 'gpt-4o-mini',
        'ai.settings.temperature': 0.7,
        'ai.settings.max_tokens': 1000,
        'ai.toolkit': 'vercel-ai-sdk',
      };

      const filtered = filterSpanAttributes(attributes);

      expect(filtered).toEqual(attributes);
    });

    it('should only filter top-level keys', () => {
      const attributes = {
        tools: [{ name: 'tool1' }], // Should be filtered
        config: {
          tools: [{ name: 'tool2' }], // Should NOT be filtered (nested)
        },
        'gen_ai.request.model': 'gpt-4o-mini',
      };

      const filtered = filterSpanAttributes(attributes);

      expect(filtered).toEqual({
        config: {
          tools: [{ name: 'tool2' }],
        },
        'gen_ai.request.model': 'gpt-4o-mini',
      });
    });
  });
});
