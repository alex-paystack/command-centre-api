# Command Centre API

Paystack-aware, AI-powered merchant dashboard API built with NestJS, MongoDB, and OpenAI

## 📖 Overview

Command Centre API is a NestJS-based backend service that powers an AI-driven merchant dashboard. It provides intelligent chat capabilities, conversation management, and AI-powered features to help merchants interact with their data and systems through natural language.

### Key Features

- 🤖 **AI-Powered Chat**: Streaming GPT-4o-mini responses with live reasoning
- 🔒 **JWT-Protected & User-Scoped**: All `/chat` endpoints require Bearer tokens; Paystack calls reuse the user's JWT
- 💬 **Page-Scoped Conversations**: Full CRUD with `pageKey` support so each surface keeps its own thread list
- 🛠️ **Paystack Tooling**: Built-in tools for transactions, customers, refunds, payouts, disputes, and chart data (30-day max range)
- 📊 **Analytics & Charts**: Multi-currency aggregation by day/hour/week/month/status; Recharts-ready output and streaming progress
- 🧭 **Guardrails & Classification**: Conversation-history classifier enforces in-scope policy and graceful refusals
- 🎯 **Smart Title Generation**: Automatic titles from the first message
- 🔄 **Real-time Streaming**: Server-sent events with capped history (default last 40 messages)
- 🛡️ **Rate Limiting**: Configurable message entitlement with sliding window enforcement

## 🚀 Quick Start

### Prerequisites

- Node.js v24.5.0
- pnpm v10.14.0
- MongoDB instance
- OpenAI API key

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd command-centre-api
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   ```env
   # Database
   DATABASE_HOST=mongodb
   DATABASE_USERNAME=root
   DATABASE_PASSWORD=root
   DATABASE_NAME=command-centre-api

   # OpenAI
   OPENAI_API_KEY=sk-your-openai-api-key

   # Rate Limiting (Optional)
   MESSAGE_LIMIT=100
   RATE_LIMIT_PERIOD_HOURS=24

   # Service
   NODE_ENV=development
   OTEL_SERVICE_NAME=command-centre-api
   ```

4. **Start the development server**

   ```bash
   pnpm run start:dev
   ```

The API will be available at `http://localhost:3000`

## 🔐 Authentication

All `/chat` routes are protected by JWT Bearer auth. Include `Authorization: Bearer <token>` in every request. The token must contain an `id` claim (user ID). See `AUTHENTICATION.md` for full details and testing tips.

## 🏗️ Architecture

### Project Structure

```md
src/
├── common/
│ ├── ai/ # AI utilities and integrations
│ │ ├── actions.ts # AI action functions (title generation)
│ │ ├── prompts.ts # AI system prompts
│ │ ├── tools.ts # AI tools definitions
│ │ ├── utils.ts # Helper functions for AI
│ │ └── index.ts
│ ├── exceptions/ # Custom exceptions and filters
│ └── helpers/ # Shared utilities
├── config/ # Configuration modules
├── database/
│ ├── migrations/ # TypeORM migrations
│ └── database.module.ts
├── modules/
│ ├── chat/ # Chat & conversation module
│ │ ├── dto/ # Data transfer objects
│ │ ├── entities/ # TypeORM entities
│ │ ├── repositories/ # Database repositories
│ │ ├── chat.controller.ts
│ │ ├── chat.service.ts
│ │ └── chat.module.ts
│ └── health/ # Health check endpoints
├── app.module.ts # Root module
└── main.ts # Application entry point
```

### Technology Stack

- **Framework**: NestJS v11
- **Database**: MongoDB with TypeORM
- **AI**: Vercel AI SDK with OpenAI
- **Language**: TypeScript v5.7
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Observability**: @paystackhq/nestjs-observability (metrics/logs/traces)

## 🤖 AI Features

### Chat Streaming

The API provides real-time AI chat capabilities with streaming responses:

```typescript
POST /chat/stream
Content-Type: application/json

{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "How do I integrate the payment API?"
      }
    ]
  }
}
```

**Features:**

- Streams AI responses in real-time using UIMessageStream format
- Includes reasoning steps in the response
- Automatically generates conversation titles for new conversations
- Maintains full conversation history context (last 40 messages by default)
- Supports AI tools for dynamic actions
- Requires `pageKey` when starting a new conversation via stream (keeps threads scoped per page/surface)

### Paystack Tools & Data Scope

The assistant can only operate on merchant data exposed by these tools (all requests reuse the caller's JWT):

- `getTransactions` – filter by status, channel, customer, date (max 30-day window)
- `getCustomers` – list/search customers with pagination
- `getRefunds` – status/date/amount filters
- `getPayouts` – payout lookup with status/date filters
- `getDisputes` – dispute lookup with status/date filters
- `generateChartData` – streams Recharts-ready data for trends and breakdowns

All date filters are limited to 30 days; helper validation returns clear errors when exceeded.

### Charting & Aggregation

- Aggregations: by day, hour, week, month, or status
- Outputs include count, volume, average, per-currency summaries, suggested chart type
- Streams progress while fetching up to 500 transactions (5 pages × 100)

### Guardrails & Classification

- Classifier runs on conversation history to keep answers in-scope (dashboard insights, Paystack FAQs, account help, assistant capabilities)
- Out-of-scope requests return a refusal message from policy
- System prompt injects current date to handle relative time phrases accurately

### Extending Tools

To add a new AI tool, create it in `src/common/ai/tools.ts` with `tool({ description, inputSchema, execute })`, then export it from `createTools`. Keep inputs validated with `zod` and ensure execution uses the caller's JWT for Paystack API access.

### Automatic Title Generation

When a new conversation starts, the first message automatically generates a descriptive title using GPT-3.5-turbo:

```typescript
import { generateConversationTitle } from './common/ai';

const title = await generateConversationTitle(message);
// Returns: "Payment API Integration" (or similar)
```

## 📡 API Endpoints

### Chat Module

All `/chat` endpoints require `Authorization: Bearer <jwt>` and use the authenticated user's ID.

#### Stream AI Chat

```http
POST /chat/stream
```

Streams AI responses for a conversation.

**Request Body:**

```json
{
  "conversationId": "uuid",
  "pageKey": "dashboard/payments",
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "Your message" }]
  }
}
```

**Response:** Server-sent events stream with UIMessage format

**Error Responses:**

- `429 Too Many Requests` - Rate limit exceeded

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

#### Create Conversation

```http
POST /chat/conversations
```

Creates a new conversation.

**Request Body:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "pageKey": "dashboard/payments"
}
```

#### Get Conversation

```http
GET /chat/conversations/:id
```

Retrieves a conversation by ID.

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "userId": "user_123",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get User Conversations

```http
GET /chat/conversations
```

Retrieves all conversations for the authenticated user.

**Query Params (optional):**

- `pageKey` — when provided, only conversations for that surface are returned

#### Delete Conversation

```http
DELETE /chat/conversations/:id
```

Deletes a conversation and all its messages.

#### Delete All Conversations

```http
DELETE /chat/conversations
```

Deletes every conversation for the authenticated user.

#### Create Message

```http
POST /chat/messages
```

Manually creates a message in a conversation.

**Request Body:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "parts": [{ "type": "text", "text": "How do I integrate payments?" }]
}
```

#### Get Messages

```http
GET /chat/messages/:conversationId
```

Retrieves all messages in a conversation.

### Health Check

```http
GET /health
```

Returns application health status. This endpoint is public (no authentication required).

## 🗄️ Database

### MongoDB Collections

#### Conversations

```typescript
{
  _id: ObjectId,
  id: string,           // UUID
  title: string,
  userId: string,
  createdAt: Date
}
```

#### Messages

```typescript
{
  _id: ObjectId,
  id: string,           // UUID
  conversationId: string,       // Reference to conversation
  role: 'user' | 'assistant',
  parts: {              // Flexible JSON for multi-modal content
    text?: string,
    // ... other content types
  },
  createdAt: Date
}
```

### Running Migrations

```bash
# Create a new migration
pnpm run migration:create

# Generate migration from entities
pnpm run migration:generate

# Run migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

## 🛡️ Rate Limiting

The API implements a sliding window rate limiting mechanism to prevent abuse and ensure fair usage across all users.

### How It Works

- **Sliding Window**: The rate limit uses a sliding time window, not a fixed period
- **User-Based**: Limits are applied per user ID
- **Message Count**: Only user messages count toward the limit (assistant responses are excluded)
- **Automatic Enforcement**: Rate limiting is checked before processing any streaming chat request

### Configuration

Rate limiting is controlled via environment variables:

```env
MESSAGE_LIMIT=100              # Maximum messages allowed per period (default: 100)
RATE_LIMIT_PERIOD_HOURS=24    # Time window in hours (default: 24)
```

### Example Scenarios

**Scenario 1: Within Limits**

- User sends 50 messages in 12 hours
- User can still send 50 more messages before hitting the limit

**Scenario 2: Limit Exceeded**

- User sends 100 messages in 24 hours
- Next request returns HTTP 429 with details:
  - Current count
  - Time period
  - Maximum allowed

**Scenario 3: Sliding Window**

- User sends 100 messages starting at 12:00 PM on Day 1
- At 1:00 PM on Day 2 (25 hours later), messages from 12:00 PM on Day 1 have expired
- User can send new messages as the oldest ones drop out of the 24-hour window

### Error Response

When rate limit is exceeded, the API returns:

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

The rate limiting is implemented at the service layer with the following components:

- **Exception**: `RateLimitExceededException` - Custom HTTP 429 exception
- **Repository Method**: `countUserMessagesInPeriod()` - Counts user messages within time window
- **Service Method**: `checkUserEntitlement()` - Validates user against limits
- **Integration**: Automatic check in `handleStreamingChat()` before processing requests

## 🔧 Available Scripts

```bash
# Development
pnpm run start:dev      # Start with hot reload
pnpm run start:debug    # Start with debugger
pnpm run start:prod     # Start production server

# Building
pnpm run build          # Build the application

# Testing
pnpm run test           # Run unit tests
pnpm run test:watch     # Run tests in watch mode
pnpm run test:cov       # Run tests with coverage
pnpm run test:e2e       # Run end-to-end tests

# Code Quality
pnpm run lint           # Run ESLint and fix issues
pnpm run lint:check     # Check without fixing
pnpm run format         # Format code with Prettier
pnpm run format:check   # Check formatting

# Database
pnpm run migration:create   # Create new migration
pnpm run migration:run      # Run pending migrations
pnpm run migration:revert   # Revert last migration
```

## 🧪 Testing

The project includes comprehensive test coverage:

### Unit Tests

```bash
pnpm run test           # Run all unit tests
pnpm run test:cov       # Run with coverage report
```

### E2E Tests

```bash
pnpm run test:e2e       # Run end-to-end tests
```

### Test Files

- `chat.controller.spec.ts` - Controller tests
- `chat.service.spec.ts` - Service layer tests
- Each module includes its own test suite

## 🔒 Environment Configuration

### Required Variables

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

```env
# Paystack API
PAYSTACK_API_BASE_URL=https://studio-api.paystack.co

# Rate Limiting
MESSAGE_LIMIT=100
RATE_LIMIT_PERIOD_HOURS=24
MESSAGE_HISTORY_LIMIT=40  # Number of past messages kept in context (default: 40)

# Logging
LOG_LEVEL=info
USE_JSON_LOGGER=true
DEBUG=false

# OpenTelemetry
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console
```

See `.env.example` for the complete list of available environment variables.

## 🐳 Docker Support

### Development with Docker

```bash
# Start supporting services (MongoDB, etc.)
docker-compose up -d

# Run the application locally
pnpm run start:dev
```

### Production Build

```bash
# Build Docker image
docker build -t command-centre-api .

# Run container
docker run -p 3000:3000 --env-file .env command-centre-api
```

## 📊 API Documentation

When the application is running, visit:

- **Swagger UI**: `http://localhost:3000/swagger`
- **OpenAPI JSON**: `http://localhost:3000/swagger-json`

The Swagger documentation provides:

- Interactive API testing
- Request/response schemas
- Authentication details
- Example payloads

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB connection
- [ ] Set secure `OPENAI_API_KEY`
- [ ] Configure proper logging (OTLP exporters)
- [ ] Set up monitoring and alerting
- [ ] Configure SSL/TLS certificates
- [ ] Set up backup strategies for MongoDB
- [ ] Configure rate limiting
- [ ] Review and secure all environment variables

### CI/CD

The project includes GitHub Actions workflows for:

- Linting and formatting checks
- Running test suites
- Building Docker images
- Security vulnerability scanning

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow the existing ESLint configuration
- Use Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 🔧 Troubleshooting

### OpenAI API Errors

**"OPENAI_API_KEY is not configured"**

- Ensure `OPENAI_API_KEY` is set in your `.env` file
- Verify the API key is valid and has credits

### Database Connection Issues

**"Cannot connect to MongoDB"**

- Verify MongoDB is running: `docker ps`
- Check connection string in `.env`
- Ensure database credentials are correct

### Build Errors

**"Module not found"**

- Run `pnpm install` to ensure all dependencies are installed
- Clear build cache: `rm -rf dist && pnpm run build`

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [TypeORM Documentation](https://typeorm.io/)
