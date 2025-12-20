import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { LoggerService } from '@paystackhq/nestjs-observability';
import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient, Usage } from 'langfuse-core';
import type { ToolExecuteFunction } from 'ai';
import type { ConfigService } from '@nestjs/config';

type ToolOutputMode = 'summary' | 'full';

type LangfuseRuntimeConfig = {
  enabled: boolean;
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  flushInterval: number;
  flushAt: number;
  requestTimeout: number;
  sampleRate: number;
  maskInputs: boolean;
  maskOutputs: boolean;
  toolOutputModeDefault: ToolOutputMode;
  toolOutputModeOverrides: Record<string, ToolOutputMode>;
  environment?: string;
  release?: string;
  version?: string;
  serviceName?: string;
};

type LangfuseTraceContext = {
  traceId: string;
  trace: LangfuseTraceClient;
};

type LangfuseSpanHandle = {
  span: LangfuseSpanClient;
  traceId: string;
};

type LangfuseGenerationHandle = {
  generation: LangfuseGenerationClient;
  traceId: string;
};

const logger = new LoggerService();
const traceStorage = new AsyncLocalStorage<LangfuseTraceContext>();

let cachedConfig: LangfuseRuntimeConfig | null | undefined;
let cachedClient: Langfuse | null | undefined;

const DEFAULTS = {
  enabled: false,
  flushInterval: 5000,
  flushAt: 15,
  requestTimeout: 10000,
  sampleRate: 1,
  maskInputs: false,
  maskOutputs: false,
  toolOutputModeDefault: 'summary' as ToolOutputMode,
};

const normalizeEnvValue = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  return value.trim().replace(/^['"]|['"]$/g, '');
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  const normalized = normalizeEnvValue(value);
  if (normalized === undefined || normalized === '') {
    return fallback;
  }
  return ['true', '1', 'yes', 'y'].includes(normalized.toLowerCase());
};

const parseNumber = (value: string | undefined, fallback: number) => {
  const normalized = normalizeEnvValue(value);
  if (normalized === undefined || normalized === '') {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseToolOverrides = (raw: string | undefined): Record<string, ToolOutputMode> => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, ToolOutputMode>;
    return parsed ?? {};
  } catch {
    const overrides: Record<string, ToolOutputMode> = {};
    raw.split(',').forEach((pair) => {
      const [key, value] = pair.split('=').map((part) => part.trim());
      if (key && (value === 'summary' || value === 'full')) {
        overrides[key] = value;
      }
    });
    return overrides;
  }
};

const resolveConfigValue = (configService: ConfigService | undefined, key: string): string | undefined => {
  if (configService) {
    const value = configService.get<string>(key);
    if (value !== undefined) {
      return normalizeEnvValue(value);
    }
  }
  return normalizeEnvValue(process.env[key]);
};

const resolveLangfuseConfig = (configService?: ConfigService): LangfuseRuntimeConfig => {
  const enabled = parseBoolean(resolveConfigValue(configService, 'LANGFUSE_ENABLED'), DEFAULTS.enabled);
  const publicKey = resolveConfigValue(configService, 'LANGFUSE_PUBLIC_KEY');
  const secretKey = resolveConfigValue(configService, 'LANGFUSE_SECRET_KEY');
  const baseUrl = resolveConfigValue(configService, 'LANGFUSE_BASE_URL');
  const flushInterval = parseNumber(
    resolveConfigValue(configService, 'LANGFUSE_FLUSH_INTERVAL'),
    DEFAULTS.flushInterval,
  );
  const flushAt = parseNumber(resolveConfigValue(configService, 'LANGFUSE_FLUSH_AT'), DEFAULTS.flushAt);
  const requestTimeout = parseNumber(
    resolveConfigValue(configService, 'LANGFUSE_REQUEST_TIMEOUT'),
    DEFAULTS.requestTimeout,
  );
  const sampleRate = parseNumber(resolveConfigValue(configService, 'LANGFUSE_SAMPLE_RATE'), DEFAULTS.sampleRate);
  const maskInputs = parseBoolean(resolveConfigValue(configService, 'LANGFUSE_MASK_INPUTS'), DEFAULTS.maskInputs);
  const maskOutputs = parseBoolean(resolveConfigValue(configService, 'LANGFUSE_MASK_OUTPUTS'), DEFAULTS.maskOutputs);
  const toolOutputModeRaw = resolveConfigValue(configService, 'LANGFUSE_TOOL_OUTPUT_MODE');
  const toolOutputModeDefault: ToolOutputMode = toolOutputModeRaw === 'full' ? 'full' : DEFAULTS.toolOutputModeDefault;
  const toolOutputModeOverrides = parseToolOverrides(
    resolveConfigValue(configService, 'LANGFUSE_TOOL_OUTPUT_OVERRIDES'),
  );
  const environment =
    resolveConfigValue(configService, 'OTEL_SERVICE_ENV') ?? resolveConfigValue(configService, 'NODE_ENV');
  const release = resolveConfigValue(configService, 'OTEL_SERVICE_VERSION');
  const version = resolveConfigValue(configService, 'APP_VERSION');
  const serviceName =
    resolveConfigValue(configService, 'OTEL_SERVICE_NAME') ?? resolveConfigValue(configService, 'APP_NAME');

  return {
    enabled,
    publicKey,
    secretKey,
    baseUrl,
    flushInterval,
    flushAt,
    requestTimeout,
    sampleRate,
    maskInputs,
    maskOutputs,
    toolOutputModeDefault,
    toolOutputModeOverrides,
    environment,
    release,
    version,
    serviceName,
  };
};

const shouldSample = (sampleRate: number) => {
  if (sampleRate >= 1) {
    return true;
  }
  if (sampleRate <= 0) {
    return false;
  }
  return Math.random() < sampleRate;
};

const createLangfuseClient = (config: LangfuseRuntimeConfig): Langfuse | null => {
  if (!config.enabled) {
    return null;
  }
  if (!config.publicKey || !config.secretKey) {
    return null;
  }
  try {
    return new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      flushAt: config.flushAt,
      flushInterval: config.flushInterval,
      requestTimeout: config.requestTimeout,
      sampleRate: config.sampleRate,
      environment: config.environment,
      release: config.release,
      mask: ({ data }: { data: unknown }): unknown => {
        if (!data || typeof data !== 'object') {
          return data;
        }
        const masked = { ...(data as Record<string, unknown>) };
        if (config.maskInputs && 'input' in masked) {
          masked.input = '[REDACTED]';
        }
        if (config.maskOutputs && 'output' in masked) {
          masked.output = '[REDACTED]';
        }
        return masked;
      },
    });
  } catch (error) {
    logger.error(`Failed to initialize Langfuse client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

const getConfig = () => {
  if (!cachedConfig) {
    cachedConfig = resolveLangfuseConfig();
  }
  return cachedConfig;
};

const getClient = () => {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  cachedClient = createLangfuseClient(getConfig());
  return cachedClient;
};

const getTraceContext = () => traceStorage.getStore();

const runWithTrace = async <T>(context: LangfuseTraceContext | null, fn: () => Promise<T>) => {
  if (!context) {
    return fn();
  }
  return traceStorage.run(context, fn);
};

const sanitizeValue = (value: unknown, maxDepth = 4): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    if (value.length <= 2000) {
      return value;
    }
    return `${value.slice(0, 2000)}…`;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (maxDepth <= 0) {
    return '[Truncated]';
  }
  if (Array.isArray(value)) {
    const sliced = value.slice(0, 20);
    return sliced.map((item) => sanitizeValue(item, maxDepth - 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = sanitizeValue(val, maxDepth - 1);
  }
  return result;
};

const maskInput = (value: unknown) => {
  const config = getConfig();
  if (config.maskInputs) {
    return '[REDACTED]';
  }
  return sanitizeValue(value);
};

const maskOutput = (value: unknown) => {
  const config = getConfig();
  if (config.maskOutputs) {
    return '[REDACTED]';
  }
  return sanitizeValue(value);
};

const mapUsage = (usage?: Record<string, number> | null): Usage | undefined => {
  if (!usage) {
    return undefined;
  }
  const input = usage.inputTokens ?? usage.promptTokens ?? usage.input ?? usage.prompt_tokens ?? usage.input_tokens;
  const output =
    usage.outputTokens ?? usage.completionTokens ?? usage.output ?? usage.completion_tokens ?? usage.output_tokens;
  const total = usage.totalTokens ?? usage.total ?? usage.total_tokens;
  if (input === undefined && output === undefined && total === undefined) {
    return undefined;
  }
  return {
    input,
    output,
    total,
  };
};

const getToolOutputMode = (toolName: string) => {
  const config = getConfig();
  return config.toolOutputModeOverrides[toolName] ?? config.toolOutputModeDefault;
};

const summarizeToolOutput = (toolName: string, output: unknown) => {
  if (!output || typeof output !== 'object') {
    return output;
  }
  const data = output as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    tool: toolName,
  };
  if ('success' in data) {
    summary.success = data.success;
  }
  if ('message' in data) {
    summary.message = data.message;
  }
  if ('error' in data) {
    summary.error = data.error;
  }
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      counts[key] = value.length;
    }
  }
  if (Object.keys(counts).length > 0) {
    summary.counts = counts;
  }
  if ('meta' in data) {
    summary.meta = data.meta;
  }
  if ('summary' in data) {
    summary.summary = data.summary;
  }
  if ('label' in data) {
    summary.label = data.label;
  }
  return summary;
};

const resolveToolOutput = (toolName: string, output: unknown) => {
  const mode = getToolOutputMode(toolName);
  if (mode === 'full') {
    return maskOutput(output);
  }
  return maskOutput(summarizeToolOutput(toolName, output));
};

const summarizePaystackResponse = (output: unknown) => {
  if (!output || typeof output !== 'object') {
    return output;
  }
  const data = output as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  if ('status' in data) {
    summary.status = data.status;
  }
  if ('message' in data) {
    summary.message = data.message;
  }
  if ('data' in data && Array.isArray(data.data)) {
    summary.dataCount = data.data.length;
  }
  if ('meta' in data) {
    summary.meta = data.meta;
  }
  return summary;
};

const startTrace = (params: {
  name: string;
  traceId?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  userId?: string;
  sessionId?: string;
}) => {
  const config = getConfig();
  if (!config.enabled || !shouldSample(config.sampleRate)) {
    return null;
  }
  const client = getClient();
  if (!client) {
    return null;
  }
  const traceId = params.traceId ?? randomUUID();
  const trace = client.trace({
    id: traceId,
    name: params.name,
    timestamp: new Date(),
    input: params.input ? maskInput(params.input) : undefined,
    metadata: params.metadata,
    tags: params.tags,
    userId: params.userId,
    sessionId: params.sessionId,
  });
  return { traceId, trace };
};

const updateTrace = (context: LangfuseTraceContext | null, body: { output?: unknown; metadata?: unknown }) => {
  if (!context) {
    return;
  }
  context.trace.update({
    output: body.output ? maskOutput(body.output) : undefined,
    metadata: body.metadata,
  });
};

const startSpan = (params: {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  parentObservationId?: string;
}) => {
  const context = getTraceContext();
  if (!context) {
    return null;
  }
  const client = getClient();
  if (!client) {
    return null;
  }
  const span = client.span({
    traceId: context.traceId,
    name: params.name,
    startTime: new Date(),
    input: params.input ? maskInput(params.input) : undefined,
    metadata: params.metadata,
    parentObservationId: params.parentObservationId,
  });
  return { span, traceId: context.traceId };
};

const endSpan = (
  handle: LangfuseSpanHandle | null,
  params: { output?: unknown; metadata?: Record<string, unknown>; level?: 'ERROR' | 'DEFAULT'; statusMessage?: string },
) => {
  if (!handle) {
    return;
  }
  handle.span.end({
    output: params.output ? maskOutput(params.output) : undefined,
    metadata: params.metadata,
    level: params.level,
    statusMessage: params.statusMessage,
  });
};

const startGeneration = (params: {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  model?: string;
}) => {
  const context = getTraceContext();
  if (!context) {
    return null;
  }
  const client = getClient();
  if (!client) {
    return null;
  }
  const generation = client.generation({
    traceId: context.traceId,
    name: params.name,
    startTime: new Date(),
    model: params.model,
    input: params.input ? maskInput(params.input) : undefined,
    metadata: params.metadata,
  });
  return { generation, traceId: context.traceId };
};

const endGeneration = (
  handle: LangfuseGenerationHandle | null,
  params: {
    output?: unknown;
    metadata?: Record<string, unknown>;
    level?: 'ERROR' | 'DEFAULT';
    statusMessage?: string;
    usage?: Usage;
  },
) => {
  if (!handle) {
    return;
  }
  handle.generation.end({
    output: params.output ? maskOutput(params.output) : undefined,
    metadata: params.metadata,
    level: params.level,
    statusMessage: params.statusMessage,
    usage: params.usage,
  });
};

const recordEvent = (params: { name: string; input?: unknown; metadata?: Record<string, unknown> }) => {
  const context = getTraceContext();
  if (!context) {
    return;
  }
  const client = getClient();
  if (!client) {
    return;
  }
  client.event({
    traceId: context.traceId,
    name: params.name,
    startTime: new Date(),
    input: params.input ? maskInput(params.input) : undefined,
    metadata: params.metadata,
  });
};

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  typeof value === 'object' && value !== null && Symbol.asyncIterator in value;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  'then' in value &&
  typeof (value as { then?: unknown }).then === 'function';

const wrapStreamingResult = <TOutput>(
  toolName: string,
  span: LangfuseSpanHandle | null,
  iterable: AsyncIterable<unknown>,
) => {
  return (async function* () {
    let lastValue: unknown = undefined;
    let count = 0;
    try {
      for await (const value of iterable) {
        count += 1;
        lastValue = value;
        yield value as TOutput;
      }
      const output = resolveToolOutput(toolName, lastValue);
      endSpan(span, {
        output: {
          stream: true,
          count,
          last: output,
        },
      });
    } catch (error) {
      endSpan(span, {
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })();
};

const finalizeToolResult = <TOutput>(toolName: string, span: LangfuseSpanHandle | null, result: TOutput) => {
  const output = resolveToolOutput(toolName, result);
  const level = result && typeof result === 'object' && 'error' in result ? 'ERROR' : 'DEFAULT';
  const statusMessage =
    result && typeof result === 'object' && 'error' in result
      ? String((result as { error?: unknown }).error)
      : undefined;
  endSpan(span, { output, level, statusMessage });
  return result;
};

const wrapToolExecute = <TInput, TOutput>(toolName: string, execute: ToolExecuteFunction<TInput, TOutput>) => {
  return (...args: Parameters<ToolExecuteFunction<TInput, TOutput>>) => {
    const [input] = args;
    const span = startSpan({
      name: `tool.${toolName}`,
      input,
      metadata: { tool: toolName },
    });
    let result: ReturnType<ToolExecuteFunction<TInput, TOutput>>;
    try {
      result = execute(...args);
    } catch (error) {
      endSpan(span, {
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (isAsyncIterable(result)) {
      return wrapStreamingResult<TOutput>(toolName, span, result) as unknown as TOutput;
    }

    if (isPromiseLike(result)) {
      return Promise.resolve(result).then(
        (resolved) => {
          if (isAsyncIterable(resolved)) {
            return wrapStreamingResult<TOutput>(toolName, span, resolved) as unknown as TOutput;
          }
          return finalizeToolResult(toolName, span, resolved);
        },
        (error) => {
          endSpan(span, {
            level: 'ERROR',
            statusMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        },
      ) as unknown as TOutput;
    }

    return finalizeToolResult(toolName, span, result);
  };
};

const flushAsync = async () => {
  const client = getClient();
  if (!client) {
    return;
  }
  try {
    await client.flushAsync();
  } catch (error) {
    logger.error(`Failed to flush Langfuse client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const shutdownAsync = async () => {
  const client = getClient();
  if (!client) {
    return;
  }
  try {
    await client.shutdownAsync();
  } catch (error) {
    logger.error(`Failed to shutdown Langfuse client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const getBaseTags = () => {
  const config = getConfig();
  const tags: string[] = [];
  if (config.serviceName) {
    tags.push(`service:${config.serviceName}`);
  }
  if (config.environment) {
    tags.push(`env:${config.environment}`);
  }
  if (config.version) {
    tags.push(`version:${config.version}`);
  }
  return tags;
};

const configure = (config: LangfuseRuntimeConfig) => {
  cachedConfig = config;
  cachedClient = undefined;
};

export const LangfuseRuntime = {
  configure,
  resolveLangfuseConfig,
  getConfig,
  getClient,
  getTraceContext,
  runWithTrace,
  startTrace,
  updateTrace,
  startSpan,
  endSpan,
  startGeneration,
  endGeneration,
  recordEvent,
  wrapToolExecute,
  resolveToolOutput,
  summarizeToolOutput,
  summarizePaystackResponse,
  mapUsage,
  flushAsync,
  shutdownAsync,
  getBaseTags,
};

export type { LangfuseTraceContext, LangfuseSpanHandle, LangfuseGenerationHandle, ToolOutputMode };
