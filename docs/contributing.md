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

```text
type(scope): description

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:

```text
feat(chat): add support for page-scoped conversations
fix(auth): handle expired JWT tokens gracefully
docs(readme): update installation instructions
```

## Testing

### Test Structure

Unit test files follow the `*.spec.ts` naming convention:

| Test File                                       | Description                       |
| ----------------------------------------------- | --------------------------------- |
| `chat.controller.spec.ts`                       | Chat controller tests             |
| `chat.service.spec.ts`                          | Chat service layer tests          |
| `chat.service.summarization.spec.ts`            | Conversation summarization tests  |
| `aggregation.spec.ts`                           | Chart aggregation logic tests     |
| `tools/export-tools.spec.ts`                    | Export tools tests                |
| `tools/retrieval-tools.spec.ts`                 | Data retrieval tools tests        |
| `tools/page-scoped-tools.spec.ts`               | Page-scoped tool filtering tests  |
| `utils.spec.ts`                                 | AI utility function tests         |
| `utilities/retreival-filter-validation.spec.ts` | Retrieval filter validation tests |
| `jwt-auth.guard.spec.ts`                        | Authentication guard tests        |
| `page-context.service.spec.ts`                  | Page context enrichment tests     |
| `app.service.spec.ts`                           | Application service tests         |

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

AI tools are organized by category in `src/common/ai/tools/`:

- **`retrieval.ts`** - Data retrieval tools (get\*)
- **`export.ts`** - Data export tools (export\*)
- **`visualization.ts`** - Chart generation tools

**Steps**:

1. Add tool factory function in the appropriate category file using Vercel AI SDK's `tool()` function
2. Add Zod schema for input validation
3. Add filter validation constants (if creating a new retrieval tool)
4. Implement execute function with JWT-authenticated Paystack API calls and filter validation
5. Export the factory function from the category file
6. Import and add to `createTools()` in `tools/index.ts`
7. Optionally add to `RESOURCE_TOOL_MAP` in `tools/index.ts` for page-scoped filtering
8. Write comprehensive tests in the corresponding `*-tools.spec.ts` file

**Example** (adding a retrieval tool in `tools/retrieval.ts`):

```typescript
import { findUnsupportedFilters, buildUnsupportedFilterError } from '../utilities/retreival-filter-validation';

// Define allowed filters for this resource type
export const MY_RESOURCE_ALLOWED_FILTERS = ['perPage', 'page', 'param1', 'param2'] as const;

export function createMyNewTool(paystackService: PaystackApiService, getAuthenticatedUser: () => AuthenticatedUser) {
  return tool({
    description: 'Description of what this tool does',
    inputSchema: z.looseObject({
      perPage: z.number().optional().default(50),
      page: z.number().optional().default(1),
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter'),
    }),
    execute: async (input) => {
      const { jwtToken } = getAuthenticatedUser();

      if (!jwtToken) {
        return { error: 'Authentication token not available' };
      }

      // Validate filters
      const unsupportedFilters = findUnsupportedFilters(input, MY_RESOURCE_ALLOWED_FILTERS);

      if (unsupportedFilters.length) {
        return buildUnsupportedFilterError('my-resources', unsupportedFilters, MY_RESOURCE_ALLOWED_FILTERS);
      }

      const { perPage, page, param1, param2 } = input;

      try {
        const response = await paystackService.get('/endpoint', jwtToken, {
          perPage,
          page,
          param1,
          param2,
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { error: error.message };
      }
    },
  });
}
```

**Important Notes:**

1. **Filter Validation**: Use `z.looseObject()` instead of `z.object()` for the input schema to allow extra fields for validation. Always validate filters before making API calls using `findUnsupportedFilters()` and `buildUnsupportedFilterError()`.

2. **Sanitization**: For data retrieval tools that return arrays of resources, apply sanitization before returning:

```typescript
import { sanitizeTransactions } from '../sanitization';

const response = await paystackService.get<PaystackTransaction[]>('/transaction', jwtToken, params);

// Sanitize to reduce token count
const sanitized = sanitizeTransactions(response.data);

return {
  success: true,
  transactions: sanitized, // Return sanitized data
  meta: response.meta,
  message: `Retrieved ${response.data.length} transaction(s)`,
};
```

See the [Response Sanitization](#response-sanitization-for-new-retrieval-tools) section below for details.

### Response Sanitization for New Retrieval Tools

When adding new data retrieval tools, apply response sanitization to reduce token consumption in LLM context. The sanitization system provides 70-85% token reduction while preserving essential data.

**Steps to Add Sanitization:**

1. **Define Resource Type**: Add to `ResourceType` enum in `src/common/ai/sanitization/types.ts`

```typescript
export enum ResourceType {
  TRANSACTION = 'transaction',
  CUSTOMER = 'customer',
  // ... existing types
  MY_NEW_RESOURCE = 'my-new-resource', // Add here
}
```

2. **Create Field Configuration**: Define what fields to keep at each sanitization level in `src/common/ai/sanitization/config.ts`

```typescript
export const MY_RESOURCE_FIELD_CONFIG: ResourceFieldConfigs<MyResource> = {
  [SanitizationLevel.MINIMAL]: {
    fields: ['id', 'amount', 'status'], // Only essentials
  },

  [SanitizationLevel.STANDARD]: {
    fields: ['id', 'amount', 'status', 'reference', 'createdAt'], // Most common needs
    nested: {
      customer: {
        fields: ['id', 'email'], // Simplified nested objects
      },
    },
  },

  [SanitizationLevel.DETAILED]: {
    fields: ['id', 'amount', 'status', 'reference', 'createdAt', 'notes', 'updatedAt'], // More detail
    nested: {
      customer: {
        fields: ['id', 'email', 'customer_code', 'phone'],
      },
    },
  },
};

// Add to central config map
export const RESOURCE_CONFIGS = {
  // ... existing configs
  [ResourceType.MY_NEW_RESOURCE]: MY_RESOURCE_FIELD_CONFIG,
} as const;
```

3. **Create Convenience Function**: Add a helper function in `src/common/ai/sanitization/sanitizer.ts`

```typescript
export function sanitizeMyResources(
  resources: MyResource[],
  level: SanitizationLevel = SanitizationLevel.STANDARD,
): Array<Partial<MyResource>> {
  return ResourceSanitizer.sanitizeArray(resources, {
    resourceType: ResourceType.MY_NEW_RESOURCE,
    level,
  });
}
```

4. **Export from Index**: Add to `src/common/ai/sanitization/index.ts`

```typescript
export { sanitizeMyResources } from './sanitizer';
```

5. **Apply in Tool**: Use the sanitization function in your retrieval tool's execute function

```typescript
const response = await paystackService.get<MyResource[]>('/my-endpoint', jwtToken, params);
const sanitized = sanitizeMyResources(response.data);

return {
  success: true,
  myResources: sanitized, // Sanitized response
  meta: response.meta,
  message: `Retrieved ${response.data.length} resource(s)`,
};
```

6. **Write Tests**: Add comprehensive tests in `src/common/ai/sanitization/sanitizer.spec.ts`

```typescript
describe('My Resource Sanitization', () => {
  const mockResource = {
    id: 1,
    amount: 50000,
    status: 'active',
    reference: 'ref123',
    // ... full resource with all fields
  };

  it('should sanitize with MINIMAL level', () => {
    const result = sanitizeMyResources([mockResource], SanitizationLevel.MINIMAL)[0];

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('status');
    // Verify verbose fields are removed
    expect(result.notes).toBeUndefined();
  });

  // Add tests for STANDARD and DETAILED levels
});
```

**Configuration Guidelines:**

- **MINIMAL**: Only fields needed for basic identification (IDs, primary amounts, status)
- **STANDARD** (default): Include fields commonly needed for most queries (references, dates, core metrics)
- **DETAILED**: Add fields needed for complex analysis (notes, metadata, extended details)
- **Nested Objects**: Only include fields actually needed by the AI for context
- **Array Limiting**: Use `arrayLimit` to cap nested arrays (e.g., first 3-5 items)

**Example Token Savings:**

For a typical resource with 20+ fields returning 50 items:

- MINIMAL: ~85% reduction (5 fields)
- STANDARD: ~70% reduction (8-10 fields)
- DETAILED: ~60% reduction (12-15 fields)

**Testing Sanitization:**

```bash
# Run sanitization tests
pnpm run test -- sanitizer.spec.ts

# Run retrieval tool tests (includes sanitization verification)
pnpm run test -- retrieval-tools.spec.ts
```

### Filter Validation for New Retrieval Tools

When adding new data retrieval tools, implement filter validation to ensure only supported filters are passed to the Paystack API. This provides clear feedback to users and prevents API errors from unsupported parameters.

**Steps to Add Filter Validation:**

1. **Define Allowed Filters**: Create a constant array of allowed filter names in `src/common/ai/utilities/retreival-filter-validation.ts`

```typescript
export const MY_RESOURCE_ALLOWED_FILTERS = [
  ...GENERIC_ALLOWED_FILTERS, // Includes 'perPage', 'page'
  ...DATE_ALLOWED_FILTERS, // Optionally include 'from', 'to'
  'status',
  'customFilter1',
  'customFilter2',
] as const;
```

2. **Use Loose Object Schema**: In your tool's input schema, use `z.looseObject()` instead of `z.object()` to allow extra fields for validation

```typescript
inputSchema: z.looseObject({
  perPage: z.number().optional().default(50),
  page: z.number().optional().default(1),
  status: z.enum(['active', 'inactive']).optional(),
  customFilter1: z.string().optional(),
  // ... other parameters
});
```

3. **Validate Filters in Execute Function**: Add validation logic at the start of the execute function

```typescript
execute: async (input) => {
  const { jwtToken } = getAuthenticatedUser();

  if (!jwtToken) {
    return { error: 'Authentication token not available' };
  }

  // Validate filters
  const unsupportedFilters = findUnsupportedFilters(input, MY_RESOURCE_ALLOWED_FILTERS);

  if (unsupportedFilters.length) {
    return buildUnsupportedFilterError('my-resources', unsupportedFilters, MY_RESOURCE_ALLOWED_FILTERS);
  }

  // Continue with API call...
};
```

4. **Export Filter Constants**: Export your filter constants from the validation module if they need to be referenced elsewhere

```typescript
export {
  // ... existing exports
  MY_RESOURCE_ALLOWED_FILTERS,
} from './retreival-filter-validation';
```

5. **Write Tests**: Add comprehensive tests in `src/common/ai/utilities/retreival-filter-validation.spec.ts` and in your tool's test file

```typescript
describe('My Tool Filter Validation', () => {
  it('should refuse unsupported filters', async () => {
    const tool = createMyTool(mockPaystackService, mockGetAuthenticatedUser);

    // @ts-expect-error intentional invalid filter to test guard
    const result = await tool.execute?.({ invalidFilter: 'value' }, mockToolCallOptions);

    expect(result).toMatchObject({
      error: expect.stringContaining('invalidFilter'),
    });
    expect(mockPaystackService.get).not.toHaveBeenCalled();
  });

  it('should accept valid filters', async () => {
    const tool = createMyTool(mockPaystackService, mockGetAuthenticatedUser);

    const result = await tool.execute?.({ perPage: 50, status: 'active' }, mockToolCallOptions);

    expect(result).toHaveProperty('success', true);
    expect(mockPaystackService.get).toHaveBeenCalled();
  });
});
```

**Filter Naming Conventions:**

- `GENERIC_ALLOWED_FILTERS`: `['perPage', 'page']` - Pagination filters common to all tools
- `DATE_ALLOWED_FILTERS`: `['from', 'to']` - Date range filters for time-based queries
- Resource-specific filters: Add filters specific to your resource type

**Benefits:**

- **Early Error Detection**: Catches invalid filters before making API calls
- **User-Friendly Errors**: Provides clear, actionable error messages
- **API Protection**: Prevents unnecessary API calls with invalid parameters
- **Consistency**: Maintains consistent validation patterns across all tools
- **Type Safety**: Constants provide autocomplete and type checking in development

**Testing Filter Validation:**

```bash
# Run filter validation tests
pnpm run test -- retreival-filter-validation.spec.ts

# Run tool tests (includes filter validation)
pnpm run test -- retrieval-tools.spec.ts
```

### Adding Resource Types

1. Add new type to `ResourceType` enum in `src/common/ai/types/index.ts`
2. Implement fetching logic in `PageContextService.fetchResourceData()`
3. Add formatting logic in `PageContextService.formatResourceData()`
4. Update `RESOURCE_TOOL_MAP` in `src/common/ai/tools/index.ts` with relevant tools
5. Add TypeScript interface for resource in `types/index.ts`

### Adding Chart Resource Types

1. Add new type to `ChartResourceType` enum in `src/common/ai/utilities/chart-config.ts`
2. Add field accessor configuration (`ResourceFieldConfig`) for the new resource
3. Update `VALID_AGGREGATIONS` with supported aggregation types
4. Update `STATUS_VALUES` with valid status values for the resource
5. Add API endpoint to `API_ENDPOINTS` mapping
6. Update `getFieldConfig()` function to return the new config

**Example**:

```typescript
// In utilities/chart-config.ts
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
