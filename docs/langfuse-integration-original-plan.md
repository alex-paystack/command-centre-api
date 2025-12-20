# Langfuse Integration Plan for Command Centre API

## Overview

Integrate Langfuse for comprehensive AI observability including LLM traces, token usage, costs, latencies, tool executions, user sessions, and prompt versioning. The integration will be **optional with graceful degradation** - the app will work normally without Langfuse configured.

## Current State

- **AI Framework**: Vercel AI SDK v5.0.110 (`ai` package)
- **Models**: `gpt-4o-mini` (main chat), `gpt-3.5-turbo` (titles)
- **Existing Observability**: `@paystackhq/nestjs-observability` (OpenTelemetry-based)
- **Key Operations**: Chat streaming, title generation, summarization, message classification
- **Tools**: 10 AI tools for retrieval, export, and visualization

## Architecture Approach

### Hybrid Integration Strategy

1. **OpenTelemetry Span Processor** (primary) - Automatic instrumentation via Vercel AI SDK's `experimental_telemetry` + `LangfuseSpanProcessor`
2. **LangfuseService Wrapper** (secondary) - Explicit session management, user tracking, graceful degradation
3. **Factory Pattern** - Create AI operations with consistent telemetry configuration

### Graceful Degradation

- All Langfuse operations wrapped in try-catch with null returns
- Service initialization validates config, disables if incomplete
- App works normally if Langfuse unavailable
- Health check endpoint to monitor Langfuse status

### Trace Architecture

- **Trace ID** = Conversation ID (one trace per conversation)
- **Session ID** = User ID (tracks user across conversations)
- **User ID** = Extracted from JWT token
- Link related operations: classification → chat → tools (via parent spans)

## Implementation Steps

### Phase 1: Foundation

**1. Install Dependencies**

```bash
pnpm add langfuse langfuse-vercel @langfuse/otel
```

**2. Environment Configuration** (`.env.example`)

```bash
# Langfuse (Optional - graceful degradation)
LANGFUSE_ENABLED=false
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # or self-hosted URL
LANGFUSE_FLUSH_INTERVAL=5000
LANGFUSE_FLUSH_AT=15
LANGFUSE_SAMPLE_RATE=1.0
```

**3. Create Langfuse Module Structure**

```
src/common/observability/
├── langfuse.module.ts          # NestJS module
├── langfuse.service.ts         # Core service with graceful degradation
├── langfuse.config.ts          # Config validation
└── utils/
    └── ai-telemetry-config.ts  # Helper for AI SDK telemetry
```

**4. Implement LangfuseService** (`src/common/observability/langfuse.service.ts`)

- Initialize Langfuse client with config validation
- Return null/no-op if disabled or credentials missing
- Implement: `isEnabled()`, `createTrace()`, `flush()`
- Add `onModuleDestroy()` for cleanup
- Wrap all operations in try-catch with error logging

**5. Create LangfuseModule** (`src/common/observability/langfuse.module.ts`)

- Import ConfigModule
- Provide LangfuseService as global
- Export for use across modules

**6. Register in AppModule** (`src/app.module.ts`)

- Add `LangfuseModule` to imports array (after ConfigModule)

**7. Register OTEL Span Processor** (`src/main.ts`)

- Import `LangfuseSpanProcessor` from `@langfuse/otel`
- Register with existing OpenTelemetry provider early in bootstrap
- Only register if `LANGFUSE_ENABLED=true`

### Phase 2: Instrument AI Operations

**8. Create Telemetry Config Helper** (`src/common/observability/utils/ai-telemetry-config.ts`)

- Factory function to generate `experimental_telemetry` config
- Takes: functionId, metadata, promptName, promptVersion
- Returns disabled config if LangfuseService not enabled

**9. Instrument Main Chat Streaming** (`src/modules/chat/chat.service.ts:541`)

- Inject `LangfuseService` in constructor
- Add `experimental_telemetry` to `streamText()` call:

```typescript
experimental_telemetry: {
  isEnabled: this.langfuseService.isEnabled(),
  functionId: 'chat-stream',
  metadata: {
    conversationId,
    userId,
    mode: mode || ChatMode.GLOBAL,
    hasPageContext: !!pageContext,
    langfusePrompt: { name: 'chat-agent-prompt', version: 1 },
  },
}
```

**10. Instrument Title Generation** (`src/common/ai/actions.ts:21`)

- Pass `LangfuseService` instance to `generateConversationTitle()`
- Add `experimental_telemetry` config with functionId: `'generate-title'`

**11. Instrument Summarization** (`src/common/ai/actions.ts:46`)

- Pass `LangfuseService` to `summarizeConversation()`
- Add telemetry config with functionId: `'conversation-summary'`
- Include metadata: conversationId, messageCount, hasPreviousSummary

**12. Instrument Classification** (`src/common/ai/actions.ts:84`)

- Pass `LangfuseService` to `classifyMessage()`
- Add telemetry config with functionId: `'message-classification'`
- Include metadata: hasPageContext

### Phase 3: Session & Tool Tracking

**13. Add Session Tracking** (`src/modules/chat/chat.service.ts`)

- Create trace at conversation start in `handleStreamingChat()`
- Use `conversationId` as traceId, `userId` as both userId and sessionId
- Add conversation metadata: title, mode, messageCount

**14. Tool Execution Tracking** (`src/common/ai/tools/*.ts`)

- Tools auto-traced by Vercel AI SDK via `experimental_telemetry`
- Optionally add OpenTelemetry span attributes for extra metadata:

```typescript
const span = trace.getActiveSpan();
if (span) {
  span.setAttribute('tool.name', 'getTransactions');
  span.setAttribute('tool.params.perPage', perPage);
}
```

**15. Link Related Operations**

- Wrap classification + chat in single trace context
- Maintain parent-child span relationships automatically via OTEL

### Phase 4: Advanced Features

**16. Prompt Management** (Optional)

- Create `PromptService` in `src/common/observability/`
- Implement `getPrompt(name)` that fetches from Langfuse with local fallback
- Version prompts in Langfuse UI:
  - `chat-agent-prompt`
  - `page-scoped-prompt`
  - `classifier-prompt`
  - `page-scoped-classifier-prompt`
  - `title-generation-prompt`
  - `summary-prompt`

**17. Health Check** (`src/modules/health/health.controller.ts`)

- Add `/health/langfuse` endpoint
- Return status: 'up' | 'disabled' | 'error'
- Include configuration details (baseUrl, enabled)

**18. Error Handling & Logging**

- Use NestJS Logger with context throughout
- Log Langfuse initialization status
- Warn on operational failures
- Never throw errors from Langfuse operations

### Phase 5: Testing

**19. Create Unit Tests** (`src/common/observability/langfuse.service.spec.ts`)

- Test graceful degradation (missing credentials)
- Test config validation (cloud vs self-hosted URLs)
- Test error handling (network failures)
- Verify no-op behavior when disabled

**20. Update Existing Tests**

- Mock `LangfuseService` in all ChatService tests
- Default `isEnabled()` to return `false` in tests
- Verify tests pass unchanged with mocked service

**21. Integration Tests**

- Test with Langfuse enabled (mock client)
- Verify trace creation with correct metadata
- Test tool execution tracking

### Phase 6: Documentation

**22. Update Documentation**

- Add Langfuse section to `CLAUDE.md`
- Document environment variables
- Document prompt management workflow
- Add troubleshooting guide (common issues)
- Update `README.md` with observability features

**23. Deployment Guide**

- Document rollout strategy (disabled → staging → production sampling)
- Configuration for cloud vs self-hosted
- Monitoring and alerting recommendations

## Critical Files

### New Files

- `src/common/observability/langfuse.module.ts`
- `src/common/observability/langfuse.service.ts`
- `src/common/observability/langfuse.config.ts`
- `src/common/observability/utils/ai-telemetry-config.ts`
- `src/common/observability/langfuse.service.spec.ts`

### Modified Files

- `src/main.ts` - Register LangfuseSpanProcessor
- `src/app.module.ts` - Import LangfuseModule
- `src/modules/chat/chat.service.ts` - Main instrumentation
- `src/common/ai/actions.ts` - Instrument title/summary/classification
- `.env.example` - Add Langfuse config
- `package.json` - Add dependencies
- `CLAUDE.md` - Document Langfuse integration

## Key Features Delivered

✅ **LLM Call Tracking**: All OpenAI calls tracked with tokens, costs, latency
✅ **Tool Execution Tracking**: All AI tool calls with parameters and results
✅ **User Session Analytics**: Track users across conversations
✅ **Prompt Versioning**: Version control and A/B testing support
✅ **Graceful Degradation**: App works without Langfuse configured
✅ **Cloud & Self-Hosted**: Support both deployment models
✅ **Production Ready**: Error handling, health checks, monitoring

## Success Criteria

1. ✅ Chat agent works identically with Langfuse enabled/disabled
2. ✅ All LLM operations appear in Langfuse with complete metadata
3. ✅ Tool executions tracked with parameters and results
4. ✅ User sessions linkable across multiple conversations
5. ✅ No breaking changes to existing tests
6. ✅ Health check endpoint reports Langfuse status
7. ✅ Documentation complete for setup and usage
