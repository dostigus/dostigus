# ADR 0027: Host Bot Schedules

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — Schedule Chat Cards are [ADR 0030](0030-chat-cards-module-catalog.md). Schedule rows and the ticker stay this record. Weather stays out of this monorepo. A Marketplace of packages is later.
- Amended: 2026-09-24 — Host UI: closet «Расписания» list, create Sheet, and detail Sheet are day-1. Optional `name` on the row. Run history is Turn journal rows ([ADR 0029](0029-turn-journal.md)). Card «Изменить» opens the same detail Sheet ([ADR 0030](0030-chat-cards-module-catalog.md)).

Chat turns stay [ADR 0011](0011-chat-mcp-tool-loop.md). Activity phases
stay [ADR 0021](0021-chat-activity-status.md). Bot visibility and
bot-threads stay [ADR 0024](0024-threads-and-bot-visibility.md).
Settings stay with the Owner
([ADR 0012](0012-household-members.md)). The closet stays
[ADR 0020](0020-bot-closet.md).

## Decision

A **Schedule** is a row in the Cluster Store on the Host. It is not a
Manifest field and not a Skill. A Skill says what the Bot does. A
Schedule says when the Host wakes that Bot.

The row belongs to one person's bot-thread with one Bot: `(botId, personId)`.
Many Schedules for the same person and the same Bot are allowed. Day-1
is full create, read, update, delete, pause, and resume.

| Field | Writer | Meaning |
| --- | --- | --- |
| name | the Bot, that person (Host UI), or the Owner | optional display name. Empty: the list falls back to truncated `wakeText` |
| cadence | the Bot, that person (Host UI), or the Owner | `daily` or `weekly` |
| timeLocal | the Bot, that person (Host UI), or the Owner | `HH:MM` wall clock in the Cluster timezone |
| daysOfWeek | the Bot, that person (Host UI), or the Owner | omitted for `daily`; the weekdays when `weekly` |
| wakeText | the Bot supplies it; that person (Host UI) or the Owner may set it | the string the Wake line shows |
| paused / enabled | the Bot, that person (Host UI), or the Owner | paused rows do not fire |
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

`dostigus_schedules_create` and `dostigus_schedules_update` accept
optional `name`. Empty or omitted `name` stores empty. The Host UI
falls back to truncated `wakeText`.

### Host UI (day-1)

The closet Параметры Sheet ([ADR 0020](0020-bot-closet.md)) holds a
**Расписания** block under the Manifest fields. Visual intent follows
the Grok Bot Routines list and detail (named rows; detail with Active,
cadence, instruction, run history). Dostigus labels stay the glossary:
Schedule, Bot, Wake, Turn, Chat Card, Sheet, Параметры. Host copy is
Russian («Расписания»). Docs stay English. Do not use Grok «Routines».

Who sees the block: any person who can open the Bot. The list is that
person's rows on this Bot `(botId, personId)`. Day-1 UI does not list
another person's rows. Owner MCP scope for others stays as above.

The block is a list, not a second API. Create, update, pause, resume,
and delete write through the same Store handlers as
`dostigus_schedules_*`. The Host UI does not add a separate JSON
surface.

**List.** Each row shows the display name, or a truncated `wakeText`
when `name` is empty, plus a human cadence («каждый день · 08:00»).
Paused rows are muted. `next_run_at` is not on the list. Pause is not
a list toggle.

Header **+** opens the create Sheet. Empty state: short text plus
**Добавить** (and the header **+**).

**Create Sheet.** Optional `name`, cadence `daily` \| `weekly`,
`timeLocal`, `daysOfWeek` when weekly, and `wakeText`. Cadence UI is
daily or weekly plus wall clock. No free crontab. After create, the
Host returns to the list with the new row.

**Detail Sheet.** Opened by tapping a list row, or by Chat Card
**Изменить** ([ADR 0030](0030-chat-cards-module-catalog.md)). It
holds: Active / pause toggle, cadence + time (+ days when weekly),
`wakeText` (instruction), Run history, and danger **Удалить**. Pause
and resume live only here. `next_run_at` may appear here; it is not
required on day-1.

**Run history.** Turn journal rows with `trigger` `wake` and this
`scheduleId` ([ADR 0029](0029-turn-journal.md)). Empty copy: «Пока не
было запусков». Day-1 does not add a runs table.

Chat Schedule Cards stay
([ADR 0030](0030-chat-cards-module-catalog.md)). Card **Изменить**
opens this same detail Sheet. Card Pause still opens that Sheet. The
Card does not pause by itself.

Cluster timezone is unchanged.

This record decides the UI. The code PR adds the Sheets and the
`name` column.

### Ownership

A Schedule is owned by `(botId, personId)`. That person manages it
through the Bot in their turn, and through the closet list when they
can open the Bot. The Owner can always manage it through MCP. Day-1
closet UI still shows only the current person's rows.

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

A later grill the same day promotes the deferred list into day-1 Host
UI: a «Расписания» block in the closet, a create Sheet, and a detail
Sheet. Chat Cards stay. Run history reads the Turn journal. Optional
`name` is a Store field so a row can show a title when `wakeText` is
long.

[ADR 0021](0021-chat-activity-status.md) lists Host schedules as outside
that record. This record is the schedule decision. Weather stays out.

## Consequences

- The code PR adds `schedules` and `cluster_settings.timezone`. This
  record does not.
- The same code path, or a follow-up Host UI PR, adds optional `name`
  on `schedules`, accepts it on MCP create/update, and mounts the
  closet list, create Sheet, and detail Sheet. This record does not
  add that UI.
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
- Run history does not add a table. It lists journal rows.
- Closet PATCH for Manifest fields stays
  [ADR 0020](0020-bot-closet.md). Schedule writes are not that PATCH.

### Out of scope

- Weather Module, weather Skill, weather API, and any Kitchen-style
  seed of weather. Those are not a Host seed in this monorepo.
- Full crontab syntax, an interval of every N minutes, and one-shot
  fires.
- Wakes on a room, a direct message, or a group.
- An SSE ticker and a multi-node lease.
- The Host parsing natural language into a Schedule.
- Listing another person's Schedules in the closet.
- A pause toggle on the list.
- A new runs table.
- A separate Host JSON API for Schedules.
- Free crontab in the cadence UI.
- Changing Skills or self-settings system-line behavior
  ([ADR 0028](0028-bot-self-settings-via-chat.md)).

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
- Defer the Schedule list Sheet — rejected on 2026-09-24. The closet
  list, create Sheet, and detail Sheet are day-1.
- Pause from the list — rejected. Pause only in the detail Sheet.
- Free crontab in the Host UI — rejected. Daily or weekly plus wall
  clock.
- A new runs table for history — rejected. Turn journal rows with
  `trigger` `wake` and this `scheduleId`.
- Day-1 closet lists every person's rows on the Bot — rejected. Own
  rows. Owner MCP for others stays.
- A second REST or JSON API for the closet — rejected. Same Store
  handlers as `dostigus_schedules_*`.
- Replace Chat Cards with the closet list — rejected. Cards stay
  ([ADR 0030](0030-chat-cards-module-catalog.md)). **Изменить** opens
  the same detail Sheet.
