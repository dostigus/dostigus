# ADR 0008: Host Store routes for Bots and Chat

- Status: accepted
- Date: 2026-09-21

## Decision

The Host keeps Nitro URLs for Bots, Chat, and Cluster LLM gateway settings
(`/api/bots`, `/api/bots/:id/messages`, `/api/settings/llm-gateway`).
`/api/bots*` is not a public Bot API and not a second contract for Sheets.
Those Bot and Chat routes invoke the platform MCP surface in-process
([ADR 0009](0009-mcp-endpoint.md)). LLM gateway settings stay Host-only
until a later tool slice.

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for the
Bot and the Host UI. Persistence landed before the MCP surface
(`/api/bots*` wrote `@dostigus/db` directly). The surface now exists;
the URLs remain as a Host exception so the current UI does not change.

## Consequences

- `@dostigus/db` opens `DATABASE_URL` and applies Store migrations on Host
  start.
- Do not add a seed/demo domain Bot (no packaged Secretary / Notes / Meal).
- New Host code prefers `invoke` / `callPlatformTool`, not new Drizzle
  queries. Do not grow a parallel REST model for Sheets or Module packages.
- LLM gateway calls stay behind the Host message route. Settings persist
  in the Store; env is override/bootstrap. The GET/PUT settings body never
  includes the full key. See [ADR 0004](0004-llm-gateway-tiers.md).

## Alternatives

- Wait for MCP before any persistence — rejected; Chat would not survive
  refresh or compose restart.
- Direct Drizzle from Vue — rejected; the Host server owns the Store.
- Drop `/api/bots*` when MCP lands — rejected for this slice; the Host UI
  still uses those URLs.
