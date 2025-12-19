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

Conversations follow a lifecycle with automatic summarization:

1. **Active Phase**: Up to `SUMMARIZATION_THRESHOLD` (default: 20) user messages
2. **First Summary**: Generated after threshold, conversation continues
3. **Second Summary**: Generated after another threshold, conversation closes
4. **Continuation**: User can create new conversation via `/conversations/from-summary` with carried-over context

**Configuration**:

- `SUMMARIZATION_THRESHOLD=20` - Messages before triggering summary
- `MAX_SUMMARIES=2` - Summaries before closing conversation
- `MESSAGE_HISTORY_LIMIT=40` - Messages kept in AI context

### Request Flow & Authentication

All `/chat/*` and `/charts/*` endpoints require JWT authentication:

1. **JwtAuthGuard** (global) validates Bearer token
2. **@CurrentUser()** decorator extracts user ID from token claims
3. **PaystackApiService** reuses the user's JWT for all Paystack API calls (JWT passthrough)
4. **Rate limiting** enforced per user based on `MESSAGE_LIMIT` and `RATE_LIMIT_PERIOD_HOURS`

### Chart Aggregation System

Charts are generated via `src/common/ai/aggregation.ts` with resource-specific configurations in `chart-config.ts`:

- **Time-based**: `by-day`, `by-hour`, `by-week`, `by-month` (returns per-currency series)
- **Categorical**: `by-status`, `by-channel`, `by-type`, `by-category`, `by-resolution` (returns flat data)
- **Resource-specific configs** define field accessors (`getAmount`, `getCurrency`, `getStatus`, etc.)
- **Centralized validation**: `chart-validation.ts` provides shared validation for chart parameters
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

1. Add to `ChartResourceType` enum in `chart-config.ts`
2. Define `ResourceFieldConfig` with field accessors (including optional model-specific fields like `getChannel`)
3. Update `VALID_AGGREGATIONS` map
4. Update `STATUS_VALUES` map
5. Add to `API_ENDPOINTS` map
6. Update `getFieldConfig()` function
7. Update `chart-validation.ts` if adding resource-specific validation rules
8. If adding categorical aggregations, update `getChartType()` in `aggregation.ts`

### Adding a Page Context Resource Type

1. Add to `PageContextType` enum in `types/index.ts`
2. Implement fetching in `PageContextService.fetchResourceData()`
3. Add formatting in `PageContextService.formatResourceData()`
4. Update `RESOURCE_TOOL_MAP` in `tools/index.ts`
5. Add TypeScript interface in `types/index.ts`

### Using Chart Validation

The `chart-validation.ts` module provides centralized validation for chart parameters. Use `validateChartParams()` when:

- Creating new saved charts (`SavedChartService.saveChart()`)
- Regenerating charts with overrides (`SavedChartService.getSavedChartWithData()`)
- Implementing new chart-related features

**Example**:

```typescript
import { validateChartParams } from '~/common/ai/chart-validation';

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

## Testing Patterns

- **Unit tests**: Mock `PaystackApiService` and test business logic
- **Integration tests**: Test full service interactions with mocked HTTP
- **E2E tests**: Full request/response cycles with test database
- Test files follow `*.spec.ts` convention
- All new tools must have comprehensive tests in `tools/*-tools.spec.ts`

## Commit Conventions

Uses Conventional Commits with commitlint:

```
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
