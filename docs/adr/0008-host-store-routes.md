# ADR 0008: Host Store routes for Bots and Chat

- Status: accepted
- Date: 2026-09-21

## Decision

Until the MCP surface exists, the Host persists Bots and Chat through Nitro
server routes (`/api/bots`, `/api/bots/:id/messages`) that write the Cluster
Store (`@dostigus/db`, Drizzle schema + SQLite). These routes are Host
internals, not a public Bot API and not a second contract for Sheets.

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for the
Bot and the Host UI. The MCP surface is still out of scope. Nick's day-1
path is: create a Bot, open Chat, persist messages. Blocking that on MCP
would leave the Host a stub.

## Consequences

- `@dostigus/db` opens `DATABASE_URL` and applies Store migrations on Host
  start.
- Do not add a seed/demo domain Bot (no packaged Secretary / Notes / Meal).
- When the MCP surface lands, these routes should call the same tools;
  do not grow a parallel REST model for Sheets or Module packages.
- LLM gateway calls stay behind the Host message route (optional; stub if
  unset). See [ADR 0004](0004-llm-gateway-tiers.md).

## Alternatives

- Wait for MCP before any persistence — rejected; Chat would not survive
  refresh or compose restart.
- Direct Drizzle from Vue — rejected; the Host server owns the Store.
