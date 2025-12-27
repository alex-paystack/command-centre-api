---
name: Langfuse LLM Observability
overview: Implement Langfuse integration for LLM observability by modifying the @paystackhq/nestjs-observability package to support custom span processors, then configuring the Langfuse span processor and enabling telemetry on all AI SDK calls with proper trace grouping and metadata.
todos:
  - id: modify-observability-pkg
    content: Modify @paystackhq/nestjs-observability to support custom span processors via OTEL_SPAN_PROCESSORS_PATH
    status: completed
  - id: add-langfuse-deps
    content: Install langfuse and @langfuse/otel packages
    status: completed
    dependencies:
      - modify-observability-pkg
  - id: create-langfuse-config
    content: Create src/common/observability/langfuse.config.ts with LangfuseSpanProcessor
    status: completed
    dependencies:
      - add-langfuse-deps
  - id: create-telemetry-helper
    content: Create src/common/ai/telemetry.ts helper for building telemetry config
    status: completed
    dependencies:
      - add-langfuse-deps
  - id: update-ai-actions
    content: Update actions.ts to enable experimental_telemetry on all LLM calls
    status: completed
    dependencies:
      - create-telemetry-helper
  - id: update-chat-service
    content: Update chat.service.ts to pass telemetry context to all AI calls
    status: completed
    dependencies:
      - update-ai-actions
  - id: update-env-config
    content: Document required environment variables for Langfuse integration
    status: completed
    dependencies:
      - create-langfuse-config
---

# Langfuse LLM Observability Integration

## Architecture Overview

```mermaid
flowchart TB
    subgraph ChatFlow [Chat Request Flow]
        A[ChatController] --> B[ChatService.handleStreamingChat]
        B --> C[generateConversationTitle]
        B --> D[classifyMessage]
        B --> E[streamText]
        B --> F[summarizeConversation]
    end

    subgraph Telemetry [Telemetry Layer]
        C --> G[experimental_telemetry]
        D --> G
        E --> G
        F --> G
        G --> H[LangfuseSpanProcessor]
    end

    subgraph Tracing [Trace Structure]
        H --> I["Trace (sessionId=conversationId, userId)"]
        I --> J[Span: title-generation]
        I --> K[Span: classification]
        I --> L[Span: chat-response]
        I --> M[Span: summarization]
    end

    H --> N[Langfuse Cloud]
```

## Implementation Steps

### Step 1: Modify @paystackhq/nestjs-observability

Update the register.ts to support custom span processors via a hook:

- Add check for `OTEL_SPAN_PROCESSORS_PATH` environment variable
- If set, dynamically import the file and call `getSpanProcessors()` function
- Merge returned processors with the SDK's span processors array

This allows consuming applications to inject custom span processors (like Langfuse) without modifying the core package.

### Step 2: Add Langfuse Dependencies

Install required packages:

```bash
pnpm add langfuse @langfuse/otel
```

### Step 3: Create Langfuse Span Processor Configuration

Create [`src/common/observability/langfuse.config.ts`](src/common/observability/langfuse.config.ts):

- Export `getSpanProcessors()` function that returns `LangfuseSpanProcessor`
- Configure `shouldExportSpan` to only export AI SDK spans (filter out NestJS infrastructure)
- Use environment variables for Langfuse credentials

### Step 4: Create Telemetry Helper

Create [`src/common/ai/telemetry.ts`](src/common/ai/telemetry.ts):

- Define `createTelemetryConfig()` function that builds the `experimental_telemetry` config
- Include sessionId (conversationId), userId, and custom metadata
- Build tags array with mode, page context, service, env, version
- Handle different LLM call types (title generation, classification, streaming, summarization)

### Step 5: Update AI SDK Calls

Modify [`src/common/ai/actions.ts`](src/common/ai/actions.ts):

- Update `generateConversationTitle()` to accept telemetry context and enable experimental_telemetry
- Update `classifyMessage()` with telemetry support
- Update `summarizeConversation()` with telemetry support

### Step 6: Update Chat Service

Modify [`src/modules/chat/chat.service.ts`](src/modules/chat/chat.service.ts):

- Pass telemetry context to all AI function calls
- Include conversation ID, user ID, mode, page context in metadata
- Ensure all LLM calls within a conversation share the same trace (sessionId)

### Step 7: Environment Configuration

Add required environment variables:

```env
# Langfuse Configuration
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Span Processor Hook
OTEL_SPAN_PROCESSORS_PATH=./dist/common/observability/langfuse.config.js
```

### Key Files to Modify

| File | Changes ||------|---------|| `@paystackhq/nestjs-observability/register.ts` | Add span processor hook support || [`src/common/observability/langfuse.config.ts`](src/common/observability/langfuse.config.ts) | New - Langfuse span processor setup || [`src/common/ai/telemetry.ts`](src/common/ai/telemetry.ts) | New - Telemetry configuration helper || [`src/common/ai/actions.ts`](src/common/ai/actions.ts) | Enable telemetry on all LLM calls || [`src/modules/chat/chat.service.ts`](src/modules/chat/chat.service.ts) | Pass telemetry context throughout || [`package.json`](package.json) | Add langfuse dependencies |

### Trace Structure

Each conversation will produce traces with:

- **Trace ID**: Auto-generated by OTEL
- **Session ID**: `conversationId` (groups all LLM calls in a conversation)
- **User ID**: From JWT authentication
- **Metadata**:
- `mode`: "global" or "page"
- `pageContext.type`: transaction, customer, etc. (when applicable)
- `pageContext.resourceId`: Resource ID (when applicable)
- `service`: "command-centre-api"
- `environment`: From `OTEL_SERVICE_ENV`
- `version`: From `OTEL_SERVICE_VERSION`
- **Tags**:
- `mode:global` or `mode:page`
