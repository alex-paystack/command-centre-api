# Contributing

This document covers code style, testing guidelines, adding new features, and troubleshooting common issues.

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

### ESLint & Prettier

- Follow the existing ESLint configuration (ESLint v9 with flat config)
- Use Prettier for code formatting
- Run checks before committing:

```bash
pnpm run lint:check    # Check linting
pnpm run format:check  # Check formatting
pnpm run lint          # Fix linting issues
pnpm run format        # Fix formatting issues
```

### Commit Messages

Commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:

```
feat(chat): add support for page-scoped conversations
fix(auth): handle expired JWT tokens gracefully
docs(readme): update installation instructions
```

## Testing

### Test Structure

Unit test files follow the `*.spec.ts` naming convention:

| Test File                            | Description                      |
| ------------------------------------ | -------------------------------- |
| `chat.controller.spec.ts`            | Chat controller tests            |
| `chat.service.spec.ts`               | Chat service layer tests         |
| `chat.service.summarization.spec.ts` | Conversation summarization tests |
| `aggregation.spec.ts`                | Chart aggregation logic tests    |
| `page-scoped-tools.spec.ts`          | Page-scoped tool filtering tests |
| `tools.count-transactions.spec.ts`   | Transaction counting tool tests  |
| `utils.spec.ts`                      | AI utility function tests        |
| `jwt-auth.guard.spec.ts`             | Authentication guard tests       |
| `page-context.service.spec.ts`       | Page context enrichment tests    |
| `app.service.spec.ts`                | Application service tests        |

E2E tests are located in `test/e2e/` directory.

### Running Tests

```bash
pnpm run test           # Run unit tests
pnpm run test:watch     # Run in watch mode
pnpm run test:cov       # Run with coverage
pnpm run test:e2e       # Run E2E tests
pnpm run test:all       # Run all tests
```

### Writing Tests

- **Unit tests**: Mock services and test business logic
- **E2E tests**: Test full request/response cycles with test database
- Run `pnpm run test:all` before submitting PR

## Adding New Features

### Adding AI Tools

1. Define tool in `src/common/ai/tools.ts` using Vercel AI SDK's `tool()` function
2. Add Zod schema for input validation
3. Implement execute function with JWT-authenticated Paystack API calls
4. Export from `createTools()` function
5. Optionally add to resource-specific tool map for page-scoped filtering

**Example**:

```typescript
export function createMyNewTool(paystackService: PaystackApiService, getAuthenticatedUser: () => AuthenticatedUser) {
  return tool({
    description: 'Description of what this tool does',
    inputSchema: z.object({
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter'),
    }),
    execute: async ({ param1, param2 }) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return { error: 'Authentication token not available' };
      }

      try {
        const response = await paystackService.get('/endpoint', jwtToken, { param1, param2 });
        return { success: true, data: response.data };
      } catch (error) {
        return { error: error.message };
      }
    },
  });
}
```

### Adding Resource Types

1. Add new type to `PageContextType` enum in `src/common/ai/types/index.ts`
2. Implement fetching logic in `PageContextService.fetchResourceData()`
3. Add formatting logic in `PageContextService.formatResourceData()`
4. Update `RESOURCE_TOOL_MAP` in `tools.ts` with relevant tools
5. Add TypeScript interface for resource in `types/index.ts`

### Adding Chart Resource Types

1. Add new type to `ChartResourceType` enum in `src/common/ai/chart-config.ts`
2. Add field accessor configuration (`ResourceFieldConfig`) for the new resource
3. Update `VALID_AGGREGATIONS` with supported aggregation types
4. Update `STATUS_VALUES` with valid status values for the resource
5. Add API endpoint to `API_ENDPOINTS` mapping
6. Update `getFieldConfig()` function to return the new config

**Example**:

```typescript
// In chart-config.ts
export const myResourceFieldConfig: ResourceFieldConfig<MyResource> = {
  getAmount: (r) => r.amount,
  getCurrency: (r) => r.currency,
  getCreatedAt: (r) => r.createdAt,
  getStatus: (r) => r.status,
};

// Update VALID_AGGREGATIONS
[ChartResourceType.MY_RESOURCE]: [
  AggregationType.BY_DAY,
  AggregationType.BY_WEEK,
  AggregationType.BY_STATUS,
],
```

## Troubleshooting

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

### Conversation Summarization Issues

#### "This conversation has reached its limit and has been closed"

- Conversations are closed after 2 summarization cycles (approximately 40+ user messages)
- Use `POST /chat/conversations/from-summary` to continue with carried-over context
- The new conversation will inherit the summary from the closed conversation

#### Summaries not being generated

- Check `SUMMARIZATION_THRESHOLD` setting (default: 20 user messages)
- Summarization runs asynchronously after the stream completes
- Check logs for summarization errors
- Verify OpenAI API key has sufficient credits

## Pull Request Guidelines

### Before Submitting

- [ ] All tests pass (`pnpm run test:all`)
- [ ] Code is formatted (`pnpm run format:check`)
- [ ] Linting passes (`pnpm run lint:check`)
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventional commits

### PR Description

Include:

- **What** - Brief description of changes
- **Why** - Motivation for the change
- **How** - Implementation approach
- **Testing** - How the changes were tested

### Review Process

1. CI pipeline must pass
2. At least one approval required
3. All comments must be resolved
4. Branch must be up to date with main
