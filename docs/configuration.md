# Configuration

This document covers environment variables and rate limiting configuration.

## Environment Variables

### Required Variables

These variables must be set for the application to run:

```env
# Database Configuration
DATABASE_HOST=mongodb
DATABASE_USERNAME=root
DATABASE_PASSWORD=root
DATABASE_NAME=command-centre-api

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# JWT Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Service Configuration
NODE_ENV=development
APP_NAME=command-centre-api
APP_VERSION=1.0.0
OTEL_SERVICE_NAME=command-centre-api
OTEL_SERVICE_VERSION=1.0.0
OTEL_SERVICE_ENV=local
```

### Optional Variables

These variables have sensible defaults but can be customized:

```env
# Redis Cache (for chart data caching)
REDIS_READ_URL=redis://redis:6379      # Redis read connection URL
REDIS_WRITE_URL=redis://redis:6379     # Redis write connection URL
REDIS_USERNAME=                         # Redis username (leave empty for no auth)
REDIS_PASSWORD=                         # Redis password (leave empty for no auth)
REDIS_DB=0                              # Redis database number (default: 0)
CACHE_TTL=10800000                      # Cache TTL in milliseconds (default: 3 hours)

# Paystack API
PAYSTACK_API_BASE_URL=https://studio-api.paystack.co

# Rate Limiting
MESSAGE_LIMIT=100              # Maximum messages per user per period (default: 100)
RATE_LIMIT_PERIOD_HOURS=24     # Sliding window period in hours (default: 24)
MESSAGE_HISTORY_LIMIT=40       # Number of past messages kept in AI context (default: 40)
CONVERSATION_TTL_DAYS=3        # Days of inactivity before auto-deletion via TTL indexes (default: 3)

# Conversation Summarization
MAX_SUMMARIES=2                     # Maximum summaries per conversation before closing (default: 2)
CONTEXT_WINDOW_SIZE=128000          # Model context window in tokens (default: 128000 for gpt-4o-mini)
TOKEN_THRESHOLD_PERCENTAGE=0.6      # Trigger summarization at 60% of context window (default: 0.6)

# Logging
LOG_LEVEL=info
USE_JSON_LOGGER=true
DEBUG=false

# OpenTelemetry
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console
```

### Langfuse LLM Observability (Optional)

For LLM observability and tracing via Langfuse:

```env
# Service Identification (Required for proper trace attribution)
OTEL_SERVICE_NAME=command-centre-api              # Service name for traces
OTEL_SERVICE_VERSION=1.0.0                        # Service version for release tracking
OTEL_SERVICE_ENV=production                       # Environment (local/staging/production)

# Langfuse Configuration
LANGFUSE_ENABLED=true                             # Enable Langfuse observability (default: false)
LANGFUSE_PUBLIC_KEY=pk-lf-...                     # Langfuse public key
LANGFUSE_SECRET_KEY=sk-lf-...                     # Langfuse secret key
LANGFUSE_BASE_URL=https://cloud.langfuse.com      # Langfuse API URL (defaults to cloud)

# Span Processor Hook (enables Langfuse integration)
OTEL_SPAN_PROCESSORS_PATH=./dist/common/ai/observability/langfuse.config.js

# Performance Tuning (Optional)
LANGFUSE_FLUSH_INTERVAL=5000                      # Flush interval in milliseconds (default: 5000)
LANGFUSE_FLUSH_AT=15                              # Flush after N spans (default: 15)

# Metadata Filtering (Optional)
LANGFUSE_FILTER_VERBOSE_METADATA=true             # Filter verbose OTEL metadata (default: true)
```

**Service Identification Variables:**

- **`OTEL_SERVICE_NAME`**: Identifies the service in Langfuse traces and tags (e.g., `service:command-centre-api`)
- **`OTEL_SERVICE_VERSION`**: Tracks release version for filtering and analysis (e.g., `version:1.0.0`)
- **`OTEL_SERVICE_ENV`**: Identifies deployment environment (e.g., `env:production`, `env:staging`, `env:local`)

These variables are used for:

- Langfuse client initialization (`release` and `environment` fields)
- Trace metadata (`service`, `environment`, `version`)
- Filterable tags for analysis and debugging

When configured, all LLM calls are traced to Langfuse with:

- **Parent traces**: Each chat interaction creates a named trace with input/output
- **Session tracking**: Conversation ID groups all LLM calls in a conversation
- **User identification**: User ID from JWT authentication
- **Metadata**: Mode, page context, service (`OTEL_SERVICE_NAME`), environment (`OTEL_SERVICE_ENV`), version (`OTEL_SERVICE_VERSION`)
- **Tags**: Filterable tags like `service:command-centre-api`, `version:1.0.0`, `env:production`, `mode:global`, `page:transaction`
- **Span filtering**: Only AI-related spans are exported (excludes HTTP, DB, infrastructure spans)
- **Metadata filtering**: Removes verbose resource attributes (`process.*`, `host.*`) and tools arrays from spans (30-50% size reduction)
- **Batching**: Configurable span batching for performance optimization

**Trace Structure**: Each user message creates a parent trace named `chat-interaction` that groups all operations:

1. **Classification** - Intent classification span (out-of-scope/out-of-page-scope detection)
2. **Chat Response** - Main LLM response span (with tool calls if applicable)
3. **Summarization** - Optional summarization span (when token threshold reached)
4. **Title Generation** - Optional title generation span (for new conversations)

The parent trace includes:

- **Input**: User message
- **Output**: Assistant response, or refusal message

**Performance Tuning:**

- `LANGFUSE_FLUSH_INTERVAL`: Controls how frequently spans are sent to Langfuse. Lower values provide faster visibility but increase network overhead. Recommended: 5000ms for production, 1000ms for development.
- `LANGFUSE_FLUSH_AT`: Number of spans to accumulate before forcing a flush. Lower values reduce memory usage but increase API calls. Recommended: 15 for balanced performance.

**Metadata Filtering:**

- `LANGFUSE_FILTER_VERBOSE_METADATA`: Automatically filters verbose OpenTelemetry metadata from spans before export (default: `true`). When enabled:
  - **Resource attributes**: Removes `process.*` (PID, runtime, command) and `host.*` (hostname, architecture) attributes
  - **Tools arrays**: Completely removes tools keys from span attributes (strips full Zod schemas)
  - **Impact**: 30-50% reduction in span payload size, cleaner traces in Langfuse
  - **Preserved data**: Service name, SDK info, custom telemetry metadata, and all business logic attributes remain intact

### Variable Reference

| Variable                           | Required | Default                          | Description                               |
| ---------------------------------- | -------- | -------------------------------- | ----------------------------------------- |
| `DATABASE_HOST`                    | Yes      | -                                | MongoDB host                              |
| `DATABASE_USERNAME`                | Yes      | -                                | MongoDB username                          |
| `DATABASE_PASSWORD`                | Yes      | -                                | MongoDB password                          |
| `DATABASE_NAME`                    | Yes      | -                                | Database name                             |
| `OPENAI_API_KEY`                   | Yes      | -                                | OpenAI API key (starts with `sk-`)        |
| `JWT_SECRET`                       | Yes      | -                                | Secret for JWT signing                    |
| `JWT_EXPIRES_IN`                   | No       | `24h`                            | JWT expiration time                       |
| `NODE_ENV`                         | No       | `development`                    | Environment mode                          |
| `APP_NAME`                         | No       | `command-centre-api`             | Application name                          |
| `APP_VERSION`                      | No       | `1.0.0`                          | Application version                       |
| `REDIS_READ_URL`                   | No       | `redis://localhost:6379`         | Redis read connection URL                 |
| `REDIS_WRITE_URL`                  | No       | `redis://localhost:6379`         | Redis write connection URL                |
| `REDIS_USERNAME`                   | No       | -                                | Redis username (optional)                 |
| `REDIS_PASSWORD`                   | No       | -                                | Redis password (optional)                 |
| `REDIS_DB`                         | No       | `0`                              | Redis database number                     |
| `CACHE_TTL`                        | No       | `10800000`                       | Cache TTL in milliseconds (3 hours)       |
| `PAYSTACK_API_BASE_URL`            | No       | `https://studio-api.paystack.co` | Paystack API base URL                     |
| `MESSAGE_LIMIT`                    | No       | `100`                            | Rate limit message count                  |
| `RATE_LIMIT_PERIOD_HOURS`          | No       | `24`                             | Rate limit time window                    |
| `MESSAGE_HISTORY_LIMIT`            | No       | `40`                             | AI context message limit                  |
| `CONVERSATION_TTL_DAYS`            | No       | `3`                              | Inactivity days before auto-deletion      |
| `MAX_SUMMARIES`                    | No       | `2`                              | Max summaries before conversation close   |
| `CONTEXT_WINDOW_SIZE`              | No       | `128000`                         | Model context window in tokens            |
| `TOKEN_THRESHOLD_PERCENTAGE`       | No       | `0.6`                            | Percentage (0-1) triggering summarization |
| `LOG_LEVEL`                        | No       | `info`                           | Logging verbosity                         |
| `OTEL_SERVICE_NAME`                | No       | `command-centre-api`             | OpenTelemetry service name                |
| `OTEL_SERVICE_VERSION`             | No       | `1.0.0`                          | Service version for traces and tags       |
| `OTEL_SERVICE_ENV`                 | No       | `local`                          | Environment name (local/staging/prod)     |
| `LANGFUSE_ENABLED`                 | No       | `false`                          | Enable Langfuse LLM observability         |
| `LANGFUSE_PUBLIC_KEY`              | No       | -                                | Langfuse public key for LLM observability |
| `LANGFUSE_SECRET_KEY`              | No       | -                                | Langfuse secret key for LLM observability |
| `LANGFUSE_BASE_URL`                | No       | `https://cloud.langfuse.com`     | Langfuse API base URL                     |
| `LANGFUSE_FLUSH_INTERVAL`          | No       | `5000`                           | Flush interval in milliseconds            |
| `LANGFUSE_FLUSH_AT`                | No       | `15`                             | Flush after N spans                       |
| `LANGFUSE_FILTER_VERBOSE_METADATA` | No       | `true`                           | Filter verbose OTEL metadata from spans   |
| `OTEL_SPAN_PROCESSORS_PATH`        | No       | -                                | Path to custom span processors hook file  |

## Redis Cache Configuration

The API uses Redis for caching chart data to improve performance when users request the same chart with unchanged parameters. Caching is implemented with graceful degradation - if Redis is unavailable, chart generation continues to work normally.

### Cache Strategy

- **Scope**: Only saved charts (GET /charts/:id endpoint)
- **TTL**: 3 hours (10,800,000 milliseconds)
- **Cache Keys**: SHA-256 hash of chart parameters for deterministic, collision-free keys
- **Parameter Handling**: Separate cache entries for each parameter combination (resourceType, aggregationType, date range, filters)
- **Fire-and-Forget Writes**: Cache writes don't block responses
- **Graceful Degradation**: Cache failures are logged but don't break chart generation

### Configuration

```env
REDIS_READ_URL=redis://redis:6379      # Redis read connection (Docker service name or hostname)
REDIS_WRITE_URL=redis://redis:6379     # Redis write connection
REDIS_USERNAME=                         # Authentication username (optional)
REDIS_PASSWORD=                         # Authentication password (optional)
REDIS_DB=0                              # Database number (0-15)
CACHE_TTL=10800000                      # Cache TTL in milliseconds (3 hours = 10,800,000ms)
```

### Performance Impact

**Without Cache:**

- Chart generation time: 2-5 seconds
- API calls: Up to 10 requests (1000 records from Paystack API)
- Processing: Full aggregation and summary calculation

**With Cache (cache hit):**

- Response time: <100ms
- API calls: 0 (served from Redis)
- Processing: None (pre-computed data)

**Expected Cache Hit Rates:**

- Initial (first week): 30-40%
- Mature (steady state): 60-70%

### Environment-Specific Configuration

**Development (Docker Compose):**

```env
REDIS_READ_URL=redis://redis:6379
REDIS_WRITE_URL=redis://redis:6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
```

**Production (Managed Redis):**

```env
REDIS_READ_URL=rediss://production-redis-read.example.com:6379
REDIS_WRITE_URL=rediss://production-redis-write.example.com:6379
REDIS_USERNAME=production-user
REDIS_PASSWORD=super-secure-password
REDIS_DB=0
CACHE_TTL=10800000  # Can be adjusted based on data freshness requirements
```

**Production Notes:**

- Use managed Redis service (AWS ElastiCache, Redis Cloud, Azure Cache for Redis)
- Enable TLS with `rediss://` protocol
- Set strong username/password authentication
- Monitor memory usage and set appropriate limits
- Consider master-replica setup for high availability
- Configure eviction policy (LRU recommended)

### Health Checks

Redis connectivity is monitored via the `/health` endpoint:

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up", "message": "Redis connectivity is working as expected" }
  }
}
```

If Redis is down:

- Health check returns HTTP 503 (Service Unavailable)
- Chart generation continues to work (graceful degradation)
- Cache misses are logged for observability

## Rate Limiting

The API implements a sliding window rate limiting mechanism to prevent abuse and ensure fair usage.

### Mechanism

- **Sliding Window**: Uses a sliding time window, not a fixed period
- **User-Based**: Limits are applied per user ID
- **Message Count**: Only user messages count toward the limit (assistant responses are excluded)
- **Automatic Enforcement**: Rate limiting is checked before processing any streaming chat request

### Configuration

```env
MESSAGE_LIMIT=100              # Maximum messages allowed per period
RATE_LIMIT_PERIOD_HOURS=24     # Time window in hours
```

### Example Scenarios

#### Scenario 1: Within Limits

- User sends 50 messages in 12 hours
- User can still send 50 more messages before hitting the limit

#### Scenario 2: Limit Exceeded

- User sends 100 messages in 24 hours
- Next request returns HTTP 429 with details

#### Scenario 3: Sliding Window

- User sends 100 messages starting at 12:00 PM on Day 1
- At 1:00 PM on Day 2 (25 hours later), messages from 12:00 PM on Day 1 have expired
- User can send new messages as the oldest ones drop out of the 24-hour window

### Error Response

When rate limit is exceeded:

```json
{
  "status": false,
  "type": "api_error",
  "code": "rate_limited",
  "message": "Rate limit exceeded. You have sent 100 messages in the last 24 hour(s). The limit is 100 messages per 24 hour(s).",
  "data": {
    "limit": 100,
    "periodHours": 24,
    "currentCount": 100
  }
}
```

### Implementation Details

- **Exception**: `RateLimitExceededException` - Custom HTTP 429 exception
- **Repository Method**: `countUserMessagesInPeriod()` - Counts user messages within time window
- **Service Method**: `checkUserEntitlement()` - Validates user against limits
- **Integration**: Automatic check in `handleStreamingChat()` before processing requests

## Data Retention

The API automatically cleans up inactive conversations and messages using MongoDB TTL (Time-To-Live) indexes to manage storage efficiently.

### How It Works

- **Activity-Based**: Retention window extends on every new message
- **Automatic Cleanup**: MongoDB deletes expired data without application intervention
- **Coordinated Deletion**: Messages expire with their parent conversation
- **No User Action Required**: Process is transparent to users

### Retention Configuration

```env
CONVERSATION_TTL_DAYS=3  # Days of inactivity before deletion
```

### Retention Lifecycle

```text
Day 0: User sends first message
       └─> expiresAt = Day 3

Day 1: User sends another message
       └─> expiresAt = Day 4 (window extends)

Day 4: No activity for 3 days
       └─> MongoDB deletes conversation + messages
```

## Token-Based Summarization

The API uses intelligent token-based summarization to manage conversation context and prevent hitting model limits. Instead of counting messages, the system tracks actual token usage from the AI model.

### How It Works

- **Automatic Tracking**: Captures token usage from every `streamText` call via AI SDK's usage data
- **Cumulative Counter**: `totalTokensUsed` field on conversation accumulates tokens across all interactions
- **Smart Triggering**: Summarizes when reaching a percentage of the model's context window
- **Reset After Summary**: Token counter resets to 0 after each successful summarization
- **Conversation Closure**: After `MAX_SUMMARIES` summaries, conversation closes (user can continue via new conversation with carried-over context)

### Configuration

```env
CONTEXT_WINDOW_SIZE=128000          # Model's max context window (gpt-4o-mini: 128k tokens)
TOKEN_THRESHOLD_PERCENTAGE=0.6      # Trigger at 60% of context window (76,800 tokens)
MAX_SUMMARIES=2                     # Close conversation after 2 summaries
```

### Example Calculation

For `gpt-4o-mini` with default settings:

- Context window: 128,000 tokens
- Threshold: 128,000 × 0.6 = **76,800 tokens**
- First summary triggered at ~76,800 tokens
- Token counter resets to 0
- Second summary triggered at another ~76,800 tokens
- Conversation closes after 2nd summary

### Adjusting for Different Models

When switching AI models, update `CONTEXT_WINDOW_SIZE`:

```env
# GPT-4 Turbo (128k)
CONTEXT_WINDOW_SIZE=128000

# GPT-4o (128k)
CONTEXT_WINDOW_SIZE=128000

# Claude 3.5 Sonnet (200k)
CONTEXT_WINDOW_SIZE=200000

# GPT-3.5 Turbo (16k)
CONTEXT_WINDOW_SIZE=16000
```

### Token Lifecycle

```text
Conversation Start:
  └─> totalTokensUsed = 0

Turn 1: User message + AI response
  └─> totalTokensUsed = 15,000 tokens

Turn 2: User message + AI response
  └─> totalTokensUsed = 32,000 tokens

... more turns ...

Turn N: totalTokensUsed reaches 77,000 (> 76,800 threshold)
  └─> Summary #1 generated
  └─> totalTokensUsed reset to 0
  └─> summaryCount = 1

... conversation continues ...

Turn M: totalTokensUsed reaches 78,000 (> 76,800 threshold)
  └─> Summary #2 generated
  └─> totalTokensUsed reset to 0
  └─> summaryCount = 2
  └─> Conversation closed (isClosed = true)
```

### Why Token-Based?

**Advantages over message counting:**

- More accurate: Directly measures what the model sees
- Adaptive: Handles varying message lengths (short vs long messages)
- Model-aware: Respects actual context window limits
- Predictable: Prevents unexpected context overflows

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console
```

### Production

```env
NODE_ENV=production
LOG_LEVEL=info
USE_JSON_LOGGER=true
OTEL_LOGS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4318
```

### Testing

In test/e2e environments, `.env` files are ignored to allow programmatic config overrides.

```env
NODE_ENV=test
LOG_LEVEL=error
METRICS_ENABLED=false
TRACING_ENABLED=false
```

## Security Recommendations

1. **Never commit** `.env` files to version control
2. **Use strong secrets** for `JWT_SECRET` in production
3. **Rotate API keys** regularly
4. **Use different credentials** for each environment
5. **Validate API keys** start with expected prefixes (`sk-` for OpenAI)
