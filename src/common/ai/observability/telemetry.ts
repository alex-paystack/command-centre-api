import { Langfuse } from 'langfuse';
import { ChatMode, PageContext } from '../types';

// TODO: LLM trace should include user email so it is easier to identify the user

/**
 * LLM operation types for telemetry tracking
 */
export enum LLMOperationType {
  TITLE_GENERATION = 'title-generation',
  CLASSIFICATION = 'classification',
  CHAT_RESPONSE = 'chat-response',
  SUMMARIZATION = 'summarization',
}

/**
 * Singleton Langfuse client instance
 */
let langfuseClient: Langfuse | null = null;

/**
 * Checks if Langfuse telemetry is explicitly enabled.
 */
function isLangfuseEnabled(): boolean {
  return process.env['LANGFUSE_ENABLED'] === 'true';
}

/**
 * Get or create the Langfuse client instance
 */
export function getLangfuseClient(): Langfuse | null {
  if (!isLangfuseEnabled()) {
    return null;
  }

  if (langfuseClient) {
    return langfuseClient;
  }

  const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
  const secretKey = process.env['LANGFUSE_SECRET_KEY'];

  if (!publicKey || !secretKey) {
    return null;
  }

  const baseUrl = process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com';
  const environment = process.env['OTEL_SERVICE_ENV'] ?? 'local';

  langfuseClient = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
    release: process.env['OTEL_SERVICE_VERSION'] ?? '1.0.0',
    environment,
  });

  return langfuseClient;
}

/**
 * Context for building telemetry configuration
 */
export interface TelemetryContext {
  /** Conversation ID - used as Langfuse sessionId to group all LLM calls in a conversation */
  conversationId: string;
  /** Parent trace ID - used to group all LLM calls in a conversation */
  parentTraceId: string;
  /** User ID from JWT authentication */
  userId: string;
  /** Chat mode (global or page) */
  mode?: ChatMode;
  /** Page context for page-scoped conversations */
  pageContext?: PageContext;
  /** Type of LLM operation */
  operationType: LLMOperationType;
}

/**
 * Builds tags array for Langfuse filtering
 */
function buildTags(context: TelemetryContext) {
  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'command-centre-api';
  const environment = process.env['OTEL_SERVICE_ENV'] ?? 'local';
  const version = process.env['OTEL_SERVICE_VERSION'] ?? '1.0.0';

  const tags = [
    `service:${serviceName}`,
    `env:${environment}`,
    `version:${version}`,
    `operation:${context.operationType}`,
  ];

  if (context.mode) {
    tags.push(`mode:${context.mode}`);
  }

  if (context.pageContext?.type) {
    tags.push(`page:${context.pageContext.type}`);
  } else {
    tags.push('page:global');
  }

  return tags;
}

/**
 * Builds metadata object for Langfuse
 */
function buildMetadata(context: TelemetryContext): Record<string, string | boolean | undefined> {
  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'command-centre-api';
  const environment = process.env['OTEL_SERVICE_ENV'] ?? 'local';
  const version = process.env['OTEL_SERVICE_VERSION'] ?? '1.0.0';

  return {
    service: serviceName,
    environment,
    version,
    mode: context.mode,
    operationType: context.operationType,
    pageContextType: context.pageContext?.type,
    pageContextResourceId: context.pageContext?.resourceId,
    // Langfuse-specific metadata keys for session/user mapping
    sessionId: context.conversationId,
    userId: context.userId,
    langfuseTraceId: context.parentTraceId,
    langfuseUpdateParent: false,
  };
}

/**
 * Creates the experimental_telemetry configuration for AI SDK calls.
 *
 * This configuration enables OpenTelemetry tracing for the AI SDK and includes
 * Langfuse-specific metadata for:
 * - Session tracking (conversationId groups all LLM calls in a conversation)
 * - User identification
 * - Contextual metadata (mode, page context, etc.)
 * - Filterable tags
 *
 * @param context - The telemetry context containing conversation and user info
 * @returns The experimental_telemetry configuration object for AI SDK
 *
 * @example
 * ```typescript
 * const result = await streamText({
 *   model: openai('gpt-4o-mini'),
 *   messages,
 *   experimental_telemetry: createTelemetryConfig({
 *     conversationId: 'abc-123',
 *     userId: 'user-456',
 *     mode: ChatMode.PAGE,
 *     pageContext: { type: PageContextType.TRANSACTION, resourceId: 'txn-789' },
 *     operationType: LLMOperationType.CHAT_RESPONSE,
 *   }),
 * });
 * ```
 */
export function createTelemetryConfig(context: TelemetryContext) {
  const tags = buildTags(context);
  const metadata = buildMetadata(context);
  const langfuseEnabled = isLangfuseEnabled();

  return {
    isEnabled: langfuseEnabled,
    functionId: context.operationType,
    metadata: {
      ...metadata,
      tags,
    },
  };
}

/**
 * Parameters for creating a minimal telemetry context
 */
export interface CreateMinimalTelemetryContextParams {
  /** Conversation ID - used as Langfuse sessionId to group all LLM calls */
  conversationId: string;
  /** User ID from JWT authentication */
  userId: string;
  /** Type of LLM operation */
  operationType: LLMOperationType;
  /** Parent trace ID - used to group all LLM calls in a conversation */
  parentTraceId: string;
}

/**
 * Creates a minimal telemetry context for operations that don't have full conversation context.
 * Used for title generation which happens before the conversation is fully established.
 *
 * @param params - Object containing conversation ID, user ID, operation type, and parent trace ID
 * @returns Telemetry context with minimal required fields
 */
export function createMinimalTelemetryContext({
  conversationId,
  userId,
  operationType,
  parentTraceId,
}: CreateMinimalTelemetryContextParams): TelemetryContext {
  return {
    conversationId,
    parentTraceId,
    userId,
    operationType,
  };
}

/**
 * Parameters for creating a full chat telemetry context
 */
export interface CreateChatTelemetryContextParams {
  /** Conversation ID - used as Langfuse sessionId to group all LLM calls */
  conversationId: string;
  /** User ID from JWT authentication */
  userId: string;
  /** Chat mode (global or page) */
  mode?: ChatMode;
  /** Page context for page-scoped conversations */
  pageContext?: PageContext;
  /** Type of LLM operation */
  operationType: LLMOperationType;
  /** Parent trace ID - used to group all LLM calls in a conversation */
  parentTraceId: string;
}

/**
 * Creates a full telemetry context for chat operations.
 *
 * @param params - Object containing conversation ID, user ID, mode, page context, operation type, and parent trace ID
 * @returns Full telemetry context
 */
export function createChatTelemetryContext({
  conversationId,
  userId,
  mode,
  pageContext,
  operationType,
  parentTraceId,
}: CreateChatTelemetryContextParams): TelemetryContext {
  return {
    conversationId,
    parentTraceId,
    userId,
    mode,
    pageContext,
    operationType,
  };
}

/**
 * Creates a Langfuse trace for a conversation interaction.
 * This creates the parent trace that groups all LLM operations (classification, chat, summarization)
 * for a single user message.
 *
 * @param context - The telemetry context
 * @param input - The input data for the trace (user message)
 * @returns The Langfuse trace instance, or null if Langfuse is not configured
 */
export function createConversationTrace(context: TelemetryContext, traceId: string, input: string) {
  const langfuse = getLangfuseClient();

  if (!langfuse) {
    return null;
  }

  const tags = buildTags(context);
  const metadata = buildMetadata(context);

  // Create a trace with a descriptive name based on the operation
  const traceName = 'chat-session';

  return langfuse.trace({
    id: traceId,
    name: traceName,
    sessionId: context.conversationId,
    userId: context.userId,
    input,
    metadata,
    tags,
  });
}
