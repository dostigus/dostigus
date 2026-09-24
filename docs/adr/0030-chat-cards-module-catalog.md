# ADR 0030: Chat Cards for Schedule changes

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — Nick reverse decision. This monorepo ships no stock Module packages and no Weather seed. Schedule Chat Cards stay. A Marketplace of packages is later.

Assistant parts stay [ADR 0025](0025-chat-bubble-parts.md). Schedules
and the Wake stay [ADR 0027](0027-bot-schedules.md). The platform
instruction and who may write a Bot stay
[ADR 0028](0028-bot-self-settings-via-chat.md). The Chat tool loop
stays [ADR 0011](0011-chat-mcp-tool-loop.md). Declarative Module
packages stay [ADR 0006](0006-day-1-declarative-modules.md). The Turn
journal stays [ADR 0029](0029-turn-journal.md). Builder stays a
glossary term for later. This record does not run a Builder.

## Decision

Day-1 closes the Schedule confirmation gap with a Host-injected Chat
Card. It does not close capability gaps by shipping a ready Module
package.

A **Chat Card** is a Kit Card in the thread. The Host injects it as
assistant message parts after a successful Schedule change. A prose
reply alone leaves the person unsure the Store changed. A system line
is not the Card. The closet is not the Card.

This Platform monorepo ships **no stock Module packages** and **no
Weather seed**. There is no `packages/modules/` catalog seed, no
Host-bundled Apply of platform packages, and no Open-Meteo Module in
this repo. A Marketplace of packages is a later cloud product. It is
out of this record's day-1.

A missing capability uses the constructor tools already in Chat: Skills
upsert, Schedule tools, and Bot self-settings
([ADR 0028](0028-bot-self-settings-via-chat.md)). Those tools are not a
stock package.

### Chat Cards

The person asks for a Schedule. The Bot calls the Schedule tools
([ADR 0027](0027-bot-schedules.md)). The thread then shows only the
assistant's prose, so a later ask looks silent and a duplicate ask
looks like nothing was stored. The Host writes a Chat Card onto the
assistant line of that turn.

The Host injects the Card after a successful
`dostigus_schedules_create`, `dostigus_schedules_update`,
`dostigus_schedules_pause`, `dostigus_schedules_resume`, or
`dostigus_schedules_delete`. The model does not emit parts
([ADR 0025](0025-chat-bubble-parts.md)).

The Host still does not parse the sentence. It learns what happened
from the tool call. `dostigus_schedules_list` accepts an optional
`intent` of `set` plus the proposed `cadence`, `timeLocal`, and
`daysOfWeek`. The
platform rule tells the Bot to pass that intent when the person asked
to set a Schedule and the Bot lists first. A list with no `intent`
injects nothing.

An enabled Schedule for the same `(botId, personId)` with the same
`cadence`, `timeLocal`, and `daysOfWeek` is already standing. List
with `intent: set` that finds that row injects the Schedule Chat Card
with body «уже стоит» and does not write. `dostigus_schedules_create`
against that row does not insert another row and does not change
`wakeText`. It returns the row with `already: true` and injects the
same Card. One turn stores at most one Schedule Card per Schedule id.
A later successful pause, resume, update, or delete in that turn
replaces the body. A paused row with the same clock is not already
standing. The rule tells the Bot to call resume. Resume injects its
own Card.

The Card is one part, kind `card`, in `messages.parts_json`, on the
assistant line. User and system lines still have no parts. Reload
keeps the Card the same way it keeps a button part. A reader that
drops unknown kinds must accept `card`.

| Field | Meaning |
| --- | --- |
| `card` | `schedule` |
| `title` | Short Host-built fact. Not model prose |
| `body` | Short Host-built line |
| `tone` | `neutral`, `ok`, or `warn` |
| `targetId` | Schedule id |
| `actions` | Buttons. Empty when there is nothing to open |

A Schedule Card title is the cadence and `timeLocal` (`daily 08:00`,
or `weekly` plus the weekdays and the time). Actions:

| Label | Action |
| --- | --- |
| Pause | `openSheet` Sheet id `schedule`, with that Schedule id |
| Изменить | the same Sheet and the same id |

Delete is not a Card button. The Sheet confirms, then deletes. Both
Card buttons open that Sheet. The Card does not pause or delete by
itself.

Sheet id `schedule` is one Schedule, the id on the action. It shows
cadence, time, weekdays, `wakeText`, and paused. It can pause, resume,
save those fields, and delete. Delete asks for confirm in the Sheet.
It is not a list of every Schedule in the Cluster. Who may write stays
[ADR 0027](0027-bot-schedules.md): that person, or the Owner.

Bodies the Host writes:

| Result | Body | Tone | Actions |
| --- | --- | --- | --- |
| create, new row | `wakeText` when it fits the part label cap, otherwise the title | `ok` | Pause, Изменить |
| update or resume | `wakeText` when it fits, otherwise the title | `ok` | Pause, Изменить |
| already standing | «уже стоит» | `ok` | Pause, Изменить |
| pause | «На паузе» | `warn` | Pause, Изменить |
| delete | «Удалено» | `warn` | none |

A delete Card stays on the old line. Opening it later shows a Sheet
that says the Schedule is gone. The Host does not rewrite the stored
Card.

The Host appends this part on the assistant line it stores for the
turn. One Schedule Card per Schedule id. The last successful Schedule
tool for that id sets the body. The existing parts cap stays. If the
completion fails after a tool succeeded, the stored error line still
carries the Cards for the tools that succeeded.

### No stock packages

Builder Jobs, a cluster coding sandbox, and a Marketplace are out of
this record. [ADR 0006](0006-day-1-declarative-modules.md) still
forbids arbitrary in-cluster code. The Bot does not author a Module
package.

Day-1 does not add:

- a Module catalog seed at `packages/modules/<id>/`
- `dostigus_modules_catalog` or `dostigus_modules_apply`
- a platform rule that the Bot must Apply a matching stock package
- a Chat Card after Apply, including any Weather card
- an Open-Meteo Module, a weather Skill, or weather hosts in
  `NO_PROXY` as a Module requirement
- baking platform packages into the Host image

[ADR 0027](0027-bot-schedules.md) and
[ADR 0028](0028-bot-self-settings-via-chat.md) leave Weather out. This
amendment keeps that exclusion. A morning jacket check is not a stock
package in this repo.

## Context

Schedule tools already write the Store
([ADR 0027](0027-bot-schedules.md)). Chat shows the model's prose. The
person cannot see that the row exists, so they ask again and the
second reply can look empty. A Chat Card closes that gap.

The same morning can also need a capability the Bot does not have yet.
An earlier draft of this record closed that gap with a stock Weather
seed (Open-Meteo) and a Module catalog the Host would Apply from
Platform git. Nick reversed that on 2026-09-24. This monorepo does not
ship ready packages. Skills upsert, Schedule tools, and Bot
self-settings already in Chat
([ADR 0028](0028-bot-self-settings-via-chat.md)) are how day-1 closes
a capability gap. A Marketplace of packages is later, as a cloud
product. Builder remains the later path that writes a Module package
([ADR 0006](0006-day-1-declarative-modules.md)).

[ADR 0025](0025-chat-bubble-parts.md) stores button and status parts
on the assistant line and refuses model-authored parts. A Chat Card
extends that family. Tables and forms in the bubble still wait. The
Schedule Sheet is the editor for one row, which
[ADR 0027](0027-bot-schedules.md) deferred as a list.

Kitchen remains a Host seed with no package row
([ADR 0026](0026-kitchen-module-day-1.md)). It is not a catalog seed.

## Consequences

- This record is documentation. The code PR extends part parsing with
  kind `card`, registers Sheet id `schedule`, and injects the Schedule
  Cards. Tests cover the equivalent-Schedule Card. The code PR does
  not add `packages/modules/`, catalog or Apply tools, Open-Meteo
  handlers, or a Host-bundled stock package.
- `messages.parts_json` gains no new column. Kind `card` has to be
  accepted on read or reload drops the Card.
- The Chat allowlist does not gain `dostigus_modules_catalog` or
  `dostigus_modules_apply`. It does not gain weather tools. Turn
  journal list and get stay off the Chat allowlist
  ([ADR 0029](0029-turn-journal.md)). Journal rows store the tool name,
  not a forecast and not the arguments.
- Member Chat that is messages-only stays messages-only for a grantee,
  plus the Schedule tools and timezone get already on that list
  ([ADR 0027](0027-bot-schedules.md)). A Member creator still receives
  Skills tools and `dostigus_bots_update` on their Bot
  ([ADR 0028](0028-bot-self-settings-via-chat.md)).
- The prompt line that forbids inventing Module packages stays. There
  is no stock-package exception.
- Sheet id `schedule` is a Kit Sheet for one row. Kitchen's Sheet id
  is unchanged ([ADR 0026](0026-kitchen-module-day-1.md)).
- The runtime image does not gain a Module catalog seed. Host boot
  does not Apply a platform package.
- The Kitchen Module is still not an applied Module package.
- [`docs/deploy.md`](../deploy.md) does not require Open-Meteo hosts
  in `NO_PROXY` for a Module.

### Out of scope

- Stock Module packages and a Weather seed in this repo.
- `packages/modules/**`, Host-bundled Apply of platform packages, and
  baking packages into the Host image.
- Builder Jobs and a cluster coding sandbox.
- A Marketplace of packages (later cloud product).
- `dostigus_modules_catalog`, `dostigus_modules_apply`, and a platform
  rule that must Apply a matching stock package.
- A Chat Card after Apply, and a catalog-miss Card.
- Open-Meteo, OpenWeather, an API key, and weather numbers invented
  by the model.
- A Weather Sheet, and a full Schedule list as the primary UI.
- Tables, forms, and other Card kinds in the bubble.
- A Kitchen package in a catalog.
- The Host parsing a sentence into a Schedule or a package id.

## Alternatives

- A system line instead of an assistant part — rejected. The Chat Card
  reloads with the reply, in the [ADR 0025](0025-chat-bubble-parts.md)
  family.
- Confirmation only in the closet — rejected. The person is in the
  thread.
- Ask the model to emit part JSON — rejected. The Host injects the
  Card after the tool result.
- The Host parses «каждое утро…» — rejected. The Bot calls tools.
  Equivalent create returns `already: true`.
- Ship a stock Weather package (Open-Meteo) and Apply it from a
  Module catalog in this repo — rejected on 2026-09-24. No
  `packages/modules/` seed, no catalog or Apply tools, no Card after
  Apply. Marketplace is later.
- A platform rule that must Apply a matching stock package — rejected
  with that seed. Capability gaps use Skills upsert, Schedule tools,
  and Bot self-settings already in Chat.
- A Builder Job that writes Weather in this record — rejected. Builder
  remains later.
- Bake packages into the Host image — rejected. This image does not
  carry a stock Module package.
- A Cluster-wide Schedule manager — rejected. Sheet id `schedule` is
  the row the Card names. Delete confirms there.
- A Card button that deletes without confirm — rejected.
- Treat every list call as «уже стоит» — rejected. List injects that
  Card only with `intent: set` when an enabled equivalent exists.
  Create against that row injects the same Card and does not duplicate
  it in the turn.
