# Dashboard Feature Configuration Knowledge Base - Implementation Plan

## Context & Requirements

**Goal**: Enable the AI agent to answer questions about dashboard features (e.g., "what is transfer approval") by providing:

1. Feature state for the merchant (from GET /integration/:id)
2. Dashboard page location where the feature can be configured
3. Feature description (from future RAG implementation on support articles)

**Constraints**:

- 10-30 mixed property types (booleans, objects, enums) from integration endpoint
- Mapping is very stable (changes quarterly/yearly)
- Must work in both global and page-scoped chat modes
- Dashboard URLs are static paths (e.g., /settings/transfers)
- RAG for feature descriptions will be implemented later

## Architecture Analysis

### Current Context Enrichment Pattern

The codebase uses two methods for providing context to the AI:

1. **System Prompt Injection** (`PageContextService`):
   - Fetches resource data (transaction, customer, etc.)
   - Formats it as structured text
   - Injects into `PAGE_SCOPED_SYSTEM_PROMPT` via template replacement
   - Located at: `src/common/services/page-context.service.ts`

2. **Tool-based Data Retrieval** (AI tools in `src/common/ai/tools/`):
   - AI calls functions to fetch data on-demand
   - Used for transactions, customers, refunds, etc.
   - Pattern: Factory functions with Zod schemas

### Proposed Approaches

#### Approach 1: Knowledge Base in System Prompt (RECOMMENDED)

Create a feature knowledge base that gets injected into the system prompt, similar to how resource data is injected in page-scoped mode.

**How it works**:

1. Create `src/common/ai/knowledge/feature-mappings.ts` with structured feature metadata:

   ```typescript
   interface FeatureMapping {
     propertyPath: string; // e.g., "transfer_approval.enabled"
     featureName: string; // e.g., "Transfer Approval"
     dashboardPath: string; // e.g., "/settings/transfers"
     propertyType: 'boolean' | 'enum' | 'object';
     valueFormatter?: (value: any) => string; // For complex types
     description?: string; // Optional short description (until RAG is ready)
   }
   ```

2. Create new AI tool `getFeatureConfiguration`:
   - Input: feature name or property path (fuzzy matched)
   - Fetches from GET /integration/:id
   - Uses feature mapping to extract and format the property
   - Returns: feature state, dashboard location, formatted value

3. Add feature knowledge to global system prompt:
   - List available dashboard features the agent knows about
   - Instruct agent to use `getFeatureConfiguration` tool when asked

**Pros**:

- ✅ Follows existing tool pattern (consistent with codebase)
- ✅ Works in both global and page-scoped modes
- ✅ Lazy loading - only fetches when needed
- ✅ Easy to extend when RAG is added (just enhance tool response)
- ✅ Testable with existing tool testing patterns
- ✅ Scales well with 10-30 properties
- ✅ Can handle complex property types with custom formatters

**Cons**:

- ⚠️ Requires one API call per feature query
- ⚠️ Agent must decide when to call the tool

#### Approach 2: Eager Context Enrichment

Fetch integration data upfront and inject into system prompt like `PageContextService` does.

**How it works**:

1. Create `IntegrationContextService` similar to `PageContextService`
2. Fetch GET /integration/:id at conversation start
3. Format all features and inject into system prompt
4. No tool needed - agent has all feature info in context

**Pros**:

- ✅ Zero latency for feature questions
- ✅ Agent always has full context
- ✅ Simpler implementation (no new tool)

**Cons**:

- ❌ Adds ~2-5KB to every conversation (for 10-30 features)
- ❌ Token usage increases for all conversations, even when not asking about features
- ❌ Need integration ID context (which integration to fetch?)
- ❌ Requires caching/state management to avoid repeated API calls
- ❌ Less flexible for page-scoped mode (which integration?)

#### Approach 3: Static Knowledge Base (No API calls)

Maintain feature documentation entirely in code without fetching integration state.

**How it works**:

1. Create static feature catalog in `src/common/ai/knowledge/features.ts`
2. Agent knows about features but can't tell user their current state
3. Agent directs user to dashboard page

**Pros**:

- ✅ Zero API overhead
- ✅ Simple implementation

**Cons**:

- ❌ Can't tell user their current configuration state
- ❌ Doesn't meet requirement: "state of that feature for the merchant"
- ❌ Limited value - just pointing to URLs

## Recommended Solution: Approach 1 (Tool-Based with Knowledge Base)

### Implementation Plan

#### Phase 1: Create Feature Knowledge Base

**File**: `src/common/ai/knowledge/feature-mappings.ts`

```typescript
export interface FeatureMapping {
  propertyPath: string;
  featureName: string;
  dashboardPath: string;
  propertyType: 'boolean' | 'enum' | 'object' | 'array';
  valueFormatter?: (value: any) => string;
  shortDescription?: string;
  relatedProperties?: string[];
}

export const FEATURE_MAPPINGS: FeatureMapping[] = [
  // Example 1: Simple boolean property
  {
    propertyPath: 'live',
    featureName: 'Live Mode',
    dashboardPath: '/settings/developer',
    propertyType: 'boolean',
    shortDescription: 'Whether the integration is in live or test mode',
  },
  // Example 2: Nested property
  {
    propertyPath: 'settlement_approval.enabled',
    featureName: 'Settlement Approval',
    dashboardPath: '/settings/settlements',
    propertyType: 'boolean',
    shortDescription: 'Require approval before settlements are processed',
  },
  // Example 3: Complex property with custom formatter
  {
    propertyPath: 'allowed_currencies',
    featureName: 'Allowed Currencies',
    dashboardPath: '/settings/preferences',
    propertyType: 'array',
    valueFormatter: (value: string[]) => value.join(', '),
    shortDescription: 'Currencies enabled for this integration',
  },
  // TODO: Add more feature mappings here
  // User will populate additional mappings based on their integration schema
];

// Utility function for fuzzy matching feature names
export function findFeatureByName(searchTerm: string): FeatureMapping | null;

// Utility to extract nested property value
export function getNestedProperty(obj: any, path: string): any;
```

**Critical Files**:

- New file: `src/common/ai/knowledge/feature-mappings.ts`
- New file: `src/common/ai/knowledge/index.ts` (barrel export)

#### Phase 2: Create Feature Configuration Tool

**File**: `src/common/ai/tools/configuration.ts`

```typescript
export function createGetFeatureConfigurationTool(
  paystackService: PaystackApiService,
  getAuthenticatedUser: () => AuthenticatedUser,
) {
  return tool({
    description:
      'Get information about a dashboard feature configuration, including its current state and where to configure it on the Paystack dashboard',
    inputSchema: z.object({
      featureName: z
        .string()
        .describe('The name of the feature to look up (e.g., "transfer approval", "settlement approval", "live mode")'),
      integrationId: z.string().optional().describe('Integration ID (optional, defaults to primary integration)'),
    }),
    execute: async ({ featureName, integrationId }) => {
      const { jwtToken } = getAuthenticatedUser();
      if (!jwtToken) return { error: 'Authentication token not available' };

      try {
        // 1. Find feature mapping by fuzzy matching
        const featureMapping = findFeatureByName(featureName);
        if (!featureMapping) {
          const availableFeatures = FEATURE_MAPPINGS.map((f) => f.featureName).join(', ');
          return {
            error: `Feature "${featureName}" not found. Available features: ${availableFeatures}`,
          };
        }

        // 2. Resolve integration ID if not provided
        let resolvedIntegrationId = integrationId;
        if (!resolvedIntegrationId) {
          const integrationsResponse = await paystackService.get('/integrations', jwtToken);
          // Pick first/primary integration from list
          const integrations = integrationsResponse.data;
          if (!integrations || integrations.length === 0) {
            return { error: 'No integrations found for this merchant' };
          }
          resolvedIntegrationId = integrations[0].id; // First integration is primary
        }

        // 3. Fetch integration configuration
        const response = await paystackService.get(`/integration/${resolvedIntegrationId}`, jwtToken);

        // 4. Extract property value (response is at root level)
        const currentValue = getNestedProperty(response.data, featureMapping.propertyPath);

        // 5. Format response
        const formattedValue = featureMapping.valueFormatter
          ? featureMapping.valueFormatter(currentValue)
          : String(currentValue);

        return {
          success: true,
          feature: featureMapping.featureName,
          currentState: formattedValue,
          dashboardPath: featureMapping.dashboardPath,
          dashboardUrl: `https://dashboard.paystack.com${featureMapping.dashboardPath}`,
          description: featureMapping.shortDescription,
          integrationId: resolvedIntegrationId,
        };
      } catch (error) {
        return { error: error.message || 'Failed to fetch feature configuration' };
      }
    },
  });
}
```

**Critical Files**:

- New file: `src/common/ai/tools/configuration.ts`
- Update: `src/common/ai/tools/index.ts` (add to createTools and createPageScopedTools)

#### Phase 3: Update System Prompts

**File**: `src/common/ai/prompts.ts`

Add section to `CHAT_AGENT_SYSTEM_PROMPT`:

```markdown
## Dashboard Feature Configuration

You can help users understand their dashboard feature settings:

**Feature Configuration Tool:** 11. **getFeatureConfiguration** - Look up dashboard feature settings

- **When to use**: When users ask about specific dashboard features or settings (e.g., "what is transfer approval?", "is settlement approval enabled?", "where do I configure live mode?")
- **What it returns**: Feature description, current state (enabled/disabled/value), and dashboard page location
- **Examples**:
  - "What is transfer approval?" → Returns description, current state, and settings page
  - "Is settlement approval enabled?" → Returns current state and configuration location
  - "How do I enable live mode?" → Returns current state and where to configure it
```

Also update `PAGE_SCOPED_SYSTEM_PROMPT` to include this tool.

**Critical Files**:

- Update: `src/common/ai/prompts.ts`

#### Phase 4: Testing

**File**: `src/common/ai/tools/configuration-tools.spec.ts`

Test cases:

- Feature lookup by exact name
- Feature lookup by fuzzy name
- Property extraction (nested and flat)
- Boolean value formatting
- Enum value formatting
- Object value formatting
- Unknown feature handling
- Authentication error handling
- API error handling

**Critical Files**:

- New file: `src/common/ai/tools/configuration-tools.spec.ts`
- New file: `src/common/ai/knowledge/feature-mappings.spec.ts`

#### Phase 5: Documentation

Update `CLAUDE.md` with:

- How to add new feature mappings
- Property path syntax for nested objects
- Custom value formatter examples
- Integration with future RAG system

### Integration with Future RAG

When RAG is implemented:

1. RAG provides detailed feature description from support articles
2. Tool response merges RAG description with current state and dashboard location
3. No changes to tool interface or system prompt needed
4. Feature mappings remain as source of truth for property paths and dashboard URLs

### Implementation Details (Confirmed with User)

✅ **Integration API Structure**:

- Response is at root level: `{live: true, settlement_approval: {...}, ...}`
- Endpoint requires explicit integration ID: `GET /integration/:id`
- Properties are directly accessible (no nested `data` wrapper)

✅ **Integration ID Resolution**:

- Integration ID is required parameter for the endpoint
- When user doesn't specify integration: fetch primary/default integration
- Call `GET /integrations` and select first/primary integration
- User can optionally specify integration ID in their query

✅ **Feature Mappings**:

- Create structure/framework only
- User will populate actual feature mappings themselves
- Provide 1-2 example mappings as reference

### Key Implementation Decision: Two-Step API Call Pattern

For best UX when integration ID is not provided:

1. **First**: Call `GET /integrations` to get primary integration ID
2. **Second**: Call `GET /integration/:id` with the resolved ID
3. **Cache**: Consider caching integration ID per conversation to avoid repeated lookups

This adds one extra API call but provides seamless UX for the common case where users don't know/care about integration IDs.

## Critical Files Summary

**New Files**:

- `src/common/ai/knowledge/feature-mappings.ts` - Feature metadata and mappings
- `src/common/ai/knowledge/index.ts` - Barrel export
- `src/common/ai/tools/configuration.ts` - Feature configuration tool
- `src/common/ai/tools/configuration-tools.spec.ts` - Tool tests
- `src/common/ai/knowledge/feature-mappings.spec.ts` - Mapping tests

**Modified Files**:

- `src/common/ai/tools/index.ts` - Add new tool to createTools and createPageScopedTools
- `src/common/ai/prompts.ts` - Add feature configuration section to system prompts
- `CLAUDE.md` - Document feature mapping patterns

## Alternative Considerations

### Future Optimization: Caching Strategy

If feature queries become very common and API overhead becomes an issue:

**Option 1: Conversation-level caching**

- Cache integration data in conversation entity (similar to pageContext)
- First query fetches and caches for conversation lifetime
- Subsequent queries use cached data
- No cache invalidation needed (fresh conversation = fresh data)

**Option 2: In-memory TTL cache**

- Cache integration responses with 5-minute TTL
- Key: `userId:integrationId`
- Reduces API calls for repeated queries across conversations
- Simple to implement with `node-cache` or similar

Either can be added later without changing the tool interface.

## Summary for User

Your original idea of creating an "annotated knowledge base" is implemented through:

1. **Static Knowledge Base** (`feature-mappings.ts`): Maps properties → features → dashboard pages
2. **Dynamic State Fetching** (AI tool): Fetches real-time integration state
3. **Seamless UX**: Defaults to primary integration when user doesn't specify

**What you need to do**:

- Populate `FEATURE_MAPPINGS` with your actual integration properties
- Use the three examples as templates for different property types
- Test with your actual GET /integration/:id response structure

**Future RAG integration**:
When you add RAG for detailed feature descriptions:

- Tool fetches RAG description alongside integration state
- Merges: RAG description + current state + dashboard URL
- No changes to tool interface needed
