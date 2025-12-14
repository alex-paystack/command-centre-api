## Page-Scoped Chat: Implementation Plans

Two variants: (A) robust with actions, (B) informational-only. Both share foundational pieces (page context plumbing, prompt injection, history scoping).

### Shared Foundations

- **Conversation scoping:** Ensure `conversation.pageKey` is required for page mode; enforce single active conversation per `(userId, pageKey)` or reuse the latest.
- **DTOs:** Extend `ChatRequestDto` with `mode: 'page' | 'global'` (default global) and `pageContext` object `{ resourceType, resourceId, pageKey, facts: Record<string, string | number | boolean>, contextVersion?: string }`.
- **Context builder/service:** Add `PageContextService` to normalize `pageContext`, redact sensitive fields, derive a concise summary string, and compute `contextHash` (e.g., SHA256 of normalized facts).
- **Prompt preamble:** Prepend a short system message for page mode: resource id/type + bullet facts + scope reminder. Keep <300 tokens.
- **History limit:** Keep existing `MESSAGE_HISTORY_LIMIT`; optionally tighten for page mode if prompt grows.
- **Persistence (optional but recommended):** Store `page_context` (normalized facts + summary + hash + lastUpdated) on the conversation. Refresh when incoming hash/version differs.
- **Caching (shared):**
  - Cache key: `pageContext:{resourceType}:{resourceId}:{contextHash}`.
  - Store: normalized summary and redacted facts. TTL aligned with business freshness (e.g., 5–15 min) plus immediate invalidation on hash change.
  - Invalidation triggers: client sends new `contextVersion`/hash, Paystack webhook on resource update, or explicit client "refresh" flag.
  - Avoid caching sensitive raw payload; cache only redacted/normalized summary.
- **Safety:** Classifier gains `OUT_OF_SCOPE_PAGE` intent to remind scope; refuse if `pageContext` missing in page mode.
- **Analytics/observability:** Tag conversations and messages with `mode` and `pageKey`; log context hash for repro.
- **Testing:** Unit tests for `PageContextService` normalization/hash, classifier branch, prompt builder token budget; integration tests for chat flow with/without refreshed context.

---

### Plan A — Robust (Actions Enabled)

1. **Data model**
   - Extend conversation table/entity: `page_context JSONB`, `context_hash TEXT`, `page_mode BOOLEAN` (or `mode ENUM`).
   - (Optional) `allowed_actions TEXT[]` if you want server-side enforcement.
2. **DTOs & validation**
   - `ChatRequestDto`: add `pageContext`, `mode`, `actions?: string[]`.
   - Validate `pageContext` presence when `mode === 'page'`; ensure resource ids are non-empty; limit facts size.
3. **Context service**
   - `PageContextService.normalize(dto.pageContext)` → `{factsNormalized, summary, contextHash, lastUpdated}`.
   - Redact PII (emails, PAN, phone); cap numeric precision; truncate strings.
4. **Caching & persistence**
   - On each turn: compute hash; if different from stored, refresh cache + persist to conversation; else reuse cached summary.
   - Allow optional "forceRefresh" flag from client to bypass TTL.
5. **Prompting**
   - Build system message: global policy + page preamble + allowed actions bullet list.
   - Add safety rule: only perform actions listed; otherwise explain inability.
6. **Tools/actions**
   - Introduce narrow tools: `getTransactionById`, `refundTransaction`, `verifyTransaction`, etc. Tools should accept `resourceId` only; use server-side auth (jwt) and check `allowed_actions`.
   - Register two tool sets: `toolsPage` (restricted) and `toolsGlobal` (existing). Pick based on mode.
7. **Service flow (ChatService)**
   - Branch on `mode === 'page'`: build page preamble, select `toolsPage`, tighten `stepCount` if needed.
   - Persist messages and refreshed `page_context`.
   - Handle `OUT_OF_SCOPE_PAGE` refusal before tool use.
8. **Client**
   - Send `pageContext` + optional `actions` each turn; include `contextVersion`/hash from latest page data; surface "refresh context" button if data changes.
9. **Tests**
   - Mock Paystack service for actions; ensure unauthorized action prompts a refusal; ensure cached summary reused when hash unchanged.

### Plan B — Informational-Only (No Actions)

1. **Data model**
   - Can skip `allowed_actions`; may still store `page_context`, `context_hash`, `mode`.
2. **DTOs**
   - `pageContext` and `mode` only. No `actions`.
3. **Context service**
   - Same normalization/redaction/hash; summary-focused (no action list).
4. **Caching**
   - Same hash-based cache/persist; TTL can be longer (data is informational). Still invalidate on hash change.
5. **Prompting**
   - Page preamble with facts; explicit instruction: "Do not perform actions; provide information/analysis only."
6. **Tools**
   - You may disable tools entirely for page mode, or keep read-only fetchers (`getTransactionById`) to answer with fresh data; no mutating tools.
7. **Service flow**
   - Single `streamText` call; choose tools (read-only or none) and preamble based on mode; reuse shared saving logic.
8. **Client**
   - Always send `pageContext` per turn; optional `contextVersion` to avoid server recompute if unchanged.
9. **Tests**
   - Ensure refusal when `pageContext` missing in page mode; ensure responses stay scoped; verify cache reuse when hash unchanged.

### Caching Details (both plans)

- **What to cache:** normalized redacted facts + pre-rendered summary string.
- **Where:** in-memory (Nest cache module) keyed by hash + optional Redis for multi-instance deployments.
- **TTL:** informational 10–30 min; action-capable 5–15 min depending on transaction volatility.
- **Invalidation:** new `contextHash`, explicit refresh flag, or webhook-driven invalidation per `resourceId`.
- **Protection:** never cache raw PII; enforce max fact size; include `mode` in key to prevent cross-mode reuse.
- **Observability:** log cache hits/misses with `pageKey`, `resourceId`, `contextHash`; emit metric for "stale context used".
