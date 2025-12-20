import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Langfuse, type LangfuseTraceClient } from 'langfuse';
import { type LangfuseConfig, validateLangfuseConfig, parseEnvironmentConfig } from './langfuse.config';

/**
 * Parameters for creating a trace
 */
export interface TraceParams {
  id?: string;
  name?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  input?: unknown;
  output?: unknown;
  public?: boolean;
}

/**
 * Parameters for creating a span
 */
export interface SpanParams {
  name: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Parameters for creating a generation
 */
export interface GenerationParams {
  name: string;
  model?: string;
  modelParameters?: Record<string, unknown>;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  promptName?: string;
  promptVersion?: number;
  startTime?: Date;
  endTime?: Date;
}

/**
 * LangfuseService provides AI observability with graceful degradation.
 * If Langfuse is not configured or fails, operations become no-ops without breaking the app.
 */
@Injectable()
export class LangfuseService implements OnModuleDestroy {
  private client: Langfuse | null = null;
  private enabled = false;
  private config: LangfuseConfig | null = null;
  private readonly logger = new Logger(LangfuseService.name);

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  /**
   * Initialize Langfuse client with graceful degradation
   */
  private initialize(): void {
    try {
      const envConfig = parseEnvironmentConfig({
        LANGFUSE_ENABLED: this.configService.get<string>('LANGFUSE_ENABLED'),
        LANGFUSE_SECRET_KEY: this.configService.get<string>('LANGFUSE_SECRET_KEY'),
        LANGFUSE_PUBLIC_KEY: this.configService.get<string>('LANGFUSE_PUBLIC_KEY'),
        LANGFUSE_BASE_URL: this.configService.get<string>('LANGFUSE_BASE_URL'),
        LANGFUSE_FLUSH_INTERVAL: this.configService.get<string>('LANGFUSE_FLUSH_INTERVAL'),
        LANGFUSE_FLUSH_AT: this.configService.get<string>('LANGFUSE_FLUSH_AT'),
        LANGFUSE_REQUEST_TIMEOUT: this.configService.get<string>('LANGFUSE_REQUEST_TIMEOUT'),
        LANGFUSE_SAMPLE_RATE: this.configService.get<string>('LANGFUSE_SAMPLE_RATE'),
        LANGFUSE_MASK_INPUTS: this.configService.get<string>('LANGFUSE_MASK_INPUTS'),
        LANGFUSE_MASK_OUTPUTS: this.configService.get<string>('LANGFUSE_MASK_OUTPUTS'),
      });

      const validation = validateLangfuseConfig(envConfig);

      if (!validation.isValid) {
        this.logger.warn(`Langfuse configuration invalid: ${validation.error}`);
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => this.logger.log(warning));
      }

      this.config = validation.config!;

      if (!this.config.enabled) {
        this.logger.log('Langfuse is disabled via LANGFUSE_ENABLED=false');
        return;
      }

      // Initialize Langfuse client
      this.client = new Langfuse({
        secretKey: this.config.secretKey!,
        publicKey: this.config.publicKey!,
        baseUrl: this.config.baseUrl,
        flushInterval: this.config.flushInterval,
        flushAt: this.config.flushAt,
        requestTimeout: this.config.requestTimeout,
        enabled: this.config.enabled,
      });

      this.enabled = true;
      this.logger.log(`Langfuse initialized successfully at ${this.config.baseUrl}`);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to initialize Langfuse, continuing without observability', errorStack);
      this.enabled = false;
    }
  }

  /**
   * Check if Langfuse is enabled and operational
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Get configuration details for health checks
   */
  getConfig(): LangfuseConfig | null {
    return this.config;
  }

  /**
   * Create a new trace
   * @param params Trace parameters
   * @returns LangfuseTraceClient or null if Langfuse is disabled
   */
  trace(params: TraceParams): LangfuseTraceClient | null {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      return this.client!.trace(params);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to create Langfuse trace', errorStack);
      return null;
    }
  }

  /**
   * Get prompt from Langfuse by name
   * @param name Prompt name
   * @param version Optional version number
   * @returns Prompt client or null
   */
  async getPrompt(name: string, version?: number): Promise<unknown> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const prompt = await this.client!.getPrompt(name, version);
      return prompt;
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.warn(`Failed to fetch prompt "${name}" from Langfuse`, errorStack);
      return null;
    }
  }

  /**
   * Flush all pending events to Langfuse
   * @returns Promise that resolves when flush is complete
   */
  async flush(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.client!.flushAsync();
      this.logger.debug('Langfuse events flushed successfully');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.warn('Failed to flush Langfuse events', errorStack);
    }
  }

  /**
   * Shutdown Langfuse client gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.client!.shutdownAsync();
      this.logger.log('Langfuse shutdown successfully');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.warn('Error during Langfuse shutdown', errorStack);
    }
  }

  /**
   * NestJS lifecycle hook - cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.flush();
    await this.shutdown();
  }

  /**
   * Check sampling rate to determine if event should be traced
   * @returns true if event should be traced based on sampling rate
   */
  shouldSample(): boolean {
    if (!this.isEnabled() || !this.config) {
      return false;
    }

    return Math.random() < this.config.sampleRate;
  }

  /**
   * Get the underlying Langfuse client (for advanced usage)
   * @returns Langfuse client or null
   */
  getClient(): Langfuse | null {
    return this.client;
  }
}
