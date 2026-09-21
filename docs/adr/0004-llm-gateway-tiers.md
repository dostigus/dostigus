# ADR 0004: LLM gateway and model tiers

- Status: accepted
- Date: 2026-09-21

## Decision

The Cluster owns an LLM gateway. Users bring keys (OpenRouter, Anthropic,
OpenAI, Ollama). Calls are routed by tier: `cheap` | `strong` | `code`.
MCP Bots pin mid/`strong`. Free/random model roulette is toy only.
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
  (`POST {base}/chat/completions`) with conversation history and a system
  prompt (new Bot, learn purpose, keep the Manifest).
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
- Never echo the full key to the client or logs (mask last four).
- Types and mapping live in `packages/shared`.

## Alternatives

- Hard-code one vendor SDK — rejected; fights self-host and user keys.
- Unlimited free-tier routing for production Bots — rejected; toy only.
