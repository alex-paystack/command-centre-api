import { Langfuse } from 'langfuse';
import { ChatMode, PageContext } from '../types';

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
 * Get or create the Langfuse client instance
 */
export function getLangfuseClient(): Langfuse | null {
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
function buildTags(context: TelemetryContext): string[] {
  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'command-centre-api';
  const environment = process.env['OTEL_SERVICE_ENV'] ?? 'local';
  const version = process.env['OTEL_SERVICE_VERSION'] ?? '1.0.0';

  const tags: string[] = [
    `service:${serviceName}`,
    `env:${environment}`,
    `version:${version}`,
    `operation:${context.operationType}`,
  ];

  // Add mode tag
  if (context.mode) {
    tags.push(`mode:${context.mode}`);
  }

  // Add page context tag
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

  return {
    isEnabled: true,
    functionId: context.operationType,
    metadata: {
      ...metadata,
      tags,
    },
  };
}

/**
 * Creates a minimal telemetry context for operations that don't have full conversation context.
 * Used for title generation which happens before the conversation is fully established.
 *
 * @param conversationId - The conversation ID
 * @param userId - The user ID
 * @param operationType - The type of LLM operation
 * @returns Telemetry context with minimal required fields
 */
export function createMinimalTelemetryContext(
  conversationId: string,
  userId: string,
  operationType: LLMOperationType,
  parentTraceId: string,
): TelemetryContext {
  return {
    conversationId,
    parentTraceId,
    userId,
    operationType,
  };
}

/**
 * Creates a full telemetry context for chat operations.
 *
 * @param conversationId - The conversation ID
 * @param userId - The user ID
 * @param mode - Chat mode (global or page)
 * @param pageContext - Optional page context for page-scoped conversations
 * @param operationType - The type of LLM operation
 * @returns Full telemetry context
 */
export function createChatTelemetryContext(
  conversationId: string,
  userId: string,
  mode: ChatMode | undefined,
  pageContext: PageContext | undefined,
  operationType: LLMOperationType,
  parentTraceId: string,
): TelemetryContext {
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
export function createConversationTrace(
  context: TelemetryContext,
  traceId: string,
  input: { message: string; mode?: string; pageContext?: PageContext },
) {
  const langfuse = getLangfuseClient();
  if (!langfuse) {
    return null;
  }

  const tags = buildTags(context);
  const metadata = buildMetadata(context);

  // Create a trace with a descriptive name based on the operation
  const traceName = `chat-interaction`;

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
