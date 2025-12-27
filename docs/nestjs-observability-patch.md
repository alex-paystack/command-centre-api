# @paystackhq/nestjs-observability Patch for Custom Span Processors

This document describes the changes needed to `@paystackhq/nestjs-observability` to support custom span processors via an environment variable hook.

## Overview

Add support for `OTEL_SPAN_PROCESSORS_PATH` environment variable that allows consuming applications to inject custom span processors (like Langfuse) without modifying the core package.

## Changes Required to `src/register.ts`

### 1. Add new type export

Add at the top of the file, after imports:

```typescript
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

export interface SpanProcessorHook {
  getSpanProcessors: () => SpanProcessor[];
}
```

### 2. Add function to load custom span processors

Add this function before `initializeSDK()`:

```typescript
function loadCustomSpanProcessors(): SpanProcessor[] {
  const hookPath = process.env['OTEL_SPAN_PROCESSORS_PATH'];
  if (!hookPath) {
    return [];
  }

  try {
    // Resolve relative to process.cwd() for consuming applications
    const resolvedPath = require('path').resolve(process.cwd(), hookPath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hook = require(resolvedPath) as SpanProcessorHook;

    if (typeof hook.getSpanProcessors !== 'function') {
      console.warn(`OTEL_SPAN_PROCESSORS_PATH: ${hookPath} does not export a getSpanProcessors function`);
      return [];
    }

    const processors = hook.getSpanProcessors();
    console.log(`Loaded ${processors.length} custom span processor(s) from ${hookPath}`);
    return processors;
  } catch (error) {
    console.warn(`Failed to load custom span processors from ${hookPath}:`, error);
    return [];
  }
}
```

### 3. Modify `initializeSDK()` function

Update the SDK configuration to include custom span processors. Replace the `sdkConfig` initialization section:

```typescript
function initializeSDK() {
  const traceExporter = createTraceExporter();
  const metricReader = createMetricReader();
  const logRecordProcessor = createLogProcessor();

  // Load custom span processors from hook
  const customSpanProcessors = loadCustomSpanProcessors();

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: getServiceName(),
    [ATTR_SERVICE_VERSION]: getServiceVersion(),
    'service.environment': getServiceEnvironment(),
  });

  const customInstrumentation = (() => {
    try {
      return new NestJSLoggerContextInstrumentation();
    } catch {
      return undefined;
    }
  })();

  const instrumentations = customInstrumentation
    ? [customInstrumentation, ...getNodeAutoInstrumentations()]
    : getNodeAutoInstrumentations();

  // Build span processors array
  const spanProcessors: SpanProcessor[] = [...customSpanProcessors];

  // Add batch span processor for the trace exporter if configured
  if (traceExporter) {
    spanProcessors.push(new BatchSpanProcessor(traceExporter));
  }

  const sdkConfig: Partial<NodeSDKConfiguration> = {
    instrumentations,
    resource,
    resourceDetectors: [envDetector, hostDetector, osDetector, serviceInstanceIdDetector],
    // Use spanProcessors instead of traceExporter when we have custom processors
    ...(spanProcessors.length > 0 ? { spanProcessors } : { traceExporter }),
  };

  // ... rest of the function remains the same
```

### 4. Add required import

Add to the imports section:

```typescript
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
```

## Full Modified `register.ts` Example

See the complete modified file below. Key changes are marked with `// LANGFUSE INTEGRATION:` comments.

```typescript
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  envDetector,
  hostDetector,
  osDetector,
  resourceFromAttributes,
  serviceInstanceIdDetector,
} from '@opentelemetry/resources';
import { BatchLogRecordProcessor, ConsoleLogRecordExporter, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

import { JSONStdoutLogExporter } from './exporters/json-log-exporter';
import { NestJSLoggerContextInstrumentation } from './instrumentation/nestjs-logger-context.instrumentation';

// LANGFUSE INTEGRATION: Export interface for span processor hooks
export interface SpanProcessorHook {
  getSpanProcessors: () => SpanProcessor[];
}

let sdk: NodeSDK | null = null;

export function getServiceAttributes(): Record<string, string> {
  return {
    'instrumentation.type': 'manual',
    'service.environment': getServiceEnvironment(),
    'service.name': getServiceName(),
    'service.version': getServiceVersion(),
  };
}

export function getServiceEnvironment(): string {
  return process.env['OTEL_SERVICE_ENV'] ?? 'local';
}

export function getServiceName(): string {
  return process.env['OTEL_SERVICE_NAME'] ?? 'unknown-service';
}

export function getServiceVersion(): string {
  return process.env['OTEL_SERVICE_VERSION'] ?? '1.0.0';
}

export function getHttpRequestLoggingEnabled(): boolean {
  const value = process.env['OTEL_LOG_HTTP_REQUESTS'];
  return value === 'true' || value === '1';
}

// ... existing createLogProcessor, createMetricReader, createTraceExporter functions ...

// LANGFUSE INTEGRATION: Load custom span processors from hook path
function loadCustomSpanProcessors(): SpanProcessor[] {
  const hookPath = process.env['OTEL_SPAN_PROCESSORS_PATH'];
  if (!hookPath) {
    return [];
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const resolvedPath = path.resolve(process.cwd(), hookPath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hook = require(resolvedPath) as SpanProcessorHook;

    if (typeof hook.getSpanProcessors !== 'function') {
      console.warn(`OTEL_SPAN_PROCESSORS_PATH: ${hookPath} does not export a getSpanProcessors function`);
      return [];
    }

    const processors = hook.getSpanProcessors();
    console.log(`Loaded ${processors.length} custom span processor(s) from ${hookPath}`);
    return processors;
  } catch (error) {
    console.warn(`Failed to load custom span processors from ${hookPath}:`, error);
    return [];
  }
}

function initializeSDK(): NodeSDK {
  const traceExporter = createTraceExporter();
  const metricReader = createMetricReader();
  const logRecordProcessor = createLogProcessor();

  // LANGFUSE INTEGRATION: Load custom span processors
  const customSpanProcessors = loadCustomSpanProcessors();

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: getServiceName(),
    [ATTR_SERVICE_VERSION]: getServiceVersion(),
    'service.environment': getServiceEnvironment(),
  });

  const customInstrumentation = (() => {
    try {
      return new NestJSLoggerContextInstrumentation();
    } catch {
      return undefined;
    }
  })();

  const instrumentations = customInstrumentation
    ? [customInstrumentation, ...getNodeAutoInstrumentations()]
    : getNodeAutoInstrumentations();

  // LANGFUSE INTEGRATION: Build span processors array
  const spanProcessors: SpanProcessor[] = [...customSpanProcessors];

  // Add batch span processor for the trace exporter if configured
  if (traceExporter) {
    spanProcessors.push(new BatchSpanProcessor(traceExporter));
  }

  const sdkConfig: Partial<NodeSDKConfiguration> = {
    instrumentations,
    resource,
    resourceDetectors: [envDetector, hostDetector, osDetector, serviceInstanceIdDetector],
  };

  // LANGFUSE INTEGRATION: Use spanProcessors when available
  if (spanProcessors.length > 0) {
    sdkConfig.spanProcessors = spanProcessors;
  } else if (traceExporter) {
    sdkConfig.traceExporter = traceExporter;
  }

  const metricsExporter = process.env['OTEL_METRICS_EXPORTER'];
  if (metricsExporter !== 'otlp' && metricReader) {
    sdkConfig.metricReader = metricReader;
  }

  if (logRecordProcessor && process.env['NODE_ENV'] !== 'test') {
    sdkConfig.logRecordProcessors = [logRecordProcessor];
  }

  const normalizedConfig = {
    instrumentations: sdkConfig.instrumentations ?? [],
    ...(sdkConfig.resource ? { resource: sdkConfig.resource } : {}),
    ...(sdkConfig.resourceDetectors ? { resourceDetectors: sdkConfig.resourceDetectors } : {}),
    ...(sdkConfig.spanProcessors ? { spanProcessors: sdkConfig.spanProcessors } : {}),
    ...(sdkConfig.traceExporter ? { traceExporter: sdkConfig.traceExporter } : {}),
    ...(sdkConfig.metricReader ? { metricReader: sdkConfig.metricReader } : {}),
    ...(sdkConfig.logRecordProcessors ? { logRecordProcessors: sdkConfig.logRecordProcessors } : {}),
  };

  return new NodeSDK(normalizedConfig);
}

// ... rest of the file (gracefulShutdown, start, etc.) remains unchanged ...
```

## Usage

After applying this patch, consuming applications can set:

```bash
OTEL_SPAN_PROCESSORS_PATH=./dist/common/observability/langfuse.config.js
```

And create a file at that path that exports `getSpanProcessors()`:

```typescript
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

export function getSpanProcessors(): SpanProcessor[] {
  return [
    new LangfuseSpanProcessor({
      // Configuration options
    }),
  ];
}
```
