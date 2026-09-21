# Dostigus — MVP spec

Product: **self-host agent OS** — portable bot packages + host UI sheets.

This spec is the day-1 / first-scaffold contract. Architecture decisions are in
[`docs/adr/`](adr/). Glossary: [`CONTEXT.md`](../CONTEXT.md).

## In scope (platform direction)

Settled now, even if this repo only scaffolds them:

| Area | Intent |
|------|--------|
| Platform git | Git holds the Dostigus monorepo only. See [ADR 0001](adr/0001-platform-git-vs-in-cluster-bot-packages.md). |
| In-cluster Bot packages | Cluster store holds manifests, Module packages, data, media/notes. Export/import between Clusters. |
| Host shell | One app: chat + inline cards + Sheets from a shared UI kit. See [ADR 0002](adr/0002-host-ui-kit-and-sheets.md). |
| MCP contract | Storage and UI go through the same MCP surface. See [ADR 0003](adr/0003-mcp-as-bot-store-contract.md). |
| LLM gateway | User keys; tiers `cheap` \| `strong` \| `code`. See [ADR 0004](adr/0004-llm-gateway-tiers.md). |
| Self-host first | `docker compose up` is the intended path. See [ADR 0005](adr/0005-self-host-first.md). |
| Declarative modules | SQL + templated MCP before arbitrary sandbox. See [ADR 0006](adr/0006-day-1-declarative-modules.md). |
| Cluster store | Drizzle + SQLite day-1 (Postgres later is fine). |
| Pilot shape | Meal-like loop: chat → card → Cook/Shopping Sheet via MCP. Not a Meal port. |

## This scaffold (first PR)

Lean monorepo + spec docs only:

- `CONTEXT.md`, this SPEC, ADRs, `AGENTS.md`, Cursor spec-driven rule
- pnpm workspace: `apps/*`, `packages/*`
- `apps/web` — Nuxt 4 Host shell stub (chat empty state + Sheet empty state)
- `packages/ui-kit`, `packages/db`, `packages/shared` — placeholders
- `docker/compose.yml` — self-host intent stub
- MIT license, expanded README

`pnpm install` and `pnpm check` must stay green.

## Out of scope (do not implement yet)

- Full agent runtime (parity with Grok Bot or otherwise)
- Meal product port
- Cloud-agent Module package writer (chat Bot ≠ authoring agent)
- Marketplace
- Auth / Household (multi-user)
- Mobile native
- Per-bot domains (the `meal.kosarev.space` pattern is temporary and to be replaced)
- Arbitrary in-cluster sandbox code
- Managed/cloud hosting (optional later; not the default)

## Success for later MVPs (not this PR)

A self-hosted Cluster that can install a declarative Bot, chat with it, and open
a Sheet that reads/writes through the same MCP contract.
