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
```

### Optional Variables

These variables have sensible defaults but can be customized:

```env
# Paystack API
PAYSTACK_API_BASE_URL=https://studio-api.paystack.co

# Rate Limiting
MESSAGE_LIMIT=100              # Maximum messages per user per period (default: 100)
RATE_LIMIT_PERIOD_HOURS=24     # Sliding window period in hours (default: 24)
MESSAGE_HISTORY_LIMIT=40       # Number of past messages kept in AI context (default: 40)
CONVERSATION_TTL_DAYS=3        # Days of inactivity before auto-deletion via TTL indexes (default: 3)

# Conversation Summarization
SUMMARIZATION_THRESHOLD=20     # User messages before triggering summarization (default: 20)
MAX_SUMMARIES=2                # Maximum summaries per conversation before closing (default: 2)

# Logging
LOG_LEVEL=info
USE_JSON_LOGGER=true
DEBUG=false

# OpenTelemetry
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console

# Langfuse AI Observability (Optional)
LANGFUSE_ENABLED=false                              # Enable Langfuse observability
LANGFUSE_SECRET_KEY=                                # Required if enabled (starts with sk-lf-)
LANGFUSE_PUBLIC_KEY=                                # Required if enabled (starts with pk-lf-)
LANGFUSE_BASE_URL=https://cloud.langfuse.com        # Cloud EU (default), US, or self-hosted
LANGFUSE_FLUSH_INTERVAL=5000                        # Flush interval in milliseconds
LANGFUSE_FLUSH_AT=15                                # Batch size before auto-flush
LANGFUSE_REQUEST_TIMEOUT=10000                      # Request timeout in milliseconds
LANGFUSE_SAMPLE_RATE=1.0                            # Sampling rate (0.0-1.0, default: 1.0)
```

### Variable Reference

| Variable                   | Required | Default                          | Description                               |
| -------------------------- | -------- | -------------------------------- | ----------------------------------------- |
| `DATABASE_HOST`            | Yes      | -                                | MongoDB host                              |
| `DATABASE_USERNAME`        | Yes      | -                                | MongoDB username                          |
| `DATABASE_PASSWORD`        | Yes      | -                                | MongoDB password                          |
| `DATABASE_NAME`            | Yes      | -                                | Database name                             |
| `OPENAI_API_KEY`           | Yes      | -                                | OpenAI API key (starts with `sk-`)        |
| `JWT_SECRET`               | Yes      | -                                | Secret for JWT signing                    |
| `JWT_EXPIRES_IN`           | No       | `24h`                            | JWT expiration time                       |
| `NODE_ENV`                 | No       | `development`                    | Environment mode                          |
| `APP_NAME`                 | No       | `command-centre-api`             | Application name                          |
| `APP_VERSION`              | No       | `1.0.0`                          | Application version                       |
| `PAYSTACK_API_BASE_URL`    | No       | `https://studio-api.paystack.co` | Paystack API base URL                     |
| `MESSAGE_LIMIT`            | No       | `100`                            | Rate limit message count                  |
| `RATE_LIMIT_PERIOD_HOURS`  | No       | `24`                             | Rate limit time window                    |
| `MESSAGE_HISTORY_LIMIT`    | No       | `40`                             | AI context message limit                  |
| `CONVERSATION_TTL_DAYS`    | No       | `3`                              | Inactivity days before auto-deletion      |
| `SUMMARIZATION_THRESHOLD`  | No       | `20`                             | User messages before summarization        |
| `MAX_SUMMARIES`            | No       | `2`                              | Max summaries before conversation close   |
| `LOG_LEVEL`                | No       | `info`                           | Logging verbosity                         |
| `OTEL_SERVICE_NAME`        | No       | `command-centre-api`             | OpenTelemetry service name                |
| `LANGFUSE_ENABLED`         | No       | `false`                          | Enable Langfuse AI observability          |
| `LANGFUSE_SECRET_KEY`      | No\*     | -                                | Langfuse secret key (required if enabled) |
| `LANGFUSE_PUBLIC_KEY`      | No\*     | -                                | Langfuse public key (required if enabled) |
| `LANGFUSE_BASE_URL`        | No       | `https://cloud.langfuse.com`     | Langfuse instance URL                     |
| `LANGFUSE_FLUSH_INTERVAL`  | No       | `5000`                           | Flush interval in milliseconds            |
| `LANGFUSE_FLUSH_AT`        | No       | `15`                             | Batch size before auto-flush              |
| `LANGFUSE_REQUEST_TIMEOUT` | No       | `10000`                          | Request timeout in milliseconds           |
| `LANGFUSE_SAMPLE_RATE`     | No       | `1.0`                            | Sampling rate (0.0-1.0)                   |

\*Required when `LANGFUSE_ENABLED=true`

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

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console

# Langfuse (optional - typically disabled in local dev)
LANGFUSE_ENABLED=false
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

# Langfuse (recommended for production observability)
LANGFUSE_ENABLED=true
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # or https://us.cloud.langfuse.com or self-hosted URL
LANGFUSE_SAMPLE_RATE=1.0  # Start with 0.1 for gradual rollout
```

### Testing

In test/e2e environments, `.env` files are ignored to allow programmatic config overrides.

```env
NODE_ENV=test
LOG_LEVEL=error
METRICS_ENABLED=false
TRACING_ENABLED=false

# Langfuse (always disabled in tests)
LANGFUSE_ENABLED=false
```

## Security Recommendations

1. **Never commit** `.env` files to version control
2. **Use strong secrets** for `JWT_SECRET` in production
3. **Rotate API keys** regularly
4. **Use different credentials** for each environment
5. **Validate API keys** start with expected prefixes (`sk-` for OpenAI)
