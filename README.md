# Command Centre API

AI-powered merchant dashboard API built with NestJS, MongoDB, and OpenAI

## 📖 Overview

Command Centre API is a NestJS-based backend service that powers an AI-driven merchant dashboard. It provides intelligent chat capabilities, conversation management, and AI-powered features to help merchants interact with their data and systems through natural language.

### Key Features

- 🤖 **AI-Powered Chat**: Streaming AI responses using OpenAI GPT-4o-mini
- 💬 **Conversation Management**: Full CRUD operations for conversations and messages
- 🎯 **Smart Title Generation**: Automatic conversation title generation from first message
- 🛠️ **AI Tools Integration**: Extensible tool system for AI to interact with backend services
- 📊 **Multi-Modal Messages**: Support for text, images, and rich content via UIMessage format
- 🔄 **Real-time Streaming**: Server-sent events for streaming AI responses
- 🗄️ **MongoDB Storage**: Scalable conversation and message storage

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

   # Service
   NODE_ENV=development
   OTEL_SERVICE_NAME=command-centre-api
   ```

4. **Start the development server**

   ```bash
   pnpm run start:dev
   ```

The API will be available at `http://localhost:3000`

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
- Maintains full conversation history context
- Supports AI tools for dynamic actions

### AI Tools

AI tools allow the model to interact with backend services. Current tools:

#### Get Transactions

```typescript
{
  name: "Get Transactions",
  description: "Get the transactions for a given integration",
  parameters: {
    integrationId: string
  }
}
```

**Adding New Tools:**

1. Define your tool in `src/common/ai/tools.ts`:

   ```typescript
   export const myCustomTool = tool({
     name: 'My Custom Tool',
     description: 'What this tool does',
     inputSchema: z.object({
       param: z.string().describe('Parameter description'),
     }),
     execute: ({ param }) => {
       // Your implementation
       return result;
     },
   });
   ```

2. Add to the tools export:

   ```typescript
   export const tools: Record<string, Tool<unknown, unknown>> = {
     getTransactionsTool,
     myCustomTool,
   };
   ```

### Automatic Title Generation

When a new conversation starts, the first message automatically generates a descriptive title using GPT-3.5-turbo:

```typescript
import { generateConversationTitle } from './common/ai';

const title = await generateConversationTitle(message);
// Returns: "Payment API Integration" (or similar)
```

## 📡 API Endpoints

### Chat Module

#### Stream AI Chat

```http
POST /chat/stream
```

Streams AI responses for a conversation.

**Request Body:**

```json
{
  "conversationId": "uuid",
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "Your message" }]
  }
}
```

**Response:** Server-sent events stream with UIMessage format

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
  "userId": "user_123"
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
GET /chat/conversations/user/:userId
```

Retrieves all conversations for a user.

#### Delete Conversation

```http
DELETE /chat/conversations/:id
```

Deletes a conversation and all its messages.

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
  "parts": {
    "text": "How do I integrate payments?"
  }
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

Returns application health status.

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

# Service Configuration
NODE_ENV=development
APP_NAME=command-centre-api
APP_VERSION=1.0.0
OTEL_SERVICE_NAME=command-centre-api
```

### Optional Variables

```env
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
