# ADR 0021: Chat activity status row

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24

Amended 2026-09-24. Phases are the same chrome row, not a second UI.
Production drives **thinking**, **tool**, and **typing** from the live
reply. **Connect** stays a preview row. The message route still returns
one finished assistant line
([ADR 0011](0011-chat-mcp-tool-loop.md)). Phases are a side channel.

## Decision

While a configured reply is in flight, Chat shows **one** activity row
in the thread, under the latest line and above the composer clearance.
The row is a horizontal pair: an action glyph, then a short Russian
line in muted Nunito. The Owner and a Member share this chrome.

| Phase | Glyph | Copy |
|-------|--------|------|
| thinking | Flock mark in `think` | «Думает…» |
| tool | Orange cluster pulse | «Выполняет команду…» |
| typing | Green three-dot wave | «Печатает…» |

- **thinking** — waiting on the LLM before a tool round or between tool
  rounds. The model has not started the final assistant text.
- **tool** — a Cluster MCP tool call is running. Day-1 copy does not
  include the tool name or its arguments. The model does not supply a
  custom status string.
- **typing** — the model is producing the final assistant text, including
  the last text-only completion after the tool loop.

The row hides when nothing is in flight. On error or abort it hides as
well. The error stays in the assistant bubble. There is no error phase
on the row.

The Chat pill flock stays in `think` for the whole in-flight reply. The
**row** is the source of truth for the phase. The green live dot on the
Chat pill and the matching sidebar row is unchanged. Model tier and
delete stay where they are. `prefers-reduced-motion` holds the glyph
still.

With no LLM key, the thread keeps the flock mark in `think` and shows
no status line. It never says «Печатает…». Idle, including composer
focus, adds no thread row. The pill still uses `listen` at the composer.

**Connect** is a real row state for local preview only: a small Bot
mark with a soft pulse, and «Подключается к {name}» when a short target
is known, otherwise «Подключается…». Production day-1 does not drive
connect from the live path. An LLM cold start is not “подключается”.

Local `nuxt dev` may force the row without a live reply:
`?activity=thinking`, `?activity=tool`, `?activity=typing`,
`?activity=command`, or `?activity=connect` (optional `&target=`).
`command` uses the tool glyph and copy. A production Host ignores
`activity`.

The same local preview can hold an in-flight quiet stub for a
screenshot. Chat opened with `?hold=1` (including
`GET /preview-seed?hold=1`, which redirects onto the Chat URL) sends
the flag on the message POST. When the preview seed gate is open and
the reply is the no-key stub, the route waits 12 seconds before storing
the assistant line. The flock mark in `think` stays in the thread, with
no status line. A configured gateway is not delayed. A production Host
ignores `hold`. `?activity=` still only forces glyphs; it does not hold
this pending path.

### Protocol

The open Thread polls a cheap session-gated activity endpoint about
every 400ms while that Thread has the viewer’s own reply pending. This
ADR does not use SSE or a chunked response.

Phase state is in-memory on the Host process, keyed by `(threadId, botId)`.
One protocol covers a bot-thread and a room (a mention-reply). The
client may keep a phase on screen for about 300ms so the row does not
flicker. It stops polling when the assistant line lands, when the
request errors or aborts, or when the viewer leaves Chat.

The message route still returns one finished assistant line
([ADR 0011](0011-chat-mcp-tool-loop.md)). Phases do not change that
reply shape.

## Context

The in-thread busy indicator was only the Bot’s flock mark in `think`
([ADR 0014](0014-host-messenger-shell.md),
[ADR 0018](0018-bot-mark-flock.md)). The 2026-09-23 decision added one
status row and mapped every configured in-flight reply to «Печатает…»,
with command and connect as preview-only rows. That copy is wrong while
the model is still waiting to run, or while a tool call is running, and
«Подключается…» would lie about an LLM cold start. Nick’s grill on
2026-09-24 keeps the one row and names the phase.

## Consequences

- `chatActivityStatus` chooses the row. `ChatActivityRow` draws it.
  Thinking, tool, and typing are that row’s phases.
- The quiet path keeps the pending flock mark and does not claim generation.
- The pill stays in `think` for the whole in-flight reply. The row carries
  the phase. The live dot stays.
- Phase state is ephemeral process memory. The poll is the transport.
  Preview `?hold=1` only delays the quiet stub.
- The message route is unchanged: one finished assistant line.

### Out of scope

- Streaming the assistant bubble body token-by-token.
- Showing MCP tool names or arguments in the status row.
- Model-supplied free-text status lines.
- Durable Store rows for a phase. The phase is ephemeral.
- Weather Module, Host schedules, and Skills packages.

## Alternatives

- One spinner for every wait — rejected. The glyph follows the phase.
- Put the line in the header pill — rejected. The row stays in the thread.
  The pill flock stays in `think` and does not spell the phase.
- A second status UI beside this row — rejected. Phases are the same row.
- Stack a silent flock mark and a separate status line — rejected. One
  row. The thinking glyph is the flock mark on that row.
- Show «Печатает…» on the quiet stub — rejected. There is no generation.
- Map every configured reply to «Печатает…» — rejected by this amendment.
  Waiting on the LLM, and a tool call, are not typing.
- Drive connect on LLM cold start — rejected. The copy would claim a
  connection the Host is not making.
- SSE or a chunked phase stream — rejected for this ADR. Poll is enough.
- Put the phase on the message response — rejected.
  [ADR 0011](0011-chat-mcp-tool-loop.md) still returns one finished line.
- Show the tool name, or a model-written status — rejected for day-1.
- Store the phase — rejected. It is ephemeral.
