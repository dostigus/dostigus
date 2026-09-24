# ADR 0027: Host Bot Schedules

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — Schedule Chat Cards are [ADR 0030](0030-chat-cards-module-catalog.md). Schedule rows and the ticker stay this record. Weather stays out of this monorepo. A Marketplace of packages is later.

Chat turns stay [ADR 0011](0011-chat-mcp-tool-loop.md). Activity phases
stay [ADR 0021](0021-chat-activity-status.md). Bot visibility and
bot-threads stay [ADR 0024](0024-threads-and-bot-visibility.md).
Settings stay with the Owner
([ADR 0012](0012-household-members.md)).

## Decision

A **Schedule** is a row in the Cluster Store on the Host. It is not a
Manifest field and not a Skill. A Skill says what the Bot does. A
Schedule says when the Host wakes that Bot.

The row belongs to one person's bot-thread with one Bot: `(botId, personId)`.
Many Schedules for the same person and the same Bot are allowed. Day-1
is full create, read, update, delete, pause, and resume.

| Field | Writer | Meaning |
| --- | --- | --- |
| cadence | the Bot, or the Owner | `daily` or `weekly` |
| timeLocal | the Bot, or the Owner | `HH:MM` wall clock in the Cluster timezone |
| daysOfWeek | the Bot, or the Owner | omitted for `daily`; the weekdays when `weekly` |
| wakeText | the Bot supplies it; the Owner may set it | the string the Wake line shows |
| paused / enabled | the Bot, or the Owner | paused rows do not fire |
| next_run_at | Host | next fire instant |
| last run | Host | last-run metadata |

The Host recomputes `next_run_at` after create, update, and fire. The
Bot does not set `next_run_at` or last-run metadata. Pause stops fires.
Resume changes the paused flag and recomputes `next_run_at`.

### Fire

When a Schedule is due, the Host writes one visible **Wake** on that
bot-thread: a system Chat line whose text is `wakeText`. It then starts
the same Bot turn pipeline as a user message
([ADR 0011](0011-chat-mcp-tool-loop.md)). Activity phases apply for
that turn ([ADR 0021](0021-chat-activity-status.md)). The Turn journal
records that turn with trigger `wake` and this Schedule's id
([ADR 0029](0029-turn-journal.md)).

Day-1 fires on a bot-thread only. A room, a direct message, and a group
are not fire targets.

### Cluster timezone

The Cluster has one IANA timezone in the Store:
`cluster_settings.timezone`. A Schedule stores local wall clock. The
Host converts that clock in the Cluster timezone when it sets
`next_run_at`.

The effective timezone is the Store value when one is set. Otherwise it
is the `DOSTIGUS_TZ` environment variable when that is set. Otherwise
it is `UTC`.

The Owner sets the timezone in Host settings and with MCP. A Member may
get it and may not set it. Members do not open Settings
([ADR 0012](0012-household-members.md)), so a Member reads the timezone
through MCP. Changing the timezone recomputes `next_run_at` on existing
Schedules: the wall clock stays, and the instant moves.

The settings field is part of this decision. This record does not add
the control. The code PR does.

### MCP day-1

The Bot creates, lists, updates, pauses, resumes, and deletes Schedules
by calling MCP surface tools during a Chat turn. A sentence such as
«каждое утро в 8:00…» is that call. The Host does not parse natural
language into a Schedule.

| Tool | Who |
| --- | --- |
| `dostigus_schedules_list` | that person, or the Owner |
| `dostigus_schedules_create` | that person, or the Owner |
| `dostigus_schedules_update` | that person, or the Owner |
| `dostigus_schedules_pause` | that person, or the Owner |
| `dostigus_schedules_resume` | that person, or the Owner |
| `dostigus_schedules_delete` | that person, or the Owner |
| `dostigus_cluster_timezone_get` | Owner or Member |
| `dostigus_cluster_timezone_set` | Owner |

These tools are MCP surface tools. Chat calls the same handlers
in-process ([ADR 0011](0011-chat-mcp-tool-loop.md)). `/mcp` Bearer auth
is unchanged ([ADR 0009](0009-mcp-toolkit-endpoint.md)). A Member turn
may call the schedule tools for that person's rows with the Bot on
that turn, and may call timezone get. The Owner may manage any
Schedule and may set the timezone. Schedule delete is on this loop.
`dostigus_bots_delete` stays off it. A Chat request to change a
Schedule is Self-settings
([ADR 0028](0028-bot-self-settings-via-chat.md)). The tools and this
row stay this record. Manifest and Skills writes are not this scope.

A Schedule list Sheet is later. It is not a day-1 must-have.

### Ownership

A Schedule is owned by `(botId, personId)`. That person manages it
through the Bot in their turn. The Owner can always manage it.

If that person's grant on the Bot is revoked, the Schedule row stays.
Fires do not run until access is restored
([ADR 0024](0024-threads-and-bot-visibility.md)).

### Missed and busy

If the Host was down or the tick is late, it fires once in catch-up
when lateness is less than 30 minutes from the planned time. Otherwise
it skips to the next occurrence and recomputes `next_run_at`.

If a reply for the same `(threadId, botId)` is already in flight, the
Host defers this fire by one minute. It does that at most five times,
then skips to the next occurrence. It does not start a parallel turn.

### Ticker

The Host process polls SQLite `next_run_at` about every 30 seconds.
Day-1 is one node. There is no external cron worker.

## Context

The Host replies when a person writes on a bot-thread
([ADR 0011](0011-chat-mcp-tool-loop.md)). Nothing in the Store says when
the Host should wake a Bot on its own. A Skill is instructions, not a
clock. A Manifest is the Bot definition, not a timetable. Putting the
clock on either one would mix what the Bot does with when the Host
wakes it.

The grill on 2026-09-24 keeps the clock as Host Store rows, local wall
time in one Cluster timezone, and a Wake that reuses the existing turn.
The Bot asks for the Schedule by calling tools. The Host does not
interpret the sentence.

[ADR 0021](0021-chat-activity-status.md) lists Host schedules as outside
that record. This record is the schedule decision. Weather stays out.

## Consequences

- The code PR adds `schedules` and `cluster_settings.timezone`. This
  record does not.
- The ticker runs in the Host process. A second process is not day-1.
- A fire writes a system Wake, then the
  [ADR 0011](0011-chat-mcp-tool-loop.md) pipeline, with
  [ADR 0021](0021-chat-activity-status.md) phases. That Turn stores
  `scheduleId` ([ADR 0029](0029-turn-journal.md)).
- Member Chat gains the schedule tools and timezone get, scoped above.
  Other Member Chat tools stay
  [ADR 0011](0011-chat-mcp-tool-loop.md) and
  [ADR 0012](0012-household-members.md).
- Owner Settings gains the timezone field in the code PR. The page
  stays Owner-only.
- A revoked grant does not delete Schedules. It suppresses fires.
- The Platform does not gain a Weather Module, a weather Skill, a
  weather API, or a Kitchen-style weather seed. A Schedule only
  provides the Wake.

### Out of scope

- Weather Module, weather Skill, weather API, and any Kitchen-style
  seed of weather. Those are not a Host seed in this monorepo.
- A Schedule list Sheet.
- Full crontab syntax, an interval of every N minutes, and one-shot
  fires.
- Wakes on a room, a direct message, or a group.
- An SSE ticker and a multi-node lease.
- The Host parsing natural language into a Schedule.

## Alternatives

- Store the clock on the Skill or the Manifest — rejected. A Skill says
  what. A Schedule says when.
- A timezone per person or per Bot — rejected. One Cluster timezone.
  The Schedule stores wall clock.
- The Host parses «каждое утро в 8:00…» — rejected. The Bot calls
  tools.
- Fire with no Chat line — rejected. The Wake is a visible system line.
- Fire on a room — rejected for day-1. Bot-thread only.
- An external cron worker — rejected for day-1. The Host polls
  `next_run_at`.
- A parallel turn while a reply is in flight — rejected. Defer, then
  skip.
- Catch up every missed fire after a long outage — rejected. One
  catch-up when lateness is less than 30 minutes; otherwise the next
  occurrence.
- Delete the Schedule when a grant is revoked — rejected. The row
  stays. Fires wait for access.
- Ship a weather seed beside Kitchen — rejected. Weather is not
  Platform scope.
