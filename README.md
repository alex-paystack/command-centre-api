# Command Centre API

Paystack-aware, AI-powered merchant dashboard API built with NestJS, MongoDB, and OpenAI

## 📖 Overview

Command Centre API is a NestJS-based backend service that powers an AI-driven merchant dashboard. It provides intelligent chat capabilities, conversation management, and AI-powered features to help merchants interact with their data and systems through natural language.

### Key Features

- 🤖 **AI-Powered Chat**: Streaming responses with GPT-4o-mini and GPT-3.5-turbo with live reasoning
- 🔒 **JWT-Protected & User-Scoped**: All `/chat` endpoints require Bearer tokens; Paystack calls reuse the user's JWT
- 🌍 **Dual Chat Modes**: Global mode for general dashboard queries and page-scoped mode for resource-specific conversations
- 📍 **Resource-Scoped Conversations**: Lock conversations to specific resources (transactions, customers, refunds, payouts, disputes) with context-aware AI responses
- 🛠️ **Smart Tool Filtering**: Resource-specific tools automatically provided based on context (e.g., transaction pages only get relevant tools)
- 🔍 **Context Enrichment**: Automatic fetching and formatting of resource data for enhanced AI understanding
- 📊 **Analytics & Charts**: Multi-currency aggregation by day/hour/week/month/status; Recharts-ready output and streaming progress
- 🧭 **Guardrails & Classification**: Dual-layer classification for out-of-scope and out-of-page-scope protection
- 🎯 **Smart Title Generation**: Automatic conversation titles using GPT-3.5-turbo
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

### Core Services

The application is built around several key services that work together:

#### ChatService

Orchestrates the entire conversation flow:

- Manages conversation CRUD operations
- Handles message streaming with AI
- Enforces rate limiting and user entitlement
- Coordinates message classification
- Manages conversation history with configurable limits
- Handles both global and page-scoped conversation modes

#### PaystackApiService

Provides authenticated access to Paystack APIs:

- JWT-passthrough authentication (reuses user's token)
- GET and POST request support
- Standardized error handling with `PaystackError`
- Configurable base URL for different environments
- Automatic response transformation

#### PageContextService

Enriches page-scoped conversations with resource data:

- Fetches resource details from Paystack API
- Formats resource data for AI prompt injection
- Supports all resource types (transactions, customers, refunds, payouts, disputes)
- Provides structured context for better AI understanding
- Handles resource not found errors gracefully

#### AuthService

Manages JWT authentication:

- Token validation and verification
- User ID extraction from token claims
- Integration with NestJS guard system
- Configurable token expiration

### Project Structure

```md
src/
├── common/
│ ├── ai/ # AI utilities and integrations
│ │ ├── actions.ts # AI action functions (title generation, classification)
│ │ ├── aggregation.ts # Chart data aggregation logic
│ │ ├── policy.ts # Classification policy and refusal messages
│ │ ├── prompts.ts # AI system prompts (global & page-scoped)
│ │ ├── tools.ts # AI tools definitions & resource-specific filtering
│ │ ├── utils.ts # Helper functions for AI (date validation, conversions)
│ │ ├── types/ # TypeScript types for Paystack resources
│ │ └── index.ts
│ ├── exceptions/ # Custom exceptions and global filters
│ ├── helpers/ # Shared utilities
│ ├── interfaces/ # Common interfaces
│ └── services/
│ ├── paystack-api.service.ts # Paystack API integration
│ └── page-context.service.ts # Resource enrichment service
├── config/ # Configuration modules
│ ├── database.config.ts
│ ├── jwt.config.ts
│ └── helpers.ts
├── database/
│ ├── migrations/ # TypeORM migrations
│ └── database.module.ts
├── modules/
│ ├── auth/ # JWT authentication module
│ │ ├── guards/ # JWT auth guard
│ │ ├── decorators/ # @CurrentUser() decorator
│ │ └── auth.service.ts
│ ├── chat/ # Chat & conversation module
│ │ ├── dto/ # Data transfer objects
│ │ │ ├── chat-request.dto.ts # Includes mode & pageContext
│ │ │ ├── page-context.dto.ts # PageContext validation
│ │ │ └── ...
│ │ ├── entities/ # TypeORM entities
│ │ │ ├── conversation.entity.ts # Includes mode & pageContext
│ │ │ └── message.entity.ts
│ │ ├── repositories/ # Database repositories
│ │ ├── exceptions/ # Rate limiting exception
│ │ ├── chat.controller.ts
│ │ ├── chat.service.ts # Orchestrates AI, tools, and classification
│ │ └── chat.module.ts
│ └── health/ # Health check endpoints
├── app.module.ts # Root module with global auth guard
└── main.ts # Application entry point with observability
```

### Technology Stack

- **Framework**: NestJS v11
- **Database**: MongoDB with TypeORM
- **AI**: Vercel AI SDK v5.0 with OpenAI
  - GPT-4o-mini: Chat responses and message classification
  - GPT-3.5-turbo: Conversation title generation
- **Language**: TypeScript v5.7
- **Validation**: class-validator, class-transformer, Zod v4.0
- **HTTP Client**: Axios via @nestjs/axios
- **Date Utilities**: date-fns v4.1
- **Documentation**: Swagger/OpenAPI
- **Observability**: @paystackhq/nestjs-observability (metrics/logs/traces)
- **Error Handling**: Custom Paystack error system with @paystackhq/pkg-response-code

## 🤖 AI Features

### Chat Modes

The API supports two distinct chat modes:

#### Global Mode (Default)

Global mode is for general dashboard queries across all resources. It provides:

- Access to all available Paystack tools
- General conversation about dashboard, transactions, customers, refunds, payouts, and disputes
- Broad context understanding across the merchant's entire account

**Example:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "global",
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's my revenue today?" }]
  }
}
```

#### Page-Scoped Mode

Page-scoped mode locks conversations to specific resources (transactions, customers, refunds, payouts, or disputes). It provides:

- **Context-aware responses**: AI knows the specific resource being discussed
- **Automatic resource enrichment**: Fetches and formats resource data for enhanced understanding
- **Filtered tools**: Only tools relevant to the resource type are available
- **Out-of-page-scope protection**: Refuses queries unrelated to the specific resource
- **Persistent context**: Conversations remain locked to the same resource

**Example:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  },
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's the status of this transaction?" }]
  }
}
```

### Chat Streaming

The API provides real-time AI chat capabilities with streaming responses:

```http
POST /chat/stream
Content-Type: application/json
Authorization: Bearer <token>
```

**Features:**

- Streams AI responses in real-time using UIMessageStream format
- Includes reasoning steps in the response
- Automatically generates conversation titles for new conversations using GPT-3.5-turbo
- Maintains conversation history context (last 40 messages by default, configurable via `MESSAGE_HISTORY_LIMIT`)
- Supports AI tools for dynamic actions
- Dual-mode support: global or resource-scoped

### Paystack Tools & Data Scope

The assistant can only operate on merchant data exposed by these tools (all requests reuse the caller's JWT):

- `getTransactions` – filter by status, channel, customer, date (max 30-day window), amount, currency
- `getCustomers` – list/search customers with pagination, email, and account number filters
- `getRefunds` – status/date/amount filters with operator support (gt, lt, eq)
- `getPayouts` – payout lookup with status/date/subaccount filters
- `getDisputes` – dispute lookup with status/date/transaction filters
- `generateChartData` – streams Recharts-ready data for trends and breakdowns (fetches up to 500 transactions)

All date filters are limited to 30 days; helper validation returns clear errors when exceeded.

### Resource-Specific Tool Filtering

In page-scoped mode, tools are automatically filtered based on the resource type to ensure relevance:

| Resource Type   | Available Tools                                 |
| --------------- | ----------------------------------------------- |
| **Transaction** | `getCustomers`, `getRefunds`, `getDisputes`     |
| **Customer**    | `getTransactions`, `getRefunds`                 |
| **Refund**      | `getTransactions`, `getCustomers`               |
| **Payout**      | `getTransactions`                               |
| **Dispute**     | `getTransactions`, `getCustomers`, `getRefunds` |

This filtering ensures the AI only suggests actions that make sense in the current context. For example, on a transaction details page, the AI can't suggest generating chart data, but can help you look up the customer or related refunds.

### Charting & Aggregation

The `generateChartData` tool provides powerful analytics capabilities:

**Aggregation Types:**

- **by-day**: Daily transaction trends
- **by-hour**: Hourly patterns for detailed analysis
- **by-week**: Weekly performance overview
- **by-month**: Monthly trends and comparisons
- **by-status**: Status distribution (success, failed, abandoned)

**Output Format (Recharts-compatible):**

```json
{
  "success": true,
  "label": "Transaction Trends (Dec 1 - Dec 15, 2024)",
  "chartType": "line",
  "chartData": [
    {
      "label": "Dec 1",
      "count": 45,
      "volume": 2500000,
      "average": 55555,
      "currencies": { "NGN": { "count": 40, "volume": 2000000 }, "USD": { "count": 5, "volume": 500000 } }
    }
  ],
  "summary": {
    "totalCount": 450,
    "totalVolume": 25000000,
    "overallAverage": 55555,
    "dateRange": { "from": "Dec 1, 2024", "to": "Dec 15, 2024" }
  }
}
```

**Features:**

- Streams progress updates while fetching data (up to 500 transactions across 5 pages)
- Multi-currency support with per-currency breakdowns
- Automatic chart type suggestion based on aggregation
- Comprehensive summary statistics
- Date range validation (30-day maximum)

### Guardrails & Classification

The system employs a dual-layer classification mechanism using GPT-4o-mini:

#### Out-of-Scope Protection (Global)

- Classifier ensures conversations stay within allowed intents:
  - Dashboard insights
  - Paystack product FAQs
  - Account help
  - Assistant capabilities
- Out-of-scope requests (e.g., general knowledge, unrelated topics) receive a polite refusal
- **Refusal message**: "I can only help with questions about your Paystack merchant dashboard (transactions, refunds, customers, disputes, payouts) and Paystack product usage. Ask me something like 'What's my revenue today?'"

#### Out-of-Page-Scope Protection (Page Mode)

- Additional classification layer for resource-scoped conversations
- Ensures questions are relevant to the specific resource being viewed
- Prevents context confusion across different resource types
- **Refusal message**: "I can only help with questions about this specific {resource_type}. Ask me something like 'What's the status of this {resource_type}?'"

#### Additional Features

- System prompt includes current date for accurate relative time understanding
- Classification considers full conversation history for context
- Graceful error handling with helpful suggestions for reformulating queries

### Resource Context Enrichment

When using page-scoped mode, the system automatically enriches conversations with resource-specific data:

#### How It Works

1. **Resource Fetching**: `PageContextService` fetches the specific resource data from Paystack API using the provided `resourceId`
2. **Data Formatting**: Resource data is formatted into a human-readable structure
3. **Prompt Injection**: Formatted data is injected into the system prompt for AI context
4. **Enhanced Understanding**: AI can answer questions about the specific resource with full context

#### Supported Resources

- **Transactions**: ID, reference, amount, status, channel, customer details, payment info
- **Customers**: ID, customer code, email, name, phone, risk action, saved cards
- **Refunds**: ID, amount, status, transaction reference, refund type, notes
- **Payouts**: ID, total amount, effective amount, status, settlement date, fees
- **Disputes**: ID, refund amount, status, resolution, category, due date, notes

#### Example

When viewing transaction ID `123456`, the AI receives formatted context like:

```text
Transaction Details:
  - ID: 123456
  - Reference: ref_abc123xyz
  - Amount: NGN 50000
  - Status: success
  - Channel: card
  - Customer Email: customer@example.com
  - Created At: 2024-12-15T10:30:00Z
```

This allows the AI to answer questions like "What payment method was used?" without needing to fetch additional data.

### Extending Tools

To add a new AI tool, create it in `src/common/ai/tools.ts` with `tool({ description, inputSchema, execute })`, then export it from `createTools`. Keep inputs validated with `zod` and ensure execution uses the caller's JWT for Paystack API access.

To add resource-specific tool filtering, update the `RESOURCE_TOOL_MAP` in `tools.ts` to specify which tools should be available for each resource type.

### Automatic Title Generation

When a new conversation starts (via the `/chat/stream` endpoint without an existing conversation), the system automatically generates a descriptive title using GPT-3.5-turbo:

```typescript
import { generateConversationTitle } from './common/ai';

const title = await generateConversationTitle(message);
// Example output: "Payment API Integration"
// Example output: "Transaction Status Inquiry"
```

The title generation:

- Runs asynchronously during the first streaming request
- Uses GPT-3.5-turbo for fast, cost-effective generation
- Extracts key topics from the first user message
- Generates concise, descriptive titles (typically 3-6 words)
- Falls back gracefully if generation fails

## 📡 API Endpoints

### Chat Module

All `/chat` endpoints require `Authorization: Bearer <jwt>` and use the authenticated user's ID.

#### Stream AI Chat

```http
POST /chat/stream
```

Streams AI responses for a conversation. Supports both global and page-scoped modes.

**Request Body (Global Mode):**

```json
{
  "conversationId": "uuid",
  "mode": "global",
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's my revenue today?" }]
  }
}
```

**Request Body (Page-Scoped Mode):**

```json
{
  "conversationId": "uuid",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  },
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's the status of this transaction?" }]
  }
}
```

**Parameters:**

- `conversationId` (required): UUID of the conversation
- `mode` (optional): Chat mode - `"global"` (default) or `"page"`
- `pageContext` (required when mode is "page"): Resource context
  - `type`: One of `"transaction"`, `"customer"`, `"refund"`, `"payout"`, `"dispute"`
  - `resourceId`: Resource identifier (transaction ID, customer code, etc.)
- `message` (required): User message object

**Response:** Server-sent events stream with UIMessage format

**Important Notes:**

- Once a conversation is created with a specific mode and pageContext, it cannot be changed
- Page-scoped conversations remain locked to the original resource
- Global conversations cannot be converted to page-scoped

**Error Responses:**

- `400 Bad Request` - Invalid mode or missing pageContext
- `404 Not Found` - Conversation or resource not found
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

Creates a new conversation. Conversations are typically auto-created when streaming starts, but this endpoint allows manual creation with custom titles.

**Request Body (Global Mode):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "mode": "global"
}
```

**Request Body (Page-Scoped Mode):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Transaction Inquiry",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  }
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

Retrieves all conversations for the authenticated user with optional filtering.

**Query Parameters (all optional):**

- `mode` — Filter by chat mode: `"global"` or `"page"`
- `contextType` — Filter by resource type: `"transaction"`, `"customer"`, `"refund"`, `"payout"`, or `"dispute"`

**Examples:**

```http
# Get all conversations
GET /chat/conversations

# Get only global conversations
GET /chat/conversations?mode=global

# Get only page-scoped conversations
GET /chat/conversations?mode=page

# Get all transaction-related conversations
GET /chat/conversations?contextType=transaction

# Get page-scoped transaction conversations
GET /chat/conversations?mode=page&contextType=transaction
```

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
  mode: 'global' | 'page',  // Chat mode
  pageContext: {       // Optional, only for page-scoped conversations
    type: 'transaction' | 'customer' | 'refund' | 'payout' | 'dispute',
    resourceId: string
  },
  createdAt: Date
}
```

**Indexes:**

- `id` - Unique index for UUID lookups
- `userId` - Index for user-scoped queries
- `mode` - Index for filtering by chat mode

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

### Mechanism

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

#### Scenario 1: Within Limits

- User sends 50 messages in 12 hours
- User can still send 50 more messages before hitting the limit

#### Scenario 2: Limit Exceeded

- User sends 100 messages in 24 hours
- Next request returns HTTP 429 with details:
  - Current count
  - Time period
  - Maximum allowed

#### Scenario 3: Sliding Window

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
MESSAGE_LIMIT=100              # Maximum messages per user per period
RATE_LIMIT_PERIOD_HOURS=24    # Sliding window period in hours
MESSAGE_HISTORY_LIMIT=40      # Number of past messages kept in AI context (default: 40)

# Logging
LOG_LEVEL=info
USE_JSON_LOGGER=true
DEBUG=false

# OpenTelemetry
OTEL_LOGS_EXPORTER=console
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console
```

**Note:** The project uses environment-specific configurations. In test/e2e environments, `.env` files are ignored to allow programmatic config overrides.

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

- Follow the existing ESLint configuration (ESLint v9 with flat config)
- Use Prettier for code formatting
- Write meaningful commit messages (Commitlint enforces conventional commits)
- Add tests for new features (Jest for unit tests, Supertest for E2E)
- Update documentation as needed

### Adding New Features

**Adding AI Tools:**

1. Define tool in `src/common/ai/tools.ts` using Vercel AI SDK's `tool()` function
2. Add Zod schema for input validation
3. Implement execute function with JWT-authenticated Paystack API calls
4. Export from `createTools()` function
5. Optionally add to resource-specific tool map for page-scoped filtering

**Adding Resource Types:**

1. Add new type to `PageContextType` enum in `src/common/ai/types/index.ts`
2. Implement fetching logic in `PageContextService.fetchResourceData()`
3. Add formatting logic in `PageContextService.formatResourceData()`
4. Update `RESOURCE_TOOL_MAP` in `tools.ts` with relevant tools
5. Add TypeScript interface for resource in `types/index.ts`

**Testing:**

- Unit tests: Mock services and test business logic
- E2E tests: Test full request/response cycles with test database
- Run `pnpm run test:all` before submitting PR

## 🔧 Troubleshooting

### OpenAI API Errors

#### "OPENAI_API_KEY is not configured"

- Ensure `OPENAI_API_KEY` is set in your `.env` file
- Verify the API key is valid and has credits
- Check that the API key starts with `sk-`

#### AI responses are slow or timing out

- Verify your OpenAI account has sufficient credits
- Check network connectivity to OpenAI API
- Consider increasing request timeout settings

### Database Connection Issues

#### "Cannot connect to MongoDB"

- Verify MongoDB is running: `docker ps`
- Check connection string in `.env`
- Ensure database credentials are correct
- Verify MongoDB port (default: 27017) is accessible

#### Migration errors

- Ensure database exists before running migrations
- Check TypeORM connection settings in `datasource.ts`
- Run migrations manually: `pnpm run migration:run`

### Paystack API Issues

#### "Authentication token not available"

- Ensure JWT token is included in Authorization header
- Verify token format: `Bearer <token>`
- Check token expiration and renewal

#### "Failed to fetch [resource] data"

- Verify `PAYSTACK_API_BASE_URL` is correctly configured
- Check that the JWT token has proper Paystack permissions
- Ensure the resource ID/reference is valid
- Check Paystack API status

### Build Errors

#### "Module not found"

- Run `pnpm install` to ensure all dependencies are installed
- Clear build cache: `rm -rf dist && pnpm run build`
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`

### Rate Limiting Issues

#### Hitting rate limits during testing

- Adjust `MESSAGE_LIMIT` in `.env` for development
- Clear message history in database for test users
- Use different test user IDs to avoid shared rate limits

### Page-Scoped Conversation Errors

#### "Conversation is locked to a different page context"

- Page-scoped conversations cannot change resource context
- Create a new conversation for different resources
- Verify `pageContext.type` and `pageContext.resourceId` match the conversation

#### "Cannot change an existing conversation to a page-scoped context"

- Global conversations cannot be converted to page-scoped
- Create a new conversation with `mode: "page"` from the start

## 📚 Additional Resources

### Project Documentation

- [Authentication Guide](./AUTHENTICATION.md) - JWT authentication implementation details
- [Error Handling Guide](./docs/error-handling.md) - Comprehensive error handling patterns and best practices
- [Redis Configuration](./docs/redis-configuration.md) - Redis setup and usage (if applicable)

### External Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Zod Documentation](https://zod.dev/) - Schema validation used in AI tools
