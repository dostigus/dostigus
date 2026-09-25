# ADR 0029: Turn journal

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — harness smoke `pnpm smoke:turns`
- Amended: 2026-09-24 — Schedule detail lists wake Turns for that `scheduleId` ([ADR 0027](0027-bot-schedules.md)). That is not an Owner journal Sheet. No new runs table.
- Amended: 2026-09-25 — Observability fields `modelId`, `modelTier`, `visionParts` (nullable). Patch early while `running`, after `resolveModelId` and the vision needles gate. MCP list/get always return them. Shipped in [#124](https://github.com/dostigus/dostigus/pull/124).
- Amended: 2026-09-25 — Observability fields `servedModelId`, `promptTokens`, `completionTokens`, `totalTokens`, `llmCallCount` (nullable). Accumulate after each LLM completion while `running`. MCP list/get always return them. No list filters or usage.summary day-1. Impl + migration + `pnpm smoke:turns` extend land in a follow-up PR.
- Amended: 2026-09-25 — Escalate (more than one Model-tier resolve per Turn) is [ADR 0036](0036-llm-providers-tier-resolve-escalate.md). The journal stays last successful resolve fields, or last attempted if the Turn errors, plus `llmCallCount`. No per-attempt rows day-1. Chat stays silent. Amend this record in the impl PR only if those aggregates are not enough.

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
| `modelId` | Id after `resolveModelId` (tier → env/store/default): the id **sent** in the LLM request ([ADR 0004](0004-llm-gateway-tiers.md)). Not `response.model` / a free-roulette served id. That served id is `servedModelId`. Nullable |
| `modelTier` | Bot Model tier for this Turn (`cheap`, `strong`, `code`, or `toy`). Nullable |
| `visionParts` | Whether image parts were actually included in the LLM request after the `VISION_MODEL_NEEDLES` gate ([ADR 0035](0035-image-artifact-vision.md)). Soft path / needles miss is `false` even if the person attached images. Nullable |
| `servedModelId` | Last non-empty provider `response.model` in the Turn. Else null. Not `modelId`. Nullable |
| `promptTokens` | Sum of prompt/input tokens across LLM completions in the Turn. Missing usage stays null, never zero. Nullable |
| `completionTokens` | Sum of completion/output tokens across LLM completions in the Turn. Missing usage stays null, never zero. Nullable |
| `totalTokens` | Provider `total` if given; else prompt+completion if **both** of those Turn fields are non-null; else null. Nullable |
| `llmCallCount` | Number of LLM completions in the Turn. Null if no LLM / not measured. Nullable |

Lifecycle: insert at start with `outcome` `running`, patch phases and
tools as they happen, then set `endedAt` and the final outcome. On
finalize, delete rows whose `startedAt` is older than 7 days.

Patch `modelId`, `modelTier`, and `visionParts` early while
`outcome` is still `running`, right after `resolveModelId` and the
vision needles gate ([ADR 0004](0004-llm-gateway-tiers.md),
[ADR 0035](0035-image-artifact-vision.md)). Do not wait for
finalize. Day-1 of this record assumed one resolve per Turn.
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md) may
resolve again on escalate; re-patch last successful resolve, or
last attempted if the Turn errors. The tool loop does not store a
per-call model array. Legacy rows and Turns that die before
resolve stay null. There is no backfill.

Patch `servedModelId`, `promptTokens`, `completionTokens`,
`totalTokens`, and `llmCallCount` after **each** LLM completion
while `outcome` is still `running`. Do not wait for finalize. A
mid-loop abort keeps the sums so far. Day-1 aggregates on the Turn.
It does not store per-call usage rows.

`servedModelId` is the last non-empty `response.model` on those
completions. An empty or missing `response.model` does not overwrite
a previous non-empty value. Multiple completions do not store an
array.

Missing provider usage stays **null**. Do not write zeros.
`totalTokens` uses the provider total when the provider gives one;
otherwise prompt plus completion only when **both** of those Turn
fields are non-null; otherwise null. Across completions, the same
fields sum. `llmCallCount` is the number of LLM completions. Null
if the Turn never called the LLM or was not measured. The quiet /
stub path (no gateway key) is not an LLM completion. Legacy rows
stay null. There is no backfill.

`llm_error` is a gateway failure or an empty completion. `tool_error`
is a tool failure that fails the Turn. A tool result with `ok: false`
that the loop feeds back to the model stays on `tools_json` and does
not by itself set `tool_error`. `aborted` is a Chat request that aborts
before the Turn is finalized.

A soft vision gate ([ADR 0035](0035-image-artifact-vision.md)) sets
`visionParts` to `false` and leaves `outcome` `ok`. It does not add
an `errorCode`. `vision_gated` is not a code.

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
`dostigus_turns_list` and `dostigus_turns_get` always return
`modelId`, `modelTier`, `visionParts`, `servedModelId`,
`promptTokens`, `completionTokens`, `totalTokens`, and
`llmCallCount` (camelCase). Day-1 does not add list filters on
those fields and does not add a usage summary tool.

These tools are not in the Owner Chat allowlist and not in the Member
Chat allowlist ([ADR 0011](0011-chat-mcp-tool-loop.md)). Chat does not
call them.

Schedule detail ([ADR 0027](0027-bot-schedules.md)) lists journal rows
with `trigger` `wake` and that `scheduleId`. Empty copy: «Пока не было
запусков». That is not an Owner journal Sheet. Day-1 does not add a
runs table. Ops still list and get through MCP.

### Out of scope

- An Owner UI Sheet for the journal. Schedule run history is the
  detail Sheet in [ADR 0027](0027-bot-schedules.md), not a journal
  browser.
- Owner Settings «Usage» UI (period, models, charts). Later charts
  prefer `servedModelId` when set, else `modelId`.
- A Cluster ledger table, an MCP `usage.summary` tool, or group-by
  aggregates
- Per-call usage rows
- `cachedTokens` or `costUsd` (reported or estimated)
- Quality or eval scores (efficiency = tokens + latency + outcome
  on existing fields, later)
- Evals
- Storing message bodies, tool arguments, tool results, prompts, or a
  `promptSnippet`
- Treating `modelId` as the provider `response.model` / free-roulette
  winner. The served id is `servedModelId`. `modelId` stays the id
  sent after `resolveModelId` ([ADR 0004](0004-llm-gateway-tiers.md))
- MCP list filters by `modelId`, `modelTier`, `visionParts`,
  `servedModelId`, or the token fields
- A new `errorCode` for the soft vision path
  ([ADR 0035](0035-image-artifact-vision.md))
- A separate `pnpm smoke:vision` harness (later, a known vision id)
- A separate live-gateway `pnpm smoke:usage` harness
- Replacing the Activity poll with a Store read
- Schedule ticker debug tools
- Weather payloads. This monorepo has no stock Weather tools
  ([ADR 0030](0030-chat-cards-module-catalog.md)). The journal stores
  `{ name, ok, ms }` only.

## Context

Ops agents can call the MCP surface, but a Bot turn left no durable
trace of which tools ran or which Activity phases the loop passed
through. The Activity row is process memory
([ADR 0021](0021-chat-activity-status.md)). Chat logs a tool name and
ok, fail, or skip, and not the order tied to one reply. A rename loop,
a Schedule Wake, or a stuck tool round then needs a screenshot.

The grill on 2026-09-24 keeps the journal as ops meta on the Host, dual
written from the loop that already exists, and read through MCP. It
does not add a journal Sheet and does not put the tools on the Chat
allowlist. Schedule detail may list wake Turns for one `scheduleId`
([ADR 0027](0027-bot-schedules.md)).

The grill on 2026-09-25 adds nullable `modelId`, `modelTier`, and
`visionParts` so ops can see which model id went on the request and
whether vision parts were actually sent
([ADR 0004](0004-llm-gateway-tiers.md),
[ADR 0035](0035-image-artifact-vision.md)). That grill does not
treat `modelId` as `response.model`. Impl shipped in
[#124](https://github.com/dostigus/dostigus/pull/124).

A later grill on 2026-09-25 (R1–R4) adds nullable `servedModelId` and
Turn-level token aggregates. `modelId` stays the id **sent** after
`resolveModelId`. `servedModelId` is the last non-empty provider
`response.model` in the Turn. Tokens live on the Turn day-1, not
on a Cluster ledger table. Missing usage is null, never zeros.
Accumulate after each LLM completion while the Turn is still
`running` so a mid-loop abort keeps the sums. Competitors store a
configured or selected model, not post-route `response.model`;
their usage ledgers use a model dimension. Day-1 keeps that
dimension on the Turn. Owner Settings Usage UI, a Cluster ledger,
`usage.summary`, per-call rows, `cachedTokens`, `costUsd`, and
quality scores stay later. Impl, migration, and the harness
extend land in a follow-up PR.

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
- `modelId`, `modelTier`, and `visionParts` are in this Host
  ([#124](https://github.com/dostigus/dostigus/pull/124)). The early
  patch after `resolveModelId` and the vision needles gate stays.
  `pnpm smoke:turns` asserts `modelId` and `visionParts` on a
  fixture Turn. There is no separate `pnpm smoke:vision` day-1.
- A follow-up PR lands the Store columns for `servedModelId` and
  the token fields, the accumulate-after-each-completion write
  while `running`, MCP camelCase fields, and the migration. This
  record does not change Host or Store code.
- That follow-up extends `pnpm smoke:turns` for the new fields.
  The quiet / stub fixture has no LLM completion, so
  `servedModelId` and the token fields stay null there. There is
  no separate live-gateway `pnpm smoke:usage` day-1.
- Schedule detail reads those same journal rows for one Wake
  ([ADR 0027](0027-bot-schedules.md)). It does not add a runs table.

## Alternatives

- An Owner Sheet for turns — rejected for day-1. Ops read MCP.
  Schedule run history is not that Sheet.
- Owner Settings «Usage» UI or charts day-1 — rejected. Later.
  Those charts prefer `servedModelId` when set, else `modelId`.
- A harness script in the journal change — rejected for that PR. The
  later smoke is `pnpm smoke:turns`
  ([`scripts/turn-journal-smoke.mjs`](../../scripts/turn-journal-smoke.mjs),
  [#85](https://github.com/dostigus/dostigus/pull/85)).
- Store the message body, the tool arguments, the tool result, or a
  `promptSnippet` — rejected. That copies prompts and secrets into
  the journal.
- Store `response.model` on `modelId` — rejected. `modelId` is the
  id sent after `resolveModelId`
  ([ADR 0004](0004-llm-gateway-tiers.md)). The served id is
  `servedModelId`.
- A Cluster ledger table or MCP `usage.summary` day-1 — rejected.
  Token usage lives on the Turn. A ledger and group-by aggregates
  are later.
- Per-call usage rows day-1 — rejected. Aggregate on the Turn.
- Zeros for missing provider usage — rejected. Missing is null.
- An array of `response.model` values — rejected. Scalar last
  non-empty.
- `cachedTokens` or `costUsd` on the row — rejected for day-1.
- MCP list filters on `modelId`, `visionParts`, `servedModelId`,
  or the token fields — rejected for day-1. List and get always
  return the fields.
- A new `errorCode` for soft vision — rejected. Soft path stays
  [ADR 0035](0035-image-artifact-vision.md): `visionParts` false,
  `outcome` ok.
- A separate `pnpm smoke:vision` in this change — rejected. The
  impl PR extends `pnpm smoke:turns`.
- A separate live-gateway `pnpm smoke:usage` day-1 — rejected. The
  impl PR extends `pnpm smoke:turns`.
- Read Activity from `turns` — rejected. The poll stays the in-memory
  map.
- A Turn for every `/mcp` call — rejected. The journal is Host Bot Chat
  turns.
- A Turn for a room line with no mention — rejected. That line does not
  start a Bot loop.
- Put `dostigus_turns_list` and `dostigus_turns_get` on the Chat
  allowlist — rejected. They are ops tools.
