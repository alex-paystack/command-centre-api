# Agent Feature KB Conversation (2025-12-26)

**Participants:** User, Codex (assistant)

## Quick Summary

- Need agent to answer "what is <feature>" with description (from support RAG), current state (from `/integration/:id`), and dashboard location.
- Dashboard paths are stable across merchants/regions; some feature states depend on multiple fields.
- If integration data is unavailable, agent should return only the description.
- Proposed solution: feature ontology/KB with slugs, synonyms, dashboard_path, description_rag_key, and evaluable state_rules (JSON Logic/CEL). Runtime flow: resolve feature → fetch integration → evaluate rules → pull RAG description → respond with provenance.

## Decisions & Requirements

- Single dashboard path per feature; no regional variants.
- Multi-field logic supported via ordered state_rules with predicates.
- Fallback: use RAG description when integration fetch fails.
- Include provenance (ontology version, matched rule, data age) in responses.

## Transcript (chronological, condensed)

1. **User:** Wants agent to describe dashboard features, report merchant state, and point to configuration page; suggests building a KB mapping integration properties to features.

2. **Codex:** Affirms KB + live fetch approach; suggests feature ontology, state_rules, dashboard_path, and RAG description pointers; notes cache/provenance and asks clarifying questions (regional paths? multi-field logic? fallback on fetch failure?).

3. **User:** Answers: paths stable; some features use multiple fields; fallback should be description only.

4. **Codex:** Provides concrete plan: KB schema with state_rules, fields metadata, description_rag_key; runtime flow and testing approach; recommends JSON Logic/CEL; outlines next steps.

5. **User:** Asks what `description_rag_key` does.

6. **Codex:** Explains it is the lookup key for RAG to fetch the canonical support description (not state).

7. **User:** Requests a sketch of the agent tool.

8. **Codex:** Shares TypeScript sketch for `feature_state` tool: resolve feature, fetch integration, evaluate rules, fetch RAG description, return state + dashboard path + provenance; includes helper snippets for JSON Logic evaluation.

## Transcript (full)

1. **User:** I need to give my agent the ability to answer questions about their dashboard configuration. For instance, the user can ask "what is transfer approval" and the agent should respond with a description of what the feature is, the state of that feature for the merchant, and the page on the dashboard where the user can configure the feature.

The description of the feature will come from a RAG implementation on support articles that I will implement later but I want to dig into how I might give the agent context about the state of a particular feature.

The data exists on a GET /integration/:id endpoint and I need the agent to know what property maps to what feature and what page on the dashboard the feature can be modified.

I'm thinking I need to create a knowledge base my agent can reference. I can have a sample response from the integration and annotate what each property maps to and on what page it can be modified then my agent can reference that knowledge base when the question is asked.

Is this a good approach? what other approaches can I consider? think about this deeply and ask clairifying questions if required

1. **Codex:** A KB that maps integration fields → feature name → dashboard location is a solid start, but you'll want to combine it with live data retrieval and a tight ontology. Here's a practical approach plus some alternatives:

**Proposed approach**

- Define a small feature ontology: canonical feature slug, friendly name, short definition, related synonyms, dashboard path, and which integration response fields determine state (on/off, mode, limits). Keep this in versioned JSON/YAML so it's easy to review and update.
- At runtime:
  1. Identify the feature from the user query using the ontology + synonyms (deterministic lookup first; fallback to embeddings if ambiguous).
  2. Fetch `/integration/:id` (or use cached copy with freshness window) and read only the fields declared for that feature.
  3. Optionally fetch RAG support text for richer description.
  4. Compose answer with: what the feature is, current state (from integration data), and "Configure at: <dashboard path>".
- Keep the KB strictly about mappings and dashboard URLs; let RAG provide explanations so you don't duplicate long text.
- Add confidence + provenance: return which fields/values were used and the ontology version; if confidence is low, ask a clarifying question.

**Data/structure suggestions**

- File `feature-map.json` entry example:

  ```json
  {
    "slug": "transfer-approval",
    "name": "Transfer Approval",
    "synonyms": ["approval flow", "payout approvals"],
    "state_fields": [
      { "path": "transfer_approval.enabled", "type": "boolean" },
      { "path": "transfer_approval.level", "type": "enum", "values": ["single", "dual"] }
    ],
    "dashboard_path": "/dashboard/transfers/approvals",
    "description_rag_key": "support:transfer-approval"
  }
  ```

- Support field aliases: sometimes the API naming differs from UI wording; encode that mapping here.
- Versioning: include `schema_version` and `updated_at`; let the agent surface the version in responses for auditability.
- Tenant differences: if dashboard paths differ by region/role/plan, store conditional rules (e.g., `conditions: {region: "us-east", path: ...}`).
- Caching strategy: short TTL cache for `/integration/:id`; invalidate on mutation events if you have webhooks.

**Other approaches to consider**

- **Function-calling only, no KB:** Encode the mapping in the tool schema (e.g., function names/params reflect features). Simpler, but harder to update without redeploying code.
- **Inline field annotations in API client:** Wrap the integration client so each field carries metadata (display name, dashboard URL). Keeps code-centric single source, but mixes concerns.
- **Config service or feature registry:** Store the mapping in a small internal service (key-value or DB) so multiple agents/products share the same source and you can hot-edit via an admin UI.
- **Rules engine:** If feature state depends on combinations of fields, encode rules (e.g., `enabled if flag A && !flag B`). Could be a small CEL/JSON-ruleset evaluated at runtime.
- **Ask-the-dashboard fallback:** If you can't fetch `/integration/:id`, fall back to "how-to" guidance plus a prompt for the user to check the page.

**Clarifying questions**

- Do dashboard paths vary by region/plan or are they stable for all merchants?
- Do any feature states depend on multiple fields or derived logic (e.g., limits > 0 and flag enabled)?
- Should the agent answer when it cannot fetch fresh integration data (e.g., offline mode), and how should it phrase uncertainty?

**Next steps**

1. Confirm scope: list top N features to cover first and any regional/plan variants.
2. Draft the `feature-map.json` (or YAML) and decide where it lives (repo vs config service).
3. Add a resolver function: takes `feature_slug` + integration payload → state object + dashboard path.
4. Wire the agent flow: detect feature → resolve state → pull RAG description → format answer with provenance.

5. **User:** Answers

1) Dashboard paths do not vary by region and is stable for all merchants
2) Some feature states depends on multiple fields
3) if the agent cannot retrieve integration data, it should simply respond with the feature description from the support RAG

1. **Codex:** Given your answers, here's a concrete plan to implement the feature-state KB and agent flow.

**Design**

- Single, global dashboard path per feature (no region branching), so the KB can store one `dashboard_path`.
- Support multi-field logic: store evaluable rules per feature (e.g., CEL/JSON Logic/JS predicate) plus human-readable rationale.
- Fallback rule: if `/integration/:id` is unavailable, answer with RAG description only and mention that live state is unavailable.

**KB shape (YAML or JSON)**

- `slug`, `name`, `synonyms`
- `dashboard_path`
- `state_rules`: ordered list evaluated first-match; each has `when` (predicate over integration fields), `state` (e.g., `enabled`, `disabled`, `partial`), and optional `details` template.
- `fields`: list of field paths used, types, and allowed values for validation/telemetry.
- `description_rag_key`
  Example:

```json
{
  "slug": "transfer-approval",
  "name": "Transfer Approval",
  "synonyms": ["approval flow", "payout approvals"],
  "dashboard_path": "/dashboard/transfers/approvals",
  "fields": [
    { "path": "transfer_approval.enabled", "type": "boolean" },
    { "path": "transfer_approval.level", "type": "enum", "values": ["single", "dual"] },
    { "path": "transfer_approval.min_amount", "type": "number" }
  ],
  "state_rules": [
    {
      "when": "transfer_approval.enabled == true && transfer_approval.level == 'dual'",
      "state": "enabled",
      "details": "Dual approval required for all transfers; min amount {{transfer_approval.min_amount || 'not set'}}."
    },
    {
      "when": "transfer_approval.enabled == true",
      "state": "enabled",
      "details": "Single-approver flow is on."
    },
    {
      "when": "true",
      "state": "disabled",
      "details": "Approvals are off."
    }
  ],
  "description_rag_key": "support:transfer-approval"
}
```

**Runtime flow**

1. Parse user query → map to `slug` via synonyms + embedding fallback.
2. Fetch `/integration/:id`; if success, validate required fields; evaluate `state_rules` (using JSON Logic/CEL/JS predicate).
3. Fetch RAG description via `description_rag_key`.
4. Respond: short what-it-is (from RAG), current state (from rule), where to configure (`dashboard_path`), and confidence/provenance (ontology version + rule matched).
5. If integration fetch fails: return RAG description + "Couldn't fetch live settings right now."

**Why this works**

- Keeps mapping/config in one lightweight, versionable file.
- Rules support multi-field logic without code changes.
- Deterministic evaluation before LLM use reduces hallucinations; LLM only for query → slug mapping and copywriting.

**Implementation notes**

- Choose one rule engine (JSON Logic or CEL) and write a thin evaluator; unit-test each feature's rules with sample integration payloads.
- Add schema validation for KB entries (AJV/Zod) to catch bad paths/values early.
- Cache `/integration/:id` briefly (e.g., 30–60s) to reduce latency; include `data_age` in responses.
- Log which rule fired and the field values used for transparency.

**Suggested next steps**

1. List the first ~10 features to cover and their integration field paths.
2. Pick rule language (JSON Logic vs CEL) and add a small validator/evaluator.
3. Draft `feature-map.json` with those entries and add unit tests per feature (happy/edge paths, missing data).
4. Wire agent tool: `resolveFeatureState(slug, integrationPayload) -> {state, details, dashboard_path, version}` and integrate into the answer composer with the RAG description fallback.

5. **User:** What does description_rag_key do?

6. **Codex:** `description_rag_key` is the pointer from your feature mapping to the support content you'll retrieve via RAG. At runtime, the agent uses this key to query your vector store/search index to pull the canonical "what this feature is" text. It doesn't encode state; it only tells the system which support article/section to fetch so you can add a trustworthy description (and serve a fallback description when live integration data isn't available).

7. **User:** Show me a sketch of the agent tool

8. **Codex:** Here's a concise sketch of the "feature state" agent tool you can drop into `src/common/ai/tools/feature-state.ts` (adjust to your tool framework).

```ts
// feature-state.ts
import { z } from 'zod';
import featureMap from '../data/feature-map.json';
import { fetchIntegration } from '../clients/integration-client';
import { fetchRagDescription } from '../rag/fetch';
import { resolveFeatureSlug } from '../nlp/feature-resolution';
import { evaluateRules } from '../logic/json-logic-runner';

export const featureStateTool = {
  name: 'feature_state',
  description: 'Return what a dashboard feature is, its current state for a merchant, and where to configure it.',
  schema: z.object({
    integrationId: z.string(),
    userQuery: z.string(), // e.g., "transfer approval"
    includeRag: z.boolean().optional().default(true),
  }),
  async run({ integrationId, userQuery, includeRag }) {
    // 1) Map query → feature slug (deterministic synonyms, then embedding fallback)
    const slug = resolveFeatureSlug(userQuery, featureMap);
    if (!slug) return { status: 'unknown_feature', message: 'Feature not recognized.' };

    const feature = featureMap[slug];

    // 2) Fetch integration payload (live state)
    let integration;
    try {
      integration = await fetchIntegration(integrationId);
    } catch (err) {
      integration = null;
    }

    // 3) Evaluate state rules if data available
    let stateBlock = null;
    if (integration) {
      const ruleResult = evaluateRules(feature.state_rules, integration);
      stateBlock = {
        state: ruleResult.state,
        details: ruleResult.details,
        ruleId: ruleResult.id,
        dataAgeSeconds: ruleResult.dataAgeSeconds ?? null,
      };
    }

    // 4) Pull description via RAG key
    const description = includeRag ? await fetchRagDescription(feature.description_rag_key) : null;

    // 5) Compose response
    return {
      status: 'ok',
      feature: {
        slug,
        name: feature.name,
        dashboard_path: feature.dashboard_path,
      },
      state: stateBlock, // null when integration unavailable
      description, // null if includeRag=false
      provenance: {
        ontologyVersion: featureMap._meta?.version,
        ruleEngine: 'json-logic',
        matchedRule: stateBlock?.ruleId ?? null,
      },
    };
  },
};
```

Supporting helpers (sketch):

```ts
// logic/json-logic-runner.ts
import jsonLogic from 'json-logic-js';

export function evaluateRules(rules, payload) {
  for (const rule of rules) {
    if (jsonLogic.apply(rule.when, payload)) {
      return { ...rule, dataAgeSeconds: payload._ageSeconds };
    }
  }
  return { state: 'unknown', details: 'No rule matched', id: null };
}
```

Key points:

- Input: `integrationId`, free-form `userQuery`.
- Resolves feature via synonyms/embeddings, then loads mapping.
- Fetches `/integration/:id`; if that fails, returns description only (state null).
- Evaluates ordered `state_rules` (JSON Logic shown; swap for CEL if preferred).
- Returns dashboard path, state, description, and provenance for transparency.

Natural next steps:

1. Wire `resolveFeatureSlug` with your synonym list + embedding fallback.
2. Add unit tests covering: known feature + enabled/disabled payloads; missing payload (falls back to description); unknown feature.

3. **User:** Can you save this conversation to a file so I can keep it for my review

4. **Codex:** Saved the conversation to `docs/agent-feature-kb-conversation-2025-12-26.md`. Want me to add full (uncondensed) transcript or keep it as is?

5. **User:** I want the full transcript

## Additional Comments (full)

1. **User:** Review my codebase and tailor your approach to match the tools, technologies and patterns

2. **Codex:** Here's a repo-aware plan to add the “feature state” capability while fitting your existing tools, testing, and NestJS patterns:

- Stack fit: AI tools live in `src/common/ai/tools`, built with `tool` from `ai` + Zod schemas; they’re factory-style functions that accept `paystackService` and `getAuthenticatedUser`, perform a JWT guard, then call `PaystackApiService` (`src/common/services/paystack-api.service.ts`). Tests use Jest with mocked `paystackService.get` and `mockToolCallOptions` (`retrieval-tools.spec.ts`, `export-tools.spec.ts`). Page-scoped tool selection is centralized in `src/common/ai/tools/index.ts`. Context injection for pages is handled via `PageContextService` (`src/common/services/page-context.service.ts`) which formats resource data for prompts.

- Implementation shape (keep consistent):
  - Add `createGetFeatureStateTool` in `src/common/ai/tools/feature-state.ts`.
  - Input schema: `{ integrationId: z.string(), feature: z.string(), includeRag?: z.boolean().default(true) }`.
  - JWT guard first (return the same error string used elsewhere).
  - Fetch integration via `paystackService.get('/integration/' + integrationId, jwtToken)`.
  - Resolve the feature via a local KB map (see below); evaluate rules to derive state/details; include `dashboard_path`.
  - Optionally call your RAG client (stub now) using `description_rag_key`.
  - Return a plain object `{ success: true, feature: { slug, name, dashboard_path }, state, description, provenance }`.
  - Export it in `src/common/ai/tools/index.ts` and (if desired) add to `RESOURCE_TOOL_MAP` for global/page use.

- Knowledge base to match repo style:
  - Create `src/common/ai/knowledge/feature-map.ts` exporting a typed map (TypeScript, not JSON, to keep types close). Reuse Zod for validation on load if you want consistency.
  - Shape (from your plan): `slug`, `name`, `synonyms`, `dashboard_path`, `fields`, `state_rules`, `description_rag_key`, `_meta.version`.
  - Rule evaluation: follow your plan’s JSON Logic; place a small helper at `src/common/ai/logic/json-logic-runner.ts`. Keep it stateless and easily mockable.

- Prompt/context alignment:
  - Add a short feature list + “call getFeatureState when asked about feature status/config” to the system prompt area used for global chat (where you configure tools). This mirrors how `PageContextService` preps formatted data without bloating every prompt.

- Tests (mirror existing patterns):
  - New file `src/common/ai/tools/feature-state.spec.ts`.
  - Mock `paystackService.get` to return an integration payload; assert rule matching and dashboard path in the response.
  - Cover: happy path, missing JWT, unknown feature (return `{ status: 'unknown_feature' | error }`), integration fetch failure → description-only fallback, multi-field rule ordering.
  - Keep the `mockToolCallOptions` pattern for consistency.

- Error handling & messaging:
  - Use the same error string for missing JWT as other tools.
  - Catch `paystackService.get` errors and surface `error.message` like existing tools.
  - When integration fetch fails, return `{ success: true, state: null, description: <rag>, message: 'Live settings unavailable' }` to align with your stated fallback.

- Wiring/caching:
  - Keep the `/integration/:id` call on-demand (matches other tools’ lazy fetch).
  - If you add caching, keep it inside the tool module (a simple in-memory TTL) so you don’t alter `PaystackApiService`.

- Type safety:
  - Define a `FeatureStateResult` interface in `src/common/ai/types/feature.ts` to avoid inline `any`.
  - Reuse existing enum style; if integration has enums, declare them in `src/common/ai/types/data.ts` for consistency.

- Next concrete steps (minimal diffs):
  1. Add `feature-map.ts` (typed map + optional Zod validator).
  2. Add `json-logic-runner.ts` helper.
  3. Implement `feature-state.ts` tool with JWT guard, integration fetch, rule eval, RAG stub.
  4. Register tool in `src/common/ai/tools/index.ts`.
  5. Add Jest spec following `retrieval-tools.spec.ts` style.
