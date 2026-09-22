# ADR 0008: Host Store routes for Bots and Chat

- Status: accepted
- Date: 2026-09-21

## Decision

The Host persists Bots, Chat, and Cluster LLM gateway settings through
Nitro server routes (`/api/bots`, `/api/bots/:id/messages`,
`/api/settings/llm-gateway`) that write the Cluster Store
(`@dostigus/db`, Drizzle schema + SQLite). Bot and Chat routes call the
same Store helpers as the MCP surface ([ADR 0009](0009-mcp-toolkit-endpoint.md)).
These routes are Host internals, not a public Bot API and not a second
contract for Sheets. Bot writes and Settings require an Owner session
([ADR 0010](0010-owner-auth-session.md)). Bot reads and Chat also accept a
Member session ([ADR 0012](0012-household-members.md)).

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for the
Bot and the Host UI. The MCP surface now exists ([ADR 0009](0009-mcp-toolkit-endpoint.md)).
Nick's day-1 path is: create a Bot, open Chat, persist messages. These
routes remain so the Host UI and Chat LLM completion do not depend on
the MCP token. They depend on a Host cookie session. Bot writes and
Settings stay with the Owner.

## Consequences

- `@dostigus/db` opens `DATABASE_URL` and applies Store migrations on Host
  start.
- Do not add a seed/demo domain Bot (no packaged Secretary / Notes / Meal).
- Bot and Chat routes share Store helpers with MCP tools; do not grow a
  parallel REST model for Sheets or Module packages. See
  [ADR 0009](0009-mcp-toolkit-endpoint.md).
- LLM gateway calls stay behind the Host message route. When a key is
  set, that route invokes the same MCP tool handlers in-process
  ([ADR 0011](0011-chat-mcp-tool-loop.md)). Settings persist in the Store;
  env is override/bootstrap. The GET/PUT settings body never includes the
  full key. See [ADR 0004](0004-llm-gateway-tiers.md).
- Bot list, Bot read, and Chat accept an Owner or Member session. Bot
  create, update, and delete, and `/api/settings/*`, stay with the Owner.
  See [ADR 0010](0010-owner-auth-session.md) and
  [ADR 0012](0012-household-members.md). `/mcp` stays token-gated.

## Alternatives

- Wait for MCP before any persistence — rejected; Chat would not survive
  refresh or compose restart.
- Direct Drizzle from Vue — rejected; the Host server owns the Store.
