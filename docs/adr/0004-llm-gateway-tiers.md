# ADR 0004: LLM gateway and model tiers

- Status: accepted
- Date: 2026-09-21
- Amended: 2026-09-24
- Amended: 2026-09-24 — Chat history window and system prompt assembly are [ADR 0032](0032-chat-llm-context-assembly.md). This record still owns the gateway, tiers, and retry.
- Amended: 2026-09-25 — Triggering-line image Artifact vision (OpenAI content parts) is [ADR 0035](0035-image-artifact-vision.md). This record still owns the gateway, tiers, and transient retry.
- Amended: 2026-09-25 — Binding, resolve, and escalate are [ADR 0036](0036-llm-providers-tier-resolve-escalate.md). This record still owns the OpenAI-compatible gateway shape and transient *same-model* retry (timeout / abort / network / HTTP 429 / HTTP 5xx on that one completion). Escalate is an upshift of Model tier / Provider after a soft or hard failure. [ADR 0036](0036-llm-providers-tier-resolve-escalate.md) supersedes the sentence that free / random model roulette is toy only: OpenRouter Policy `free` is allowed on `cheap` and `toy` for casual.
- Amended: 2026-09-25 — OpenRouter Settings catalog, quality shelf, and Advanced pin stay [ADR 0036](0036-llm-providers-tier-resolve-escalate.md). This record still owns the gateway shape and the same-model retry.

## Decision

The Cluster owns an LLM gateway. Users bring keys (OpenRouter, Anthropic,
OpenAI, Ollama). Calls are routed by tier: `cheap` | `strong` | `code`.
MCP Bots pin mid/`strong`. Free/random model roulette is toy only.
([ADR 0036](0036-llm-providers-tier-resolve-escalate.md) **supersedes**
that last sentence: OpenRouter Policy `free` on `cheap` and `toy` is
allowed for casual. Bind, resolve, and escalate live there. This record
still owns the OpenAI-compatible shape and the same-model transient
retry.)
The chat Bot is not the Builder that writes Module packages.

## Context

A self-host OS cannot bake in a vendor. Tiers keep cost/quality knobs stable
when providers change. Mixing “write me a module” into the chat Bot would
blur runtime and authoring.

## Consequences

- Glossary term is **LLM gateway**; do not rename it per provider.
- Tier names stay `cheap`, `strong`, `code` — no “fast/smart/opus” aliases.
- Builder Jobs (if any) are a later, separate path — out of this MVP.
- The Host Chat path calls an OpenAI-compatible LLM gateway
  (`POST {base}/chat/completions`) with a bounded history window and a
  system prompt (Manifest including label and description, Skill
  catalog, stay-on-Manifest / reply-briefly). Assembly is
  [ADR 0032](0032-chat-llm-context-assembly.md). The triggering user
  message may use OpenAI content parts (`text` + `image_url`) when
  that line has image Artifacts
  ([ADR 0035](0035-image-artifact-vision.md)). When a key is set,
  that call includes Cluster MCP surface tools and a short tool loop
  ([ADR 0011](0011-chat-mcp-tool-loop.md)).
- Cluster settings live in the Store (`llm_gateway`: base URL, key
  server-side only, default Model tier, optional model overrides). The
  Owner can set them in Host Settings. Env vars remain override/bootstrap
  for compose (`OPENAI_COMPATIBLE_BASE_URL`, `LLM_API_KEY` /
  `OPENROUTER_API_KEY`, optional `LLM_MODEL` / `LLM_MODEL_*`).
- Default model ids are OpenRouter-friendly (`strong` → `openai/gpt-4o`,
  `cheap` / `toy` → `openai/gpt-4o-mini`, `code` → `openai/gpt-4o`) and
  overridable. A key with no base URL uses
  `https://openrouter.ai/api/v1`.
- No key: Chat still works; replies are stubs and Chat shows a quiet
  banner. Configured but failed: persist a clear error, do not stub.
  Chat retries that one completion when the failure is transient
  (timeout, abort, network, HTTP 429, or HTTP 5xx). HTTP 429 waits
  about 600ms first. Activity stays on thinking; the error bubble
  appears only after that retry is exhausted and after
  [ADR 0036](0036-llm-providers-tier-resolve-escalate.md) escalate
  is exhausted. HTTP 401, HTTP 403,
  other 4xx, and a successful response with empty assistant text are
  not retried on the **same** model (empty and a later Provider may
  still escalate — [ADR 0036](0036-llm-providers-tier-resolve-escalate.md)). The bubble is Russian. The Owner is told to check the
  key in Settings (auth and other non-retry 4xx), to send the line
  again after a transient miss (Settings only if it keeps failing),
  or to write again after an empty body. A Member is pointed at the
  Owner for a key problem and can still send again after a transient
  miss. Logs may name the status class and must not include the key,
  headers, or provider body.
- Never echo the full key to the client or logs (mask last four).
- Types and mapping live in `packages/shared`.

## Alternatives

- Hard-code one vendor SDK — rejected; fights self-host and user keys.
- Unlimited free-tier routing for production Bots — rejected; toy only.
  ([ADR 0036](0036-llm-providers-tier-resolve-escalate.md) supersedes
  this for casual OpenRouter Policy `free` on `cheap` and `toy`.
  Host-picked “best free slug” every call stays later.)
- Retry HTTP 401 or an empty body — rejected. A bad key will not
  succeed on the second try, and an empty body is a finished response
  on that model. Escalate after empty is
  [ADR 0036](0036-llm-providers-tier-resolve-escalate.md), not this
  retry.
- A Retry control in the composer — rejected for this slice. One
  automatic retry plus the bubble text is the next step.
