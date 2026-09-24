# ADR 0011: Chat ↔ MCP tool loop

- Status: accepted
- Date: 2026-09-21
- Amended: 2026-09-24

## Decision

When the Cluster LLM gateway has a key, Host Chat calls an OpenAI-compatible
`chat/completions` endpoint with Cluster MCP surface tools. The model may
call those tools in a short loop. Tool results go back to the model. The
final assistant text is stored on the same Store path as the Host UI and
`/mcp`.

Chat invokes the **same tool handlers** registered for `@nuxtjs/mcp-toolkit`
**in-process**. It does not HTTP-call localhost `/mcp`. A Host session
gates the message route; the MCP Bearer token is not used. A Member
session receives only the message tools
([ADR 0012](0012-household-members.md)).

`dostigus_bots_delete` stays on `/mcp` and the Host Delete control. It is
not exposed to Chat.

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for the
Bot and the Host. [ADR 0009](0009-mcp-toolkit-endpoint.md) registered file-based
tools at `/mcp` and rejected Host UI calling the toolkit through the token
gate. [ADR 0004](0004-llm-gateway-tiers.md) already sends Chat history to the
LLM gateway. Without tools, a configured Bot could not read or write Cluster
data.

## Consequences

- Day-1 Chat tools: `dostigus_bots_list` / `get` / `create` / `update` and
  `dostigus_messages_list` / `create`. Zod shapes map to OpenAI function
  schemas.
- Cap tool-call rounds (`CHAT_MCP_TOOL_MAX_ITERATIONS`, 6), then one
  text-only completion. Unknown tools (including delete) are skipped; the
  model receives error content. Logs are `Chat MCP tool <name> ok|fail|skip`
  with no secrets or arguments.
- No key: stub reply, no tools, same as ADR 0004.
- Configured but failed: persist a clear error, not a stub. A transient
  failure retries that one completion, not the tool loop, so a tool
  that already ran is not applied again. Activity stays on thinking
  for the retry. See [ADR 0004](0004-llm-gateway-tiers.md).
- Reply `via` may be `llm+tools`. Host Chat may show a quiet “Used Cluster
  tools” line. Host Bot list and Chat stay consistent because they share
  the Store.
- `/mcp` Bearer auth is unchanged ([ADR 0009](0009-mcp-toolkit-endpoint.md),
  [ADR 0010](0010-owner-auth-session.md)).
- Today a Member Chat session may call only `dostigus_messages_list`
  and `dostigus_messages_create`. The Owner keeps the Chat tool list
  above. See [ADR 0012](0012-household-members.md).
  [ADR 0028](0028-bot-self-settings-via-chat.md) changes that
  allowlist: the creator and the Owner, including a Member on a Bot
  they created, receive `dostigus_bots_update` and Skills tools. A
  grantee stays without those tools. Schedule tools stay
  [ADR 0027](0027-bot-schedules.md).

## Alternatives

- HTTP-call `/mcp` from Chat — rejected; same-process loop, token gate, and
  extra hop.
- Custom agent runtime (Effect, Mastra, or similar) — rejected; stay on the
  OpenAI-compatible gateway.
- Expose delete to Chat — rejected; high-friction Host UI is enough.
