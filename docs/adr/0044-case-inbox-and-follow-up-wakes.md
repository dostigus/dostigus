# ADR 0044: Case inbox and follow-up Wakes

- Status: accepted
- Date: 2026-10-01

Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). Case-lite stays
[ADR 0041](0041-case-lite-on-thread.md). Audiences stay
[ADR 0043](0043-target-personas.md). Personal Schedules stay
[ADR 0027](0027-bot-schedules.md). Threads stay
[ADR 0024](0024-threads-and-bot-visibility.md). This record
names the Case inbox filter and the Case follow-up Wake. It
does not change [SPEC](../SPEC.md) "This Host" runtime, the
Store, or Host code.

Nick locked the sixteen decisions below on 2026-10-01.

## Decision

A **Case inbox** is a filter on the existing messenger
Threads list. It is not a second product surface. A
**follow-up Wake** is a one-shot Wake on the `group` or
`room` Thread that carries the Case. The glossary term
stays **Wake**.

Case-lite fields stay [ADR 0041](0041-case-lite-on-thread.md):
status, label, nextAction. This record adds `followUpAt`
and `followUpBotId`. `nextAction` stays the free-text what.

### Inbox contents

The filter returns Threads where `case.status` is `open`
and the signed-in person is a Participant. It is not
cluster-wide open Cases. `done` Cases are out of the
filter by default. The unfiltered list (All) is unchanged.

The same filter applies to the Owner-operator (Collective
N=1). There is no second inbox rule for one person.

### Chrome

Filter chips sit over the messenger chat list (example:
All / Case open). Not a Dashboard page. Not a second
inbox column. Not a separate Case list chrome. No
`/cases` product page
([ADR 0041](0041-case-lite-on-thread.md) still stands).

### Follow-up Wake target

When follow-up fires, the Host writes a **Wake** on the
`group` or `room` Thread that carries the Case, then
runs a Bot turn on that Thread. This amends
[ADR 0027](0027-bot-schedules.md): personal Schedules
still fire only on bot-threads. Case follow-up is a
sibling fire path, not a Schedule row.

### When and who

New Case fields:

| Field | Shape | Store column |
| --- | --- | --- |
| `followUpAt` | datetime, Cluster timezone | `threads.case_follow_up_at` |
| `followUpBotId` | Bot id | `threads.case_follow_up_bot_id` |

`nextAction` stays free text (what). No sales due, SLA,
or priority.

Any person Participant may write these fields. Same gate
as Case PATCH in [ADR 0041](0041-case-lite-on-thread.md).
No Admin gate. Bot MCP Case write is later, not this
record.

`followUpBotId` is required when `followUpAt` is set.
That Bot must be a Participant on that Thread. Host UI
picks from Bot Participants (implementation later).

### Inbox API

Query the existing Threads list, for example
`GET /api/threads?caseStatus=open`. Not a separate Case
product DTO list. Not a client-only filter.

GET still nests Case on the existing Thread DTO. After
this record the nested shape adds the two fields:

```
case: null | {
  status: "open" | "done",
  label: string,
  nextAction: string,
  followUpAt: string | null,
  followUpBotId: string | null
}
```

`PATCH /api/threads/:id/case` accepts the same two
fields. Setting `status` to `done` clears follow-up
(`followUpAt` and `followUpBotId` become null). Fire
does not run on a `done` Case.

### Wake text

The visible system line is the Case `label`. Fallback
is the Thread title, then «Case». LLM `wakeText` for
that turn is `nextAction` (plus label context as
needed). Same Wake family as a Schedule Wake
([ADR 0027](0027-bot-schedules.md),
[ADR 0032](0032-chat-llm-context-assembly.md)).

### Cadence

One-shot. After fire: clear `followUpAt` and
`followUpBotId`. The Case stays `open` unless a person
marks it `done`. Recurring stays an ordinary bot-thread
Schedule, not a Case field.

### Store

Nullable columns on `threads` (`case_follow_up_at`,
`case_follow_up_bot_id`). The Host ticker / runner is a
sibling to Schedules. No `cases` table. Do not stuff
follow-up into personal Schedule rows as the primary
model.

### Bot left the room

If `followUpBotId` is no longer a Bot Participant when
fire is due, or when that Bot is removed, skip the fire
and clear the follow-up fields. The Case stays `open`.

### UI (later implementation)

Document intent only. This PR does not ship UI.

- Filter chips over the messenger Threads list.
- Follow-up controls live in the same Case block as
  [ADR 0041](0041-case-lite-on-thread.md): roster Sheet
  plus the compact line under the identity pill.

### Scope of this record

Docs only. Implementation and any Port land in a
separate PR after a merge ask.

## Context

[ADR 0041](0041-case-lite-on-thread.md) put a thin Case
on a Thread and deferred the inbox.
[ADR 0043](0043-target-personas.md) named Case inbox
plus follow-up Wakes as the next must-have for Team.
Personal Schedules already fire a Wake on a bot-thread
([ADR 0027](0027-bot-schedules.md)). A shared Case needs
the same Wake family on the Thread that holds the work,
not a second tracker and not a personal Schedule row.

Filter chips on the existing messenger list keep Case
on the Thread. A Dashboard page or `/cases` would fork
the product toward a ticket tracker, which
[ADR 0040](0040-collective-host-direction.md) rejected.
A cluster-wide open-Case list would leak Threads the
signed-in person is not on.

Nullable columns on `threads` keep follow-up on the
object it describes. A `cases` table would imply many
Cases per Thread. Stuffing follow-up into `schedules`
would mix a personal bot-thread clock with a shared
room fire.

## Consequences

- Docs only. No Store migration, route, Host UI, MCP
  surface, or Port change in this record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) amends
  **Case**, **Wake**, and **Schedule**. Room / group
  Case follow-up is an allowed Wake. Personal Schedule
  stays bot-thread-only. The term stays **Wake**.
- [ADR 0041](0041-case-lite-on-thread.md) on-thread
  fields, person-Participant write, and no `/cases`
  page still stand. The deferred inbox is this record.
- [ADR 0043](0043-target-personas.md) next must-have
  is now named here. Admin Cluster Bot list and Member
  onboarding stay should-next.
- [ADR 0027](0027-bot-schedules.md) is amended: Case
  follow-up may fire a Wake on the Case Thread.
  Personal Schedule fire stays bot-thread-only.
- SPEC "In scope" lists the inbox filter and follow-up
  as accepted direction. SPEC "This Host" stays
  unchanged until the implementation PR. That PR adds
  the two columns, the list query, PATCH fields, the
  sibling ticker path, filter chips, and the Case-block
  controls.
- A sales due / SLA / priority, Case on a `dm` or
  bot-thread, a Dashboard Case page, a `cases` table,
  a Case product DTO list, client-only filter, Bot MCP
  Case write, and recurring Case follow-up stay later
  or rejected as below.

## Alternatives

- Cluster-wide open Cases — rejected. Participant
  only.
- Include `done` in the default filter — rejected.
- Dashboard Case page or `/cases` chrome — rejected.
  [ADR 0041](0041-case-lite-on-thread.md) still stands.
- A second inbox column or separate Case list chrome
  — rejected. Filter chips on the messenger list.
- Client-only filter — rejected. Query the existing
  Threads list (`?caseStatus=open`).
- A new GET `/api/cases` or Case-only DTO list —
  rejected.
- Fire the follow-up on a bot-thread — rejected. Wake
  lands on the Thread that carries the Case.
- Reuse a personal Schedule row as the primary
  follow-up model — rejected. Sibling columns + ticker
  path.
- A `cases` table — rejected. Nullable columns on
  `threads`.
- Infer the Bot when `followUpAt` is set — rejected.
  Explicit `followUpBotId`, and that Bot must be a
  Participant.
- Admin-only follow-up write — rejected. Same person
  Participant gate as Case PATCH.
- Bot MCP Case write in this record — rejected. Later.
- Sales due, SLA, or priority — rejected.
  [ADR 0040](0040-collective-host-direction.md) and
  [ADR 0041](0041-case-lite-on-thread.md).
- Recurring Case follow-up — rejected. One-shot.
  Recurring stays a bot-thread Schedule.
- Keep the Case `done` follow-up and fire it —
  rejected. `done` clears follow-up.
- Fire after the Bot left the Thread — rejected. Skip
  and clear. Case stays `open`.
- A different glossary term for the room fire —
  rejected. The term is **Wake**.
- A different inbox rule for Owner-operator N=1 —
  rejected. Same filter.
- Implementation or Port in this PR — rejected. Docs
  only.
