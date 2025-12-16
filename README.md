# Command Centre API

Paystack-aware, AI-powered merchant dashboard API built with NestJS, MongoDB, and OpenAI.

## Overview

Command Centre API is a NestJS-based backend service that powers an AI-driven merchant dashboard. It provides intelligent chat capabilities, conversation management, and AI-powered features to help merchants interact with their data and systems through natural language.

### Key Features

- 🤖 **AI-Powered Chat** — Streaming responses with GPT-4o-mini and live reasoning
- 🔒 **JWT-Protected** — All `/chat` endpoints require Bearer tokens; Paystack calls reuse the user's JWT
- 🌍 **Dual Chat Modes** — Global mode for dashboard queries, page-scoped mode for resource-specific conversations
- 📊 **Analytics & Charts** — Multi-resource charting with time-based and categorical aggregations
- 🧭 **Guardrails** — Dual-layer classification for out-of-scope protection
- 🛡️ **Rate Limiting** — Configurable message entitlement with sliding window enforcement
- 📝 **Smart Summarization** — Automatic conversation summarization with context carry-over

## Quick Start

### Prerequisites

- Node.js v24.5.0
- pnpm v10.14.0
- MongoDB instance
- OpenAI API key

### Installation

```bash
# Clone and install
git clone <repository-url>
cd command-centre-api
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
pnpm run start:dev
```

The API will be available at `http://localhost:3000`

### Essential Configuration

```env
DATABASE_HOST=mongodb
DATABASE_USERNAME=root
DATABASE_PASSWORD=root
DATABASE_NAME=command-centre-api
OPENAI_API_KEY=sk-your-openai-api-key
JWT_SECRET=your-secret-key
```

See [Configuration Guide](./docs/configuration.md) for all options.

## Documentation

| Document                                   | Description                                                 |
| ------------------------------------------ | ----------------------------------------------------------- |
| [Architecture](./docs/architecture.md)     | Core services, project structure, technology stack          |
| [AI Features](./docs/ai-features.md)       | Chat modes, tools, charting, guardrails, context enrichment |
| [API Reference](./docs/api-reference.md)   | Complete endpoint documentation                             |
| [Database](./docs/database.md)             | MongoDB collections and migrations                          |
| [Configuration](./docs/configuration.md)   | Environment variables and rate limiting                     |
| [Deployment](./docs/deployment.md)         | Docker, CI/CD, production checklist                         |
| [Contributing](./docs/contributing.md)     | Code style, adding features, troubleshooting                |
| [Authentication](./docs/authentication.md) | JWT implementation details                                  |
| [Error Handling](./docs/error-handling.md) | Error patterns and best practices                           |

## Technology Stack

| Category      | Technology                                         |
| ------------- | -------------------------------------------------- |
| Framework     | NestJS v11                                         |
| Database      | MongoDB with TypeORM                               |
| AI            | Vercel AI SDK v5.0.110 with OpenAI                 |
| Language      | TypeScript v5.7                                    |
| Validation    | Zod v4.0, class-validator                          |
| Observability | OpenTelemetry via @paystackhq/nestjs-observability |

## Available Scripts

```bash
# Development
pnpm run start:dev      # Start with hot reload
pnpm run build          # Build for production

# Testing
pnpm run test           # Run unit tests
pnpm run test:e2e       # Run E2E tests
pnpm run test:cov       # Run with coverage

# Code Quality
pnpm run lint           # Lint and fix
pnpm run format         # Format code

# Database
pnpm run migration:run  # Run migrations
```

## API Overview

All `/chat` endpoints require `Authorization: Bearer <jwt>`.

| Method | Endpoint                           | Description                       |
| ------ | ---------------------------------- | --------------------------------- |
| POST   | `/chat/stream`                     | Stream AI chat responses          |
| POST   | `/chat/conversations`              | Create conversation               |
| POST   | `/chat/conversations/from-summary` | Continue from closed conversation |
| GET    | `/chat/conversations`              | List user conversations           |
| GET    | `/chat/conversations/:id`          | Get conversation                  |
| DELETE | `/chat/conversations/:id`          | Delete conversation               |
| GET    | `/chat/messages/:conversationId`   | Get messages                      |
| GET    | `/health`                          | Health check (public)             |

See [API Reference](./docs/api-reference.md) for complete documentation.

## Docker

```bash
# Development
docker-compose up -d    # Start MongoDB & supporting services
pnpm run start:dev      # Run app locally

# Production
docker build -t command-centre-api .
docker run -p 3000:3000 --env-file .env command-centre-api
```

## Swagger

Interactive API documentation available at:

- **Swagger UI**: `http://localhost:3000/swagger`
- **OpenAPI JSON**: `http://localhost:3000/swagger-json`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm run test:all`
5. Submit a Pull Request

See [Contributing Guide](./docs/contributing.md) for details.

## External Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [MongoDB](https://docs.mongodb.com/)
- [Zod](https://zod.dev/)
