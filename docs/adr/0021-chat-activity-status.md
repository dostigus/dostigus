# ADR 0021: Chat activity status row

- Status: accepted
- Date: 2026-09-23

## Decision

While a reply is in flight, Chat shows **one** status row in the thread,
under the latest line and above the composer clearance. The row is a
horizontal pair: an action glyph, then a short Russian line in muted
Nunito. It replaces the silent in-thread flock mark when that mark would
only repeat the Chat pill.

| Activity | Glyph | Copy |
|----------|--------|------|
| Configured reply in flight | Green three-dot wave | «Печатает…» |
| Waiting on a tool or command | Orange cluster pulse | «Ожидает завершения команды» |
| Connecting to the gateway or MCP surface | Small Bot mark, soft pulse | «Подключается к {name}» when a short target is known, otherwise «Подключается…» |
| No key (quiet stub) | Existing flock mark in `think` | No status line. Do not say «Печатает…». |
| Idle, including composer focus | None | The pill still uses `listen`. No thread row. |

The row hides when nothing is in flight. The green live dot on the Chat
pill and the matching sidebar row is unchanged. Members and the Owner
share this chrome. Model tier and delete stay where they are.

The message route still returns one finished assistant line
([ADR 0011](0011-chat-mcp-tool-loop.md)). It does not report tool-loop
phases. A configured `botPending` therefore maps to «Печатает…». Command
and connect are real row states, forced in local `nuxt dev` with
`?activity=command` or `?activity=connect` (optional `&target=`). A
production Host ignores that query.

`prefers-reduced-motion` holds the glyph still.

The same local preview can hold that in-flight state for a screenshot.
Chat opened with `?hold=1` (including `GET /preview-seed?hold=1`, which
redirects onto the Chat URL) sends the flag on the message POST. When the
preview seed gate is open and the reply is the no-key stub, the route
waits 12 seconds before storing the assistant line. `botPending` stays
true, so the flock mark in `think` stays in the thread. A configured
gateway is not delayed. A production Host ignores `hold`. `?activity=`
still only forces glyphs; it does not hold this pending path.

## Context

The in-thread busy indicator was only the Bot’s flock mark in `think`
([ADR 0014](0014-host-messenger-shell.md),
[ADR 0018](0018-bot-mark-flock.md)). The pill already thinks, speaks, and
cheers, so the thread mark carried no copy and did not change with the
action. Nick’s reference is a short status beside an action-specific
animation: typing, waiting on a command, and connecting.

## Consequences

- `chatActivityStatus` chooses the row. `ChatActivityRow` draws it.
- The quiet path keeps the pending flock mark and does not claim generation.
- No new activity protocol or streaming. The route still returns one
  finished line. Preview `?hold=1` only delays the quiet stub.
- Pill flock states and the live dot stay.

## Alternatives

- One spinner for every wait — rejected. The glyph follows the action.
- Put the line in the header pill — rejected. The row stays in the thread.
- Stack the flock mark and the status line — rejected. One row.
- Show «Печатает…» on the quiet stub — rejected. There is no generation.
- Stream tool-loop phases in this change — rejected. The route has no
  phase signal yet. Preview can show the other two rows.
