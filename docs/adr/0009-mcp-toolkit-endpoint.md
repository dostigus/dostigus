# ADR 0009: MCP toolkit endpoint

- Status: accepted
- Date: 2026-09-21

## Decision

The Cluster MCP surface is served by the Host at `/mcp` via
`@nuxtjs/mcp-toolkit`. Tools are file-based under
`apps/web/server/mcp/tools/` with Zod schemas. Bearer `NUXT_AGENT_TOKEN`
(or alias `DOSTIGUS_MCP_TOKEN`) gates tools. An empty token leaves tools
disabled. Host `/api/bots*` and the MCP tools call the same Cluster Store
helpers. Do not add a custom MCP SDK.

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for
the Bot and the Host UI. [ADR 0008](0008-host-store-routes.md) let the
Host persist Bots and Chat through Nitro routes until that surface
existed. Woodlands and Meal already use the toolkit (Nuxt module,
`server/mcp/tools`, `/mcp`, `NUXT_AGENT_TOKEN`). In-process invoke of
file-based tools from Host routes is awkward (the token gate would hide
them from the UI), so a shared Store service is the one code path.

## Consequences

- Platform tools wrap Store data: Bots list/get/create/update/delete and
  Chat messages list/append.
- Soft Bearer auth: do not throw 401 from `/mcp` (clients treat it as
  OAuth). Tools use `enabled` after middleware sets `event.context.agentOk`.
- The Host UI does not need the token. Household auth is still out of
  scope.
- Cursor / IDE clients are not same-origin; `allowedOrigins` is `*`.
- LLM tool-calling in Chat, Sheets/Cards UI, Module package install, and
  MCP Apps widgets stay out of scope.

## Alternatives

- Custom MCP SDK — rejected; a second stack from Woodlands/Meal.
- Host routes invoke toolkit tools in-process — rejected; the token gate
  would disable Host UI, and the toolkit is request-shaped.
- Wait for Module packages to ship tools — rejected; Platform tools wrap
  the Store now.
