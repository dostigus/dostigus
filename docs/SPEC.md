# Dostigus — MVP spec

Product: **self-host agent OS** — portable bot packages + host UI sheets.

This spec is the day-1 / first-scaffold contract. Architecture decisions are in
[`docs/adr/`](adr/). Glossary: [`CONTEXT.md`](../CONTEXT.md).

## In scope (platform direction)

Settled now, even if this repo only scaffolds them:

| Area | Intent |
|------|--------|
| Platform git | Git holds the Dostigus monorepo only. See [ADR 0001](adr/0001-platform-git-vs-in-cluster-bot-packages.md). |
| In-cluster packages | Cluster Store holds Manifests, Module packages, data. Export/import between Clusters. |
| Host | One app: Chat + Cards + Sheets from the Kit. See [ADR 0002](adr/0002-host-ui-kit-and-sheets.md). |
| MCP surface | Store and UI go through the same tools. See [ADR 0003](adr/0003-mcp-as-bot-store-contract.md). |
| LLM gateway | User keys; Model tiers `cheap` \| `strong` \| `code` (plus `toy`). See [ADR 0004](adr/0004-llm-gateway-tiers.md). |
| Self-host first | `docker compose up` is the intended path. See [ADR 0005](adr/0005-self-host-first.md). |
| Declarative modules | SQL + templated MCP before arbitrary sandbox. See [ADR 0006](adr/0006-day-1-declarative-modules.md). |
| Cluster store | Drizzle + SQLite day-1 (Postgres later is fine). |
| Pilot shape | Meal-like loop later: Chat → Card → Sheet via MCP. Not a Meal port. Day-1 is create Bot + Chat only. |

## This Host (create Bot + Chat)

What the running Cluster does today:

- Store (`@dostigus/db`): Drizzle schema + SQLite on `DATABASE_URL`. Tables
  `bots` (name, Manifest: `modelTier` default `strong`, empty skills/modules),
  `messages` (`botId`, role `user` \| `assistant` \| `system`, content), and
  `llm_gateway` (Cluster LLM gateway: base URL, key server-side only,
  default Model tier, optional model overrides). Host opens and migrates
  the Store on start.
- Host UI: Bot list (empty state + `+` create, default name **New Bot**),
  Chat (timeline + composer), and Settings (LLM gateway). Creating a Bot
  (or first open) stores an assistant greeting that asks what the Bot is
  for. Host font is Nunito; dark charcoal + coral-orange tokens
  ([`docs/ui.md`](ui.md)).
- MCP surface (`@dostigus/mcp`): platform tools `bots.list` / `bots.get` /
  `bots.create` / `bots.update` / `bots.delete` / `messages.list` /
  `messages.create` wrap the Store. Host server code invokes them
  in-process. HTTP MCP is `POST /mcp` (Streamable HTTP JSON), off until
  `DOSTIGUS_MCP_TOKEN` or `NUXT_AGENT_TOKEN` is set. See
  [ADR 0009](adr/0009-mcp-endpoint.md).
- Host routes: `/api/bots` CRUD and `/api/bots/:id/messages` list/post
  call the same tools (ADR 0008 exception, still Host-only URLs).
  `/api/settings/llm-gateway` get/put/ping stays a Host route. Persist
  in SQLite.
- LLM gateway: OpenAI-compatible client, Model tiers mapped to
  OpenRouter-friendly default model ids. The Owner sets base URL + key in
  Host Settings (Store) or via compose env (env overrides Store). Chat
  sends greeting + history and a system prompt (new Bot, learn purpose,
  keep Manifest). No key → stub reply + quiet banner. Configured call
  that fails → clear error, not a stub. The full key is never returned
  to the client or written to logs. Greeting is always stored. Keys are
  **not** required for compose.
- `/health` stays `{ ok: true }`.
- No seed/demo domain Bot. No Builder, Household, or Meal. Chat does not
  yet call tools via the LLM (next slice).

`pnpm install` and `pnpm check` must stay green.

## Self-host (compose)

`docker compose -f docker/compose.yml up --build` serves the Host on port 3000
and mounts volume `cluster-data` for the Store. Image publishing is
`ghcr.io/dostigus/dostigus` (see [ADR 0007](adr/0007-platform-image-tags.md)
and [`docs/deploy.md`](deploy.md)).

## Out of scope (do not implement yet)

- Full agent runtime (parity with Grok Bot or otherwise)
- Meal product port
- Builder that writes Module packages (chat Bot ≠ Builder)
- Marketplace
- Auth / Household (multi-user)
- Mobile native
- Per-bot domains (the `meal.kosarev.space` pattern is temporary and to be replaced)
- Arbitrary in-cluster sandbox code
- Managed/cloud hosting (optional later; not the default)

## Success for later MVPs (not this PR)

A self-hosted Cluster that can install a declarative Bot, chat with it, and open
a Sheet that reads/writes through the same MCP surface.
