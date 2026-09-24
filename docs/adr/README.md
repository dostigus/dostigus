# Architecture decision records

Read this index before changing the Platform. Glossary:
[`CONTEXT.md`](../../CONTEXT.md). Scope: [`docs/SPEC.md`](../SPEC.md).

**Next number = max + 1.** The highest file is ADR 0033, so the next ADR
is **0034**. Name it `0034-short-kebab-title.md` (four digits). When you
add a record, add a row here and set the next number to that file’s
number plus one.

## Usual headings

```
# ADR NNNN: Title

- Status: accepted
- Date: YYYY-MM-DD

## Decision

## Context

## Consequences

## Alternatives
```

`Status` and `Date` sit above those four headings. Write the record in
English.

## Index

| ADR | Title |
| --- | --- |
| [0001](0001-platform-git-vs-in-cluster-bot-packages.md) | Platform git vs in-cluster bot packages |
| [0002](0002-host-ui-kit-and-sheets.md) | Host UI kit and Sheets |
| [0003](0003-mcp-as-bot-store-contract.md) | MCP as the Bot ↔ store contract |
| [0004](0004-llm-gateway-tiers.md) | LLM gateway and model tiers (amended 2026-09-24: one transient retry, Russian error copy; Chat assembly [0032](0032-chat-llm-context-assembly.md)) |
| [0005](0005-self-host-first.md) | Self-host first |
| [0006](0006-day-1-declarative-modules.md) | Day-1 declarative modules (before arbitrary sandbox) |
| [0007](0007-platform-image-tags.md) | Platform image tags |
| [0008](0008-host-store-routes.md) | Host Store routes for Bots and Chat |
| [0009](0009-mcp-toolkit-endpoint.md) | MCP toolkit endpoint |
| [0010](0010-owner-auth-session.md) | Owner auth and Host session |
| [0011](0011-chat-mcp-tool-loop.md) | Chat ↔ MCP tool loop (amended 2026-09-24: retry one completion, not the tool loop; slim + expand [0032](0032-chat-llm-context-assembly.md)) |
| [0012](0012-household-members.md) | Household Members on the Host (Bot visibility: [0024](0024-threads-and-bot-visibility.md)) |
| [0013](0013-kit-reka-ui-and-brand.md) | Kit on Reka UI, Sheet shell, and Brand |
| [0014](0014-host-messenger-shell.md) | Host messenger shell |
| [0015](0015-host-desktop-shell.md) | Host desktop shell |
| [0016](0016-bot-avatar-tokens.md) | Bot avatar tokens |
| [0017](0017-goose-mark-avatar.md) | Goose mark avatar + hue-ordered palette (superseded by [0018](0018-bot-mark-flock.md)) |
| [0018](0018-bot-mark-flock.md) | Bot marks — an eight-bird flock with named parts |
| [0019](0019-bot-picker-and-chat-purpose.md) | Bot picker and Chat purpose |
| [0020](0020-bot-closet.md) | Bot closet (amended 2026-09-24: «Расписания» block) |
| [0021](0021-chat-activity-status.md) | Chat activity status row (amended 2026-09-24: thinking, tool, typing; status-line sweep) |
| [0022](0022-chat-assistant-markdown.md) | Chat assistant Markdown body |
| [0023](0023-household-member-invites.md) | Household Member Invites (an Invite does not grant Bots; [0024](0024-threads-and-bot-visibility.md)) |
| [0024](0024-threads-and-bot-visibility.md) | Threads and Bot visibility (amended 2026-09-24: personal Bot + grants) |
| [0025](0025-chat-bubble-parts.md) | Chat bubble parts (Bot visibility stays [0024](0024-threads-and-bot-visibility.md)) |
| [0026](0026-kitchen-module-day-1.md) | Kitchen Module day-1 |
| [0027](0027-bot-schedules.md) | Host Bot Schedules (amended 2026-09-24: closet list, create/detail Sheets; Wake tools [0032](0032-chat-llm-context-assembly.md)) |
| [0028](0028-bot-self-settings-via-chat.md) | Bot self-settings via Chat (amended 2026-09-24: closet Schedule list stays [0027](0027-bot-schedules.md); Skill `description` + catalog [0032](0032-chat-llm-context-assembly.md)) |
| [0029](0029-turn-journal.md) | Turn journal (amended 2026-09-24: harness smoke; Schedule run history reads journal rows) |
| [0030](0030-chat-cards-module-catalog.md) | Chat Cards for Schedule changes (amended 2026-09-24: no stock Module packages; Skill and self-settings success is a system Chat line, not a Card; meta Skills insert-if-missing on Bot create; Card «Изменить» opens closet detail; meta Skills catalog + read [0032](0032-chat-llm-context-assembly.md)) |
| [0031](0031-host-http-get.md) | Host HTTP get and Cluster http allowlist (amended 2026-09-24: allowlist Chat tools behind expand [0032](0032-chat-llm-context-assembly.md); Bot HTTP egress [0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)) |
| [0032](0032-chat-llm-context-assembly.md) | Chat LLM context assembly |
| [0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md) | Cluster outbound: LLM proxy vs Bot HTTP proxy |
