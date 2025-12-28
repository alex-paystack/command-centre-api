# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
pnpm run start:dev      # Hot reload with OTEL disabled for local dev
pnpm run build          # Production build
pnpm run start:prod     # Run production build
```

### Testing

```bash
pnpm run test           # Unit tests
pnpm run test:watch     # Watch mode
pnpm run test:cov       # Coverage report
pnpm run test:e2e       # E2E tests
pnpm run test:all       # All tests (used in CI)
```

### Code Quality

```bash
pnpm run lint           # Auto-fix linting issues
pnpm run lint:check     # Check only (CI)
pnpm run format         # Auto-format code
pnpm run format:check   # Check only (CI)
pnpm run ci:check       # Full CI check (format + lint + test:all)
```

### Database Migrations

```bash
pnpm run migration:create    # Create empty migration
pnpm run migration:generate  # Auto-generate from entity changes
pnpm run migration:run       # Apply pending migrations
pnpm run migration:revert    # Rollback last migration
pnpm run migration:show      # Show migration status
```

## Architecture Overview

### Core Service Pattern: Shared PaystackModule

The codebase uses a **shared module pattern** to avoid duplicate providers. The `PaystackModule` is a shared module that:

- Provides a single `PaystackApiService` instance across the entire application
- Bundles `ConfigModule` and `HttpModule` dependencies
- Is imported by both `ChatModule` and `ChartsModule`
- Prevents duplicate HTTP client instances with different configurations

**IMPORTANT**: When adding new features that need Paystack API access, import `PaystackModule` instead of creating separate HTTP/Config instances.

### AI Tool Architecture

AI tools are organized by category in `src/common/ai/tools/`:

- **`retrieval.ts`** - Data fetching tools (`getTransactions`, `getCustomers`, etc.)
- **`export.ts`** - Data export tools (`exportTransactions`, `exportRefunds`, etc.)
- **`visualization.ts`** - Chart generation (`generateChartData`)
- **`index.ts`** - Tool orchestration and page-scoped filtering

Tools are factory functions that receive `PaystackApiService` and `getAuthenticatedUser()` to ensure JWT passthrough authentication.

### Dual Chat Mode System

The chat system operates in two distinct modes:

1. **Global Mode** (`mode: "global"`)
   - Dashboard-wide queries across all resources
   - Access to all AI tools
   - General conversation about merchant data

2. **Page-Scoped Mode** (`mode: "page"`)
   - Locked to specific resource (transaction, customer, refund, payout, dispute)
   - Automatic resource enrichment via `PageContextService`
   - Filtered tool access based on `RESOURCE_TOOL_MAP`
   - Dual-layer classification: out-of-scope + out-of-page-scope protection
   - Context persists throughout conversation lifecycle

**Key Implementation Details**:

- Page context is stored in conversation entity and validated on every message
- Cannot switch page context after conversation creation
- Resource data is fetched and injected into system prompt automatically
- Tool filtering prevents AI from suggesting irrelevant actions

### Conversation Lifecycle & Summarization

Conversations follow a lifecycle with automatic summarization based on token usage:

1. **Active Phase**: Conversation continues until token usage reaches 60% of model's context window (default: 76,800 tokens for gpt-4o-mini)
2. **First Summary**: Generated after threshold, conversation continues with reset token counter
3. **Second Summary**: Generated after another threshold, conversation closes
4. **Continuation**: User can create new conversation via `/conversations/from-summary` with carried-over context

**Token-Based Summarization**:

- Tracks cumulative token usage from AI SDK's `streamText` usage data
- Triggers when `totalTokensUsed >= (CONTEXT_WINDOW_SIZE * TOKEN_THRESHOLD_PERCENTAGE)`
- Default: 76,800 tokens (128,000 \* 0.6) for gpt-4o-mini
- Token counter resets to 0 after each summary generation
- Automatic and intelligent: adapts to actual conversation length regardless of message count

**Configuration**:

- `CONTEXT_WINDOW_SIZE=128000` - Model context window (adjust for different models)
- `TOKEN_THRESHOLD_PERCENTAGE=0.6` - Percentage of context window before triggering summary (60%)
- `MAX_SUMMARIES=2` - Maximum summaries before closing conversation
- `MESSAGE_HISTORY_LIMIT=40` - Messages kept in AI context

### Request Flow & Authentication

All `/chat/*` and `/charts/*` endpoints require JWT authentication:

1. **JwtAuthGuard** (global) validates Bearer token
2. **@CurrentUser()** decorator extracts user ID from token claims
3. **PaystackApiService** reuses the user's JWT for all Paystack API calls (JWT passthrough)
4. **Rate limiting** enforced per user based on `MESSAGE_LIMIT` and `RATE_LIMIT_PERIOD_HOURS`

### Chart Aggregation System

Charts are generated via utilities in `src/common/ai/utilities/`:

- **Time-based**: `by-day`, `by-hour`, `by-week`, `by-month` (returns per-currency series)
- **Categorical**: `by-status`, `by-channel`, `by-type`, `by-category`, `by-resolution` (returns flat data)
- **Resource-specific configs** in `utilities/chart-config.ts` define field accessors (`getAmount`, `getCurrency`, `getStatus`, etc.)
- **Centralized validation**: `utilities/chart-validation.ts` provides shared validation for chart parameters
- **Aggregation logic**: `utilities/aggregation.ts` handles data aggregation and series generation
- **Chart generation**: `utilities/chart-generator.ts` coordinates the end-to-end chart creation process
- **Channel filtering**: Transaction-specific payment channel analysis (`by-channel` aggregation)
- **Validation**: 30-day max date range, resource-specific aggregation type validation, channel filter validation
- **Recharts-compatible** output format with comprehensive summary statistics

## Development Patterns

### Adding a New AI Tool

1. Choose category file (`retrieval.ts`, `export.ts`, or `visualization.ts`)
2. Create factory function with Zod schema and execute function
3. Use `paystackService.get()` or `.post()` with JWT token from `getAuthenticatedUser()`
4. Export factory from category file
5. Add to `createTools()` in `tools/index.ts`
6. Optionally add to `RESOURCE_TOOL_MAP` for page-scoped filtering
7. Write tests in corresponding `*-tools.spec.ts` file

**Example**:

```typescript
export function createMyTool(paystackService: PaystackApiService, getAuthenticatedUser: () => AuthenticatedUser) {
  return tool({
    description: 'Tool description for AI',
    inputSchema: z.object({
      param: z.string().describe('Parameter description'),
    }),
    execute: async ({ param }) => {
      const { jwtToken } = getAuthenticatedUser();
      if (!jwtToken) return { error: 'Authentication token not available' };

      try {
        const response = await paystackService.get('/endpoint', jwtToken, { param });
        return { success: true, data: response.data };
      } catch (error) {
        return { error: error.message };
      }
    },
  });
}
```

### Adding a Chart Resource Type

1. Add to `ChartResourceType` enum in `utilities/chart-config.ts`
2. Define `ResourceFieldConfig` with field accessors (including optional model-specific fields like `getChannel`)
3. Update `VALID_AGGREGATIONS` map
4. Update `STATUS_VALUES` map
5. Add to `API_ENDPOINTS` map
6. Update `getFieldConfig()` function
7. Update `utilities/chart-validation.ts` if adding resource-specific validation rules
8. If adding categorical aggregations, update `getChartType()` in `utilities/aggregation.ts`

### Adding a Page Context Resource Type

1. Add to `PageContextType` enum in `types/index.ts`
2. Implement fetching in `PageContextService.fetchResourceData()`
3. Add formatting in `PageContextService.formatResourceData()`
4. Update `RESOURCE_TOOL_MAP` in `tools/index.ts`
5. Add TypeScript interface in `types/index.ts`

### Using Chart Validation

The `utilities/chart-validation.ts` module provides centralized validation for chart parameters. Use `validateChartParams()` when:

- Creating new saved charts (`SavedChartService.saveChart()`)
- Regenerating charts with overrides (`SavedChartService.getSavedChartWithData()`)
- Implementing new chart-related features

**Example**:

```typescript
import { validateChartParams } from '~/common/ai/utilities/chart-validation';

const validation = validateChartParams({
  resourceType: ChartResourceType.TRANSACTION,
  aggregationType: AggregationType.BY_CHANNEL,
  status: 'success',
  from: '2024-01-01',
  to: '2024-01-31',
  channel: PaymentChannel.CARD,
});

if (!validation.isValid) {
  throw new ValidationError(validation.error, ErrorCodes.INVALID_PARAMS);
}
```

**Validation Rules**:

- Resource type and aggregation type compatibility
- Status values must match resource-specific enums
- Date range must not exceed 30 days
- Channel filter only valid for transactions
- Channel must be a valid `PaymentChannel` enum value

### Working with TypeORM & MongoDB

- Entities use MongoDB ObjectID with TypeORM decorators
- Column names use camelCase (TypeORM transforms to snake_case in DB)
- Always generate migrations after entity changes: `pnpm run migration:generate`
- Repositories inject via `@InjectRepository(Entity)`

## Key Configuration

### Environment Variables

**Critical for local development**:

```env
DATABASE_HOST=mongodb
OPENAI_API_KEY=sk-...
PAYSTACK_API_BASE_URL=https://studio-api.paystack.co  # Staging
JWT_SECRET=your-secret-key
```

**Rate limiting**:

```env
MESSAGE_LIMIT=100
RATE_LIMIT_PERIOD_HOURS=24
```

**Conversation management**:

```env
MESSAGE_HISTORY_LIMIT=40
SUMMARIZATION_THRESHOLD=20
MAX_SUMMARIES=2
```

### Observability

The app uses `@paystackhq/nestjs-observability` for OpenTelemetry instrumentation:

- Traces, metrics, and logs are automatically collected
- Configured via `OTEL_*` environment variables
- Local dev disables exporters for performance: `OTEL_TRACES_EXPORTER=none`

### LLM Observability with Langfuse

The app integrates with Langfuse for LLM-specific observability via the Vercel AI SDK's telemetry:

- All LLM calls (`generateText`, `generateObject`, `streamText`) are traced
- Parent traces created for each chat interaction with proper naming and input/output
- Traces are grouped by conversation (session ID = conversation ID)
- User identification from JWT authentication
- Rich metadata: mode, page context, operation type
- Filterable tags: `mode:global`, `page:transaction`, `env:production`, etc.
- Configurable span batching and flush behavior for performance optimization
- Span filtering to only export AI-related operations (excludes HTTP, DB, infrastructure spans)

**Configuration**:

```env
# Service Identification (Required for proper trace attribution)
OTEL_SERVICE_NAME=command-centre-api                           # Service name for traces
OTEL_SERVICE_VERSION=1.0.0                                     # Service version for release tracking
OTEL_SERVICE_ENV=production                                    # Environment (local/staging/production)

# Langfuse Configuration
LANGFUSE_ENABLED=true                                          # Enable Langfuse observability (default: false)
LANGFUSE_PUBLIC_KEY=pk-lf-...                                  # Langfuse public key
LANGFUSE_SECRET_KEY=sk-lf-...                                  # Langfuse secret key
LANGFUSE_BASE_URL=https://cloud.langfuse.com                   # Langfuse API URL (defaults to cloud)

# OpenTelemetry Integration
OTEL_SPAN_PROCESSORS_PATH=./dist/common/ai/observability/langfuse.config.js  # Span processor hook

# Optional Performance Tuning
LANGFUSE_FLUSH_INTERVAL=5000                                   # Flush interval in milliseconds (default: 5000)
LANGFUSE_FLUSH_AT=15                                           # Flush after N spans (default: 15)
```

**Key files**:

- `src/common/ai/observability/telemetry.ts` - Telemetry context helpers and trace management
- `src/common/ai/observability/langfuse.config.ts` - Langfuse span processor configuration
- `src/common/ai/observability/instrumentation.ts` - OpenTelemetry SDK initialization
- `src/modules/chat/chat.service.ts` - Chat service with trace creation and updates

**Core Telemetry Utilities**:

The `telemetry.ts` module provides key functions for managing LLM observability:

1. **`getLangfuseClient()`** - Returns singleton Langfuse client instance
   - Initialized with credentials from environment variables
   - Returns `null` if Langfuse is disabled or not configured

2. **`createTelemetryConfig(context)`** - Creates `experimental_telemetry` config for AI SDK calls
   - Enables OpenTelemetry tracing with Langfuse-specific metadata
   - Adds tags and metadata for session tracking, filtering, and analysis

3. **`createChatTelemetryContext(params)`** - Creates full telemetry context for chat operations
   - Includes conversation ID, user ID, mode, page context, operation type, and parent trace ID
   - Used for classification, chat responses, and summarization

4. **`createMinimalTelemetryContext(params)`** - Creates minimal context for operations without full chat context
   - Used for title generation which happens before conversation is fully established
   - Includes only conversation ID, user ID, operation type, and parent trace ID

5. **`createConversationTrace(context, traceId, input)`** - Creates parent Langfuse trace for a chat interaction
   - Groups all LLM operations (classification, chat, summarization) for a single user message
   - Includes input, metadata, tags, and session/user tracking

**LLM Operation Types**:

The `LLMOperationType` enum identifies different LLM operations for telemetry:

- `TITLE_GENERATION` - Conversation title generation (uses minimal context)
- `CLASSIFICATION` - Intent and scope classification
- `CHAT_RESPONSE` - Main chat response with tool calls
- `SUMMARIZATION` - Conversation summarization

**Trace Structure**:

Each user message creates a parent Langfuse trace named `chat-interaction` that groups all operations:

1. **Classification** - Intent classification span (out-of-scope/out-of-page-scope detection)
2. **Chat Response** - Main LLM response span (with tool calls if applicable)
3. **Summarization** - Optional summarization span (when token threshold reached)
4. **Title Generation** - Optional title generation span (for new conversations)

The parent trace includes:

- **Input**: User message
- **Output**: Assistant response, or refusal message
- **Metadata**: Service info, environment, mode, page context, operation type
- **Tags**: Filterable tags for mode, page type, operation, environment, etc.
- **Session ID**: Conversation ID to group all messages in a conversation
- **User ID**: Authenticated user from JWT for user-level analytics

#### Metadata Filtering

To reduce verbosity in Langfuse traces, the system automatically filters verbose OTEL metadata before export:

1. **Resource attributes**: Removes `process.*` and `host.*` attributes (e.g., `process.pid`, `host.arch`)
2. **Tools array**: Completely removes the `tools` key from span attributes

**Configuration:**

```env
LANGFUSE_FILTER_VERBOSE_METADATA=true  # Enable filtering (default: true)
```

**Filtered resource attributes:**

- `process.pid`, `process.runtime.name`, `process.command`, `process.executable.path`
- `host.name`, `host.arch`, `host.type`

**Preserved attributes:**

- `service.name`, `service.version`
- `telemetry.sdk.name`, `telemetry.sdk.version`
- All custom attributes from `createTelemetryConfig()`

**Tools filtering:**

- **Before**: Full tools array with Zod schemas, input/output types, execute functions
- **After**: Tools key completely removed from spans

**Key files:**

- `src/common/ai/observability/attribute-filters.ts` - Filtering utilities
- `src/common/ai/observability/filtering-span-processor.ts` - Span processor wrapper
- `src/common/ai/observability/langfuse.config.ts` - Integration point

**Impact:** 30-50% reduction in span payload size, cleaner traces in Langfuse dashboard

## Testing Patterns

- **Unit tests**: Mock `PaystackApiService` and test business logic
- **Integration tests**: Test full service interactions with mocked HTTP
- **E2E tests**: Full request/response cycles with test database
- Test files follow `*.spec.ts` convention
- All new tools must have comprehensive tests in `tools/*-tools.spec.ts`

## Commit Conventions

Uses Conventional Commits with commitlint:

```text
feat(scope): description
fix(scope): description
docs(scope): description
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Common Pitfalls

- **Don't create separate HTTP instances**: Always import `PaystackModule` for Paystack API access
- **Don't skip page context validation**: Page-scoped conversations must validate context on every message
- **Don't forget JWT passthrough**: All Paystack API calls must use the user's JWT token
- **Don't exceed 30-day date ranges**: Chart and data retrieval tools have 30-day validation
- **Don't modify conversation mode**: Global conversations cannot become page-scoped and vice versa
- **Don't bypass tool filtering**: Page-scoped mode must filter tools via `filterToolsForPageContext()`
