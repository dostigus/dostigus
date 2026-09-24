# ADR 0029: Turn journal

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — harness smoke `pnpm smoke:turns`

Activity phases stay [ADR 0021](0021-chat-activity-status.md). The Chat
tool loop stays [ADR 0011](0011-chat-mcp-tool-loop.md). A Wake stays
[ADR 0027](0027-bot-schedules.md).

## Decision

A **Turn** is one Host Bot Chat turn: one Bot LLM tool loop, the same
span as one Activity session. The **Turn journal** is the `turns` table
plus two MCP surface tools so an ops agent can read that meta on a live
Host. Debugging a rename, a Schedule, or a tool loop does not need a
screenshot of Chat.

The journal records meta only. It does not store message bodies, tool
arguments, tool results, prompts, or LLM gateway payloads.

### Which turns

| Trigger | When a row is created |
| --- | --- |
| `user` | A person sends a line on a bot-thread and the Host starts that Bot's reply |
| `wake` | A Schedule fire starts the Bot turn after the Wake line ([ADR 0027](0027-bot-schedules.md)) |
| `mention` | A room line mentions one Bot and that Bot's reply starts |

A raw `/mcp` call does not create a Turn. A room line that does not
mention a Bot does not create a Turn. One Turn is one Bot loop. A
second Bot is a second Turn.

### Row

| Field | Meaning |
| --- | --- |
| `id` | Turn id |
| `threadId` | Thread the reply runs on |
| `botId` | Bot that replies |
| `personId` | Viewer. On a bot-thread, whose bot-thread. On a Wake, the Schedule's person. On a mention, the person who sent the line |
| `trigger` | `user`, `wake`, or `mention` |
| `outcome` | `running`, then `ok`, `error`, or `abort` |
| `startedAt` | When the Turn starts |
| `endedAt` | Null while `running` |
| `scheduleId` | Set on a Wake. Null for `user` and `mention` |
| `errorCode` | Short class, or null. `llm_error`, `tool_error`, or `aborted`. Never model text and never a stack |
| `phases_json` | `[{ phase, at }]` in order. `phase` is `thinking`, `tool`, or `typing` ([ADR 0021](0021-chat-activity-status.md)) |
| `tools_json` | `[{ name, ok, ms }]` in call order. Tool name only |

Lifecycle: insert at start with `outcome` `running`, patch phases and
tools as they happen, then set `endedAt` and the final outcome. On
finalize, delete rows whose `startedAt` is older than 7 days.

`llm_error` is a gateway failure or an empty completion. `tool_error`
is a tool failure that fails the Turn. A tool result with `ok: false`
that the loop feeds back to the model stays on `tools_json` and does
not by itself set `tool_error`. `aborted` is a Chat request that aborts
before the Turn is finalized.

### Activity

The Activity poll stays in-memory on `(threadId, botId)`
([ADR 0021](0021-chat-activity-status.md)). Setting a phase for a Chat
turn also appends `{ phase, at }` on the open Turn. Clearing the phase
does not append and does not delete the Turn. `GET /api/chat/activity`
does not read `turns`.

### MCP

`dostigus_turns_list` and `dostigus_turns_get` are MCP surface tools.
The bearer is `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`), the same
soft auth as the other Host tools
([ADR 0009](0009-mcp-toolkit-endpoint.md)). Day-1 the token sees every
Cluster Turn. There is no per-person gate.

List filters are optional `botId`, `threadId`, and `since`, plus
`limit` (default 50, cap 100). Newest first. Get is by id.

These tools are not in the Owner Chat allowlist and not in the Member
Chat allowlist ([ADR 0011](0011-chat-mcp-tool-loop.md)). Chat does not
call them.

### Out of scope

- An Owner UI Sheet for the journal
- Evals
- Storing message bodies, tool arguments, tool results, or prompts
- Replacing the Activity poll with a Store read
- Schedule ticker debug tools
- Weather payloads. Stock Weather tool names are
  [ADR 0030](0030-chat-cards-module-catalog.md). The journal still
  stores `{ name, ok, ms }` only.

## Context

Ops agents can call the MCP surface, but a Bot turn left no durable
trace of which tools ran or which Activity phases the loop passed
through. The Activity row is process memory
([ADR 0021](0021-chat-activity-status.md)). Chat logs a tool name and
ok, fail, or skip, and not the order tied to one reply. A rename loop,
a Schedule Wake, or a stuck tool round then needs a screenshot.

The grill on 2026-09-24 keeps the journal as ops meta on the Host, dual
written from the loop that already exists, and read through MCP. It
does not add a Sheet and does not put the tools on the Chat allowlist.

## Consequences

- The code PR adds `turns`, the write path on the existing Chat loop
  and Activity phase set, and `dostigus_turns_list` /
  `dostigus_turns_get`.
- A Wake copies `scheduleId` onto the Turn
  ([ADR 0027](0027-bot-schedules.md)).
- The tool loop appends `{ name, ok, ms }` and does not append
  arguments or results ([ADR 0011](0011-chat-mcp-tool-loop.md)).
- The Activity poll is unchanged. Phase dual-write is a side effect of
  the set ([ADR 0021](0021-chat-activity-status.md)).
- Owner and Member Chat tools stay the allowlists in
  [ADR 0011](0011-chat-mcp-tool-loop.md),
  [ADR 0027](0027-bot-schedules.md), and
  [ADR 0028](0028-bot-self-settings-via-chat.md). Turn tools are not
  added to those lists.
- Rows older than 7 days leave the Store when a Turn finalizes.
- `pnpm smoke:turns` checks the quiet Chat write path and
  `dostigus_turns_list` / `dostigus_turns_get` on a running preview
  Host. It is not an Owner Sheet.

## Alternatives

- An Owner Sheet for turns — rejected for day-1. Ops read MCP.
- A harness script in the journal change — rejected for that PR. The
  later smoke is `pnpm smoke:turns`
  ([`scripts/turn-journal-smoke.mjs`](../../scripts/turn-journal-smoke.mjs),
  [#85](https://github.com/dostigus/dostigus/pull/85)).
- Store the message body, the tool arguments, or the tool result —
  rejected. That copies prompts and secrets into the journal.
- Read Activity from `turns` — rejected. The poll stays the in-memory
  map.
- A Turn for every `/mcp` call — rejected. The journal is Host Bot Chat
  turns.
- A Turn for a room line with no mention — rejected. That line does not
  start a Bot loop.
- Put `dostigus_turns_list` and `dostigus_turns_get` on the Chat
  allowlist — rejected. They are ops tools.
