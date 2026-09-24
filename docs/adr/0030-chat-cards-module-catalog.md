# ADR 0030: Chat Cards for Schedule, Skill, and self-settings changes

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — Nick reverse decision. This monorepo ships no stock Module packages and no Weather seed. Schedule Chat Cards stay. A Marketplace of packages is later.
- Amended: 2026-09-24 — Nick: on Bot create the Host inserts missing meta Skills (constructor how-to). The seed is insert-if-missing and does not call `upsertBotSkill`. Still no stock Module packages and no Weather seed.
- Amended: 2026-09-24 — Chat Cards also follow a successful Skill upsert or delete, and a successful `dostigus_bots_update` of name, label, or description. Card kind `bot` is that self-settings Card. Sheet id `bot` opens the existing Bot Параметры closet.

Assistant parts stay [ADR 0025](0025-chat-bubble-parts.md). Schedules
and the Wake stay [ADR 0027](0027-bot-schedules.md). The platform
instruction and who may write a Bot stay
[ADR 0028](0028-bot-self-settings-via-chat.md). The Chat tool loop
stays [ADR 0011](0011-chat-mcp-tool-loop.md). Declarative Module
packages stay [ADR 0006](0006-day-1-declarative-modules.md). The Turn
journal stays [ADR 0029](0029-turn-journal.md). Builder stays a
glossary term for later. This record does not run a Builder.

## Decision

Day-1 closes the silent-success gap for Schedule changes, Skill
upsert and delete, and Bot self-settings (name, label, description)
with a Host-injected Chat Card. It does not close capability gaps by
shipping a ready Module package.

A **Chat Card** is a Kit Card in the thread. The Host injects it as
assistant message parts after a successful Schedule change, a
successful Skill upsert or delete, or a successful
`dostigus_bots_update` that sets name, label, or description. A prose
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
stock package. On Bot create the Host also inserts missing meta Skills
that teach those tools. The seed is insert-if-missing and does not call
`upsertBotSkill` (that call replaces instructions). The rows are plain
Skill text. The ids and the insert-if-missing rule are under Consequences.

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

The Host appends these parts on the assistant line it stores for the
turn. One Schedule Card per Schedule id. The last successful Schedule
tool for that id sets the body. The existing parts cap counts every
Card on the turn. If the completion fails after a tool succeeded, the
stored error line still carries the Cards for the tools that succeeded.

### Skill Cards

The Host injects a Chat Card after a successful
`dostigus_skills_upsert` or `dostigus_skills_delete`.
`dostigus_skills_list` injects nothing. The model does not emit the
part.

The Card kind is `skill`. `targetId` is the Skill id. One turn stores
at most one Skill Card per Skill id. A later successful upsert or
delete of that id in the same turn replaces the body.

| Result | Title | Body | Tone | Actions |
| --- | --- | --- | --- | --- |
| upsert | Skill id | the first non-empty line of instructions when it fits the part label cap, otherwise «записан» | `ok` | Изменить |
| delete | Skill id | «Удалено» | `warn` | none |

Изменить is `openSheet` with Sheet id `skill` and that Skill id. The
Sheet is that Skill on the Bot of the assistant line. It shows id and
instructions. Save calls the same upsert the Chat tool uses. If the
id changes, the Sheet writes the new id and deletes the previous id.
Delete asks for confirm in the Sheet. The Card does not delete by
itself. Who may write stays
[ADR 0028](0028-bot-self-settings-via-chat.md): the creator of that
Bot, or the Owner.

A delete Card stays on the old line. Opening a Sheet for a Skill that
is gone says the Skill is gone. The Host does not rewrite the stored
Card.

### Self-settings Cards

The Host injects a Chat Card after a successful `dostigus_bots_update`
when that call sets `name` and/or `label` and/or `description`.
`dostigus_bots_list` and `dostigus_bots_get` inject nothing. A call
that sets only avatar or Model tier injects nothing.

The Card kind is `bot`. That kind is the self-settings Card.
`targetId` is the Bot id. One turn stores at most one Card of this
kind per Bot id. The last successful update in that turn sets the
body.

| Result | Title | Body | Tone | Actions |
| --- | --- | --- | --- | --- |
| update | the Bot name after the write, shortened to the part label cap when the name is longer | the label when it is set and fits the part label cap, otherwise «обновлено» | `ok` | Изменить |

Изменить is `openSheet` with Sheet id `bot` and that Bot id. Sheet id
`bot` is the existing Bot Параметры closet (`BotSettingsSheet`). It
does not add a second closet. On that Bot's Chat the button opens the
closet already on the page. In a room it opens the same closet for
the Bot id on the Card.

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
a capability gap. The same day, Nick allowed a Host seed of meta
Skills on Bot create: constructor how-to as plain Skill text, so a new
Bot can read how those tools work. That seed is not a package. A
Marketplace of packages is later, as a cloud product. Builder remains
the later path that writes a Module package
([ADR 0006](0006-day-1-declarative-modules.md)).

[ADR 0025](0025-chat-bubble-parts.md) stores button and status parts
on the assistant line and refuses model-authored parts. A Chat Card
extends that family. Tables and forms in the bubble still wait. The
Schedule Sheet is the editor for one row, which
[ADR 0027](0027-bot-schedules.md) deferred as a list.

Kitchen remains a Host seed with no package row
([ADR 0026](0026-kitchen-module-day-1.md)). It is not a catalog seed.

## Consequences

- This record is documentation plus the Host that injects the Cards.
  Part parsing accepts kind `card` with card kinds `schedule`,
  `skill`, and `bot`. Sheet id `schedule` is one Schedule. Sheet id
  `skill` is one Skill. Sheet id `bot` opens the existing Bot
  Параметры closet. Tests cover the equivalent-Schedule Card, Skill
  upsert and delete, and `dostigus_bots_update` of name, label, or
  description. The code does not add `packages/modules/`, catalog or
  Apply tools, Open-Meteo handlers, or a Host-bundled stock package.
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
- Sheet id `schedule` is a Kit Sheet for one row. Sheet id `skill`
  is a Kit Sheet for one Skill (id and instructions). Sheet id `bot`
  opens the existing Параметры closet and does not add a second one.
  Kitchen's Sheet id is unchanged
  ([ADR 0026](0026-kitchen-module-day-1.md)).
- The runtime image does not gain a Module catalog seed. Host boot
  does not Apply a platform package. Boot does not rewrite meta Skill
  text.
- The Kitchen Module is still not an applied Module package.
- **Meta Skills.** On Bot create the Host inserts a fixed set of Skill
  rows on that Bot when each id is absent (insert-if-missing). It does
  not call `upsertBotSkill`. They are constructor how-to: plain Skill text in
  `bots.skills_json` (`{ id, instructions }`, as
  [ADR 0028](0028-bot-self-settings-via-chat.md)). They are not Module
  packages, not MCP tools, not Apply, and not files under
  `packages/modules/`. No new column and no new tool.
- The Store Skill is one `instructions` string. There is no locale
  column and no English twin. This codebase does not dual-locale
  Skills, so the seed text is Russian markdown only, inside the
  existing instructions cap.
- Stable ids. A Skill id is letters, digits, `_`, or `-`. A dotted id
  such as `platform.meta.schedules` is not a Skill id. The set is
  closed:

| Id | The Russian instructions teach |
| --- | --- |
| `platform-meta-schedules` | Schedule tools: create, list, pause, and edit (`dostigus_schedules_create`, `dostigus_schedules_list`, `dostigus_schedules_pause`, `dostigus_schedules_update`, plus resume and delete from [ADR 0027](0027-bot-schedules.md)). |
| `platform-meta-skills` | Skills tools: list, upsert, and delete Skill text on this Bot. |
| `platform-meta-self-settings` | Bot self-settings: name, label, and description through `dostigus_bots_update`. A successful tool result is still required ([ADR 0028](0028-bot-self-settings-via-chat.md)). |
| `platform-meta-marketplace` | Domain Module packages come later through Marketplace. Do not invent weather tools, a Weather Skill, or a Module package. |

- Insert when that id is absent (insert-if-missing). An id that is
  already stored keeps its instructions. Create is idempotent: a later
  pass does not rewrite text the creator or the Owner already changed.
  The seed does not call `upsertBotSkill` or `dostigus_skills_upsert`.
  `upsertBotSkill` replaces instructions for the same id. The seed
  writes a missing id only.
- Image upgrade is not Apply. It does not rewrite these rows on an
  existing Bot that already has any of these ids. The exception is a
  Bot that has none of these ids (created before the seed, or emptied
  of them): the Host may insert the set once. A partial delete stays
  deleted. An edit stays. Host boot does not force-overwrite.
- The creator of that Bot, or the Owner, may edit or delete any of
  these rows with `dostigus_skills_list`, `dostigus_skills_upsert`, and
  `dostigus_skills_delete`. A grantee cannot. Those tools stay
  [ADR 0028](0028-bot-self-settings-via-chat.md).
- The platform instruction stays on every turn. It is not one of these
  Skills. Rename, Schedule changes, and other self-edits stay a
  platform duty if a meta Skill is deleted.
- Inserting these rows does not add `packages/modules/`, catalog or
  Apply tools, or a Weather seed.
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
- Tables and forms in the bubble. Cards for every MCP tool. Card
  kinds other than `schedule`, `skill`, and `bot`.
- A Kitchen package in a catalog.
- The Host parsing a sentence into a Schedule or a package id.
- Force-overwrite of meta Skill instructions on Host boot, or on image
  upgrade when any of the four ids is already stored.
- Restoring one deleted meta Skill while another of the four remains.
- An English copy of these Skills, or a locale column on a Skill.
- A dotted Skill id (`platform.meta.schedules` and the same shape).
- Shipping the how-to as a Module package, an MCP tool, or
  `packages/modules/**`.

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
- Dotted meta Skill ids (`platform.meta.schedules`) — rejected. A Skill
  id is letters, digits, `_`, or `-`.
- Overwrite meta Skills on every boot — rejected. The creator or the
  Owner may edit or delete them. Insert runs when the id is absent.
  An existing Bot is filled only when it has none of the four ids.
- Put the how-to in a Module package, an MCP tool, or
  `packages/modules/**` — rejected. The rows are plain Skills.
- Russian and English instruction columns — rejected. The Store Skill
  is one `instructions` string. This codebase has no dual-locale
  Skills, so the seed is Russian only.
- A weather how-to Skill — rejected with the Weather seed.
