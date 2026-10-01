# ADR 0041: Case-lite on a Thread

- Status: accepted
- Date: 2026-10-01

Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). Threads and Bot
visibility stay [ADR 0024](0024-threads-and-bot-visibility.md).
Household Members stay [ADR 0012](0012-household-members.md).
This record names the glossary term, the Store shape, and the
Host API. It does not change [SPEC](../SPEC.md) "This Host"
runtime, the Store, or Host code.

Nick locked the ten decisions below on 2026-10-01.

## Decision

A **Case** is a thin layer on one Thread: a status, a label, and
a next action. It is not a ticket tracker. Case-lite is the
wedge name from [ADR 0040](0040-collective-host-direction.md).
The glossary term is **Case**. Product copy, ADRs, and UI chrome
do not say Ticket or Issue.

### Thread kinds

A Case exists only on `group` and `room`. A `dm` and a
bot-thread (`kind` `bot`) never carry a Case. Those kinds reject
the write.

### Fields v1

| Field | Shape | Store column |
| --- | --- | --- |
| `status` | enum `open` \| `done` | `threads.case_status` |
| `label` | free string, max 40 | `threads.case_label` |
| `nextAction` | free string, max 120 | `threads.case_next_action` |

No assignee. No due date. No priority.

`label` and `nextAction` may be empty. After the first write,
`status` is always `open` or `done`.

### Who edits

Any person Participant on that Thread may write the Case. There
is no Admin gate. The roles ADR is not done yet
([ADR 0040](0040-collective-host-direction.md)). A Bot session
does not write a Case. The Owner has no extra Case right beyond
being a person Participant.

The same people who can `GET` the Thread can read its Case.

### Empty

There is no Case until the first `PATCH`. An untouched Thread
has all three columns null. The Host DTO then sends `case: null`.
The later UI shows empty / «добавить Case». There is no delete
that returns a Case to null. Once created, the Thread keeps a
Case (`status` stays `open` or `done`).

The first `PATCH` creates the Case. If that body omits `status`,
the Host writes `open`. A later `PATCH` may send any subset of
the three fields. At least one field is required.

### Status flip

`done` ↔ `open` is allowed. `done` does not archive the Thread.
The Thread stays in the inbox as a normal `group` or `room`.

### Inbox

v1 has no sidebar «open Cases» and no Case filter. Case UI lives
only on the Thread. An inbox of open Cases is later.

### Store

Nullable columns on `threads`: `case_status`, `case_label`,
`case_next_action`. Not a separate table. Not a JSON blob. A
fresh Thread and an existing Thread with no Case both have
nulls. The implementation PR adds those columns through the
usual six-edit Store path. This record does not.

### API

`PATCH /api/threads/:id/case` writes the Case. The caller must
be a person Participant (the same Host session gate as
`GET /api/threads/:id` and
`POST /api/threads/:id/participants`). A `dm` or bot-thread is
not found for this path.

Body:

```
{ status?: "open" | "done", label?: string, nextAction?: string }
```

At least one field. `label` longer than 40 or `nextAction`
longer than 120 is a validation error. An unknown `status` is a
validation error. Trim; whitespace-only `label` or `nextAction`
stores empty.

GET is nested on the existing Thread DTO (`GET /api/threads/:id`
and the inbox list item). Shape:

```
case: null | { status: "open" | "done", label: string, nextAction: string }
```

`case` is `null` when the three columns are null. After the
first write, `label` and `nextAction` are strings (empty when
the column is null or empty).

No new list route. No Case MCP tools in this record. Chat does
not receive a Case write tool.

### UI (later implementation)

Document intent only. This PR does not ship UI.

- Top of the roster Sheet (the identity pill on a `group` or
  `room` already opens that Sheet,
  [ADR 0024](0024-threads-and-bot-visibility.md)).
- A compact line under the Chat identity pill.
- No separate Case page. No `/cases` route. No Dashboard Case
  list.

The compact line shows the Case when `case` is present, and
empty / «добавить Case» when `case` is `null`. **Case** stays
Latin in both Locales
([ADR 0037](0037-host-ui-i18n.md)).

## Context

[ADR 0040](0040-collective-host-direction.md) put Case-lite
second in the Collective Host wedge, after Rooms gaps, and left
the Store shape and the glossary term to this record. A Case
sits on a Thread that already exists. It is not a new product
surface and not a tracker with assignees, due dates, or a
pipeline.

`group` and `room` are the shared work Threads. A `dm` is two
people. A bot-thread is one person and one Bot. Those two kinds
are the wrong place for a shared next action.

The Admin role is named in
[ADR 0040](0040-collective-host-direction.md) and is not in this
Host yet. Waiting for that ADR would block a three-field write
that any person on the Thread can already see. v1 therefore
uses the existing person-Participant gate.

Nullable columns on `threads` keep Case on the object it
describes. A side table would imply many Cases per Thread. A
JSON blob would hide the status from a later inbox filter.

## Consequences

- Docs only. No Store migration, route, Host UI, or MCP surface
  change in this record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) adds **Case**.
  Thread notes that only `group` and `room` may carry one.
- [ADR 0040](0040-collective-host-direction.md) now points here
  for Case-lite.
- SPEC "In scope" lists Case as accepted direction, not in this
  Host yet. The SPEC "This Host" Store list stays unchanged
  until the implementation PR. That PR adds the three columns,
  the PATCH route, the nested DTO field, and the two UI
  placements.
- Inbox filters, a Case list, assignee / due / priority, Case
  on a `dm` or bot-thread, a separate Case page, and Case MCP
  tools stay later or rejected as below.
- The roles ADR may later narrow who writes a Case. Until then
  any person Participant writes.

## Alternatives

- Glossary term Ticket or Issue — rejected. The term is **Case**.
- A Case on a `dm` or a bot-thread — rejected. Shared work is
  `group` and `room`.
- Assignee, due date, or priority in v1 — rejected. Three
  fields only.
- An Admin-only write gate — rejected until the roles ADR.
  v1 is any person Participant.
- A separate Case page or `/cases` chrome — rejected. Roster
  Sheet plus the identity-pill line.
- A Case row on every new `group` or `room` — rejected. No Case
  until the first `PATCH`.
- `done` archives or hides the Thread — rejected. Status flip
  does not change Thread membership or inbox presence.
- Sidebar «open Cases» or v1 inbox filters — rejected. On-thread
  UI only. Inbox later.
- A `cases` table or a JSON blob on `threads` — rejected.
  Three nullable columns.
- A new GET `/api/cases` or a Case-only DTO — rejected. PATCH
  on the Thread; GET nested in the existing Thread DTO.
- A ticket tracker (pipeline, sla, watchers) — rejected.
  [ADR 0040](0040-collective-host-direction.md): Bots reach that
  class of system through MCP or an API.
