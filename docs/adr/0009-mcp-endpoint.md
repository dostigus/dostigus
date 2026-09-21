# ADR 0009: Cluster MCP surface endpoint

- Status: accepted
- Date: 2026-09-21

## Decision

The Cluster MCP surface is `@dostigus/mcp`: registered platform tools with
Zod input schemas and in-process `invoke`. The Host exposes the same tools
over Streamable HTTP JSON at `POST /mcp`. The HTTP endpoint is off until a
Cluster agent token is set (`DOSTIGUS_MCP_TOKEN`, or `NUXT_AGENT_TOKEN` as
an alias). A missing or wrong `Authorization: Bearer` token returns 401.
Host `/api/bots*` routes call `invoke` in the same process (no HTTP hop).

Day-1 tools (stable MCP contract names):

| Tool | Store behavior |
|------|----------------|
| `bots.list` | List Bots, newest first |
| `bots.get` | One Bot by id |
| `bots.create` | Create Bot + greeting |
| `bots.update` | Name and/or Model tier |
| `bots.delete` | Delete Bot (cascade messages) |
| `messages.list` | List Chat lines; ensure greeting |
| `messages.create` | Append `user` \| `assistant` \| `system` |

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) is the contract: Host UI and
Bots share one verb surface. [ADR 0008](0008-host-store-routes.md) allowed
Host Nitro routes to write the Store until that surface existed. This ADR
adds the surface without an LLM tool-calling Chat rewrite, Module package
install format, or domain tools.

The HTTP shape is stateless Streamable HTTP JSON (`initialize`,
`tools/list`, `tools/call`). GET `/mcp` is 405 while the token is set
(no SSE session transport on day-1). A Nuxt MCP module is unnecessary
while the runtime lives in `@dostigus/mcp` and is covered by unit tests.

## Consequences

- `packages/db` stays behind the MCP surface. New Host persistence goes
  through tools.
- Document the token in [`docs/deploy.md`](../deploy.md). Compose does
  not require it.
- Do not add Chat LLM tool-calling, Sheets/Cards UI, email/Secretary
  tools, or Module-package install in this slice.
- LLM gateway settings remain Host routes (not platform tools yet).

## Alternatives

- `@nuxtjs/mcp-toolkit` file-based tools only — rejected as the source of
  truth; Host routes and tests need the same in-process registry.
- Leave `/api/bots*` on direct Drizzle — rejected; one code path.
- OAuth on `/mcp` — rejected; Cluster agent token is enough until
  Household/auth exists.
