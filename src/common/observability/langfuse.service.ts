import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Usage } from 'langfuse-core';
import { LangfuseRuntime, type LangfuseTraceContext, type LangfuseGenerationHandle } from './langfuse.runtime';

@Injectable()
export class LangfuseService implements OnApplicationShutdown {
  constructor(private readonly configService: ConfigService) {
    const resolved = LangfuseRuntime.resolveLangfuseConfig(this.configService);
    LangfuseRuntime.configure(resolved);
  }

  runWithTrace<T>(context: LangfuseTraceContext | null, fn: () => Promise<T>) {
    return LangfuseRuntime.runWithTrace(context, fn);
  }

  startTrace(params: {
    name: string;
    traceId?: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
    tags?: string[];
    userId?: string;
    sessionId?: string;
  }) {
    return LangfuseRuntime.startTrace(params);
  }

  updateTrace(context: LangfuseTraceContext | null, body: { output?: unknown; metadata?: unknown }) {
    LangfuseRuntime.updateTrace(context, body);
  }

  startGeneration(params: { name: string; input?: unknown; metadata?: Record<string, unknown>; model?: string }) {
    return LangfuseRuntime.startGeneration(params);
  }

  endGeneration(
    handle: LangfuseGenerationHandle | null,
    params: {
      output?: unknown;
      metadata?: Record<string, unknown>;
      level?: 'ERROR' | 'DEFAULT';
      statusMessage?: string;
      usage?: Usage;
    },
  ) {
    LangfuseRuntime.endGeneration(handle, params);
  }

  recordEvent(params: { name: string; input?: unknown; metadata?: Record<string, unknown> }) {
    LangfuseRuntime.recordEvent(params);
  }

  mapUsage(usage?: Record<string, number> | null) {
    return LangfuseRuntime.mapUsage(usage);
  }

  resolveToolOutput(toolName: string, output: unknown) {
    return LangfuseRuntime.resolveToolOutput(toolName, output);
  }

  summarizePaystackResponse(output: unknown) {
    return LangfuseRuntime.summarizePaystackResponse(output);
  }

  getBaseTags() {
    return LangfuseRuntime.getBaseTags();
  }

  flushAsync() {
    return LangfuseRuntime.flushAsync();
  }

  async onApplicationShutdown() {
    await LangfuseRuntime.shutdownAsync();
  }
}
