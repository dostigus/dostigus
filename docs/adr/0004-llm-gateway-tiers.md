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
- Gateway is not implemented in the first scaffold; the types live in
  `packages/shared`.

## Alternatives

- Hard-code one vendor SDK — rejected; fights self-host and user keys.
- Unlimited free-tier routing for production Bots — rejected; toy only.
