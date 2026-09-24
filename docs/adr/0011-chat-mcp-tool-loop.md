# ADR 0011: Chat ↔ MCP tool loop

- Status: accepted
- Date: 2026-09-21
- Amended: 2026-09-24
- Amended: 2026-09-24 — Chat tool allowlists are slim + keyword expand, plus `dostigus_skills_read`. The lists, Wake divergence, and expand keywords are [ADR 0032](0032-chat-llm-context-assembly.md). The in-process loop, cap, and retry stay this record.

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
not exposed to Chat. `dostigus_turns_list` and `dostigus_turns_get` stay
on `/mcp` as well. They are not Chat tools
([ADR 0029](0029-turn-journal.md)).

## Context

[ADR 0003](0003-mcp-as-bot-store-contract.md) keeps one verb surface for the
Bot and the Host. [ADR 0009](0009-mcp-toolkit-endpoint.md) registered file-based
tools at `/mcp` and rejected Host UI calling the toolkit through the token
gate. [ADR 0004](0004-llm-gateway-tiers.md) already sends Chat history to the
LLM gateway. Without tools, a configured Bot could not read or write Cluster
data.

## Consequences

- Day-1 Chat tools start slim (messages, Schedule writes, timezone
  get, Host HTTP get, Skills list and read). Manifest write, Skill
  write, timezone set, and allowlist tools wait for keyword expand
  on that user turn. The lists are
  [ADR 0032](0032-chat-llm-context-assembly.md). Zod shapes map to
  OpenAI function schemas.
- Cap tool-call rounds (`CHAT_MCP_TOOL_MAX_ITERATIONS`, 6), then one
  text-only completion. Unknown tools (including delete) are skipped; the
  model receives error content. Logs are `Chat MCP tool <name> ok|fail|skip`
  with no secrets or arguments. The same loop appends `{ name, ok, ms }`
  onto the open Turn ([ADR 0029](0029-turn-journal.md)). It does not
  append arguments or results.
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
- Member and Owner Chat allowlists are
  [ADR 0032](0032-chat-llm-context-assembly.md). A grantee gets
  messages, that person's Schedule tools, timezone get, Host HTTP
  get, and Skills list/read — no expand to Manifest or Skill write.
  A creator Member starts on the same slim as the Owner and expands
  to `dostigus_bots_update` plus Skills upsert/delete. The Owner
  expand also adds Bots list/get/create/update, timezone set, and
  allowlist get/set. See [ADR 0012](0012-household-members.md) and
  [ADR 0028](0028-bot-self-settings-via-chat.md). Schedule tools stay
  [ADR 0027](0027-bot-schedules.md). This loop does not gain a Module
  catalog tool, an Apply tool, or Weather tools. This monorepo ships
  no stock package ([ADR 0030](0030-chat-cards-module-catalog.md)).

## Alternatives

- HTTP-call `/mcp` from Chat — rejected; same-process loop, token gate, and
  extra hop.
- Custom agent runtime (Effect, Mastra, or similar) — rejected; stay on the
  OpenAI-compatible gateway.
- Expose delete to Chat — rejected; high-friction Host UI is enough.
