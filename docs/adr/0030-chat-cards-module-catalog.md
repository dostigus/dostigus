# ADR 0030: Chat Cards, Module catalog Apply, and stock Weather

- Status: accepted
- Date: 2026-09-24

Assistant parts stay [ADR 0025](0025-chat-bubble-parts.md). Schedules
and the Wake stay [ADR 0027](0027-bot-schedules.md). The platform
instruction and who may write a Bot stay
[ADR 0028](0028-bot-self-settings-via-chat.md). The Chat tool loop
stays [ADR 0011](0011-chat-mcp-tool-loop.md). Declarative Module
packages stay [ADR 0006](0006-day-1-declarative-modules.md). The Turn
journal stays [ADR 0029](0029-turn-journal.md). Builder stays a
glossary term for later. This record does not run a Builder.

## Decision

Day-1 closes two gaps with Host behavior and one stock Module package.

A **Chat Card** is a Kit Card in the thread. The Host injects it as
assistant message parts after a successful Schedule change, after
Apply, and when the catalog has no matching package. A prose reply
alone leaves the person unsure the Store changed. A system line is not
the Card. The closet is not the Card.

A **Module catalog** is the stock Module package seed in Platform git.
**Apply** copies one hashed seed into the Cluster Store and binds it
on one Bot. The Host image ships the seed and does not enable it on
every Bot.

The first seed is **Weather**. It calls Open-Meteo. It has no Sheet.

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
| `card` | `schedule`, `module`, or `catalog-miss` |
| `title` | Short Host-built fact. Not model prose |
| `body` | Short Host-built line |
| `tone` | `neutral`, `ok`, or `warn` |
| `targetId` | Schedule id or Module package id. Empty on a miss |
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

The same part kind announces Apply. The Weather body is
«Weather подключён». When that turn also creates or confirms a
Schedule, the Host appends the Schedule Card after the module Card.

A catalog miss uses the same kind: title `Module catalog`, body
«Нет такого пакета», tone `warn`, no actions.

The Host appends these parts on the assistant line it stores for the
turn. Module Cards come first, then one Schedule Card per Schedule id.
The last successful Schedule tool for that id sets the body. The
existing parts cap stays. If the completion fails after a tool
succeeded, the stored error line still carries the Cards for the tools
that succeeded.

### Module catalog and Apply

Builder Jobs and a cluster coding sandbox are out of this record.
[ADR 0006](0006-day-1-declarative-modules.md) still forbids arbitrary
in-cluster code. The stock package is Platform data plus Host
handlers. The Bot does not author a Module package.

The catalog lives at `packages/modules/<id>/`. Weather is
`packages/modules/weather/`. That directory is not a pnpm workspace
package: [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) globs
`packages/*` one level deep, and `packages/modules` has no
`package.json`. Do not add a workspace project whose import enables
Weather on every Bot.

Each seed is `module.json` plus `SKILL.md`. Apply hashes those files
with SHA-256 over the sorted relative paths and their UTF-8 bytes, and
stores the hex digest.

`module.json` fields: `id`, `version` (integer), `title`, `summary`
(what the model matches against), `tools` (tool names), `params`
(named parameters), `sheet` (`null` when the package has no Sheet).

The code PR bundles this tree into the Host image. The runtime image
today copies only `apps/web/.output`
([`Dockerfile`](../../Dockerfile)). Apply reads the bundle. Host boot
does not read it to bind Bots.

Apply writes:

| Store | What |
| --- | --- |
| `module_packages` | One Cluster row per seed id: version, content hash, title, Skill markdown, tool names, param schema |
| `bots.modules_json` | Appends the id on `Manifest.modulePackageIds` when it is absent |
| `bots.skills_json` | Upserts Skill id equal to the package id, instructions equal to `SKILL.md` ([ADR 0028](0028-bot-self-settings-via-chat.md)) |
| `bot_module_params` | `(botId, modulePackageId)` and a JSON object of params. Weather uses `location`, a place-name string |

A second Apply of the same id on the same Bot does not insert a second
Skill or a second package id. The same hash leaves the copied bytes in
place and updates `location` when the call includes it. A different
hash updates the copied bytes and the Skill text only because this
Apply ran. Host boot and an image upgrade do not run Apply.

Chat tools, on the Chat allowlist, same in-process handlers as
[ADR 0011](0011-chat-mcp-tool-loop.md). `/mcp` Bearer auth is unchanged
([ADR 0009](0009-mcp-toolkit-endpoint.md)). A rename in the code PR
keeps the `dostigus_` prefix. The Turn journal records the tool name
that ran ([ADR 0029](0029-turn-journal.md)).

| Tool | Who | Behavior |
| --- | --- | --- |
| `dostigus_modules_catalog` | the creator of that Bot, or the Owner | Lists seed id, title, summary, and whether this Bot has that id. Optional `query`. A `query` that matches no seed is the miss: the Host injects the catalog-miss Card. A list with no `query` injects nothing |
| `dostigus_modules_apply` | the creator of that Bot, or the Owner | Applies one seed id. Optional `params.location`. Unknown id: no Store write, catalog-miss Card. Success: module Card |

Match is the model choosing an id from `title` and `summary`, then
calling Apply. The Host does not parse the Chat line into a package
id. Quiet Apply: the creator or the Owner does not get a confirm tap
before Open-Meteo Weather. The Card is the announcement.

A grantee does not receive these two tools. A Member who created the
Bot does, on that Bot, the same actors as Skills
([ADR 0028](0028-bot-self-settings-via-chat.md)). The Owner does, on
any Bot.

### Platform rule

The Host injects one more short instruction on every Bot turn, beside
the [ADR 0028](0028-bot-self-settings-via-chat.md) rule. It is not a
Manifest field and not a Skill. It covers an Owner turn, a Member
turn, a room mention, and a Wake.

The instruction says: when the person needs a capability this Bot does
not have, and this turn may Apply, call the catalog and Apply the
matching stock package. Do not finish on prose that only says the Bot
has no Skill or no module. When the catalog reports no match, stop;
the Host shows the miss Card. A repeated check, including weather or a
jacket, also creates or confirms a Schedule through the Schedule
tools. Do not invent weather observations. Do not author a Module
package. Apply of a catalog id is not authoring. Confirming a
Schedule the person asked to set is list with `intent: set`, or
create. The existing line that the Builder writes Module packages
stays, with that distinction.

On a turn that may not Apply, the Bot does not call Apply and does not
claim that it did.

### Weather seed

`packages/modules/weather/module.json`:

- `id`: `weather`
- `version`: `1`
- `title`: `Weather`
- `summary`: current conditions and a short forecast for jacket advice
  (temperature, feels-like, wind, precipitation), place name as a
  parameter
- `tools`: `dostigus_weather_current`, `dostigus_weather_forecast`
- `params.location`: string, place name
- `sheet`: `null`

`SKILL.md` teaches the Bot to call those tools, to advise a jacket
from `temp`, `feelsLike`, `wind`, and `precip`, and to skip invented
numbers when a tool fails. It states that the location param comes
from the first ask, and that a Wake uses the stored place unless
`wakeText` names another place. The package has no built-in city. The
Дождевик ask is the example: that first ask sets
`Svetlogorsk, Kaliningrad oblast`. The code PR writes the Skill prose.
This record fixes the behavior.

No Weather Sheet. No Kitchen-style weather tables.

The fetch is HTTPS direct to Open-Meteo, not the Cluster LLM gateway
and not OpenRouter:

| Call | URL |
| --- | --- |
| Current and forecast | `https://api.open-meteo.com/v1/forecast` |
| Place name to coordinates | `https://geocoding-api.open-meteo.com/v1/search` |

No API key. Units: Celsius, km/h, millimeters. Current variables:
`temperature_2m`, `apparent_temperature`, `wind_speed_10m`,
`precipitation`, mapped to `temp`, `feelsLike`, `wind`, `precip`.
Forecast is the next 3 days with max and min temperature, max and min
apparent temperature, max wind, and precipitation sum, under the same
four names plus the day. The `timezone` query uses the Cluster
timezone ([ADR 0027](0027-bot-schedules.md)). Geocoding takes the
place string and the first result. No result is a tool error.

`dostigus_weather_current` and `dostigus_weather_forecast` accept an
optional `location`. When it is omitted, the handler uses the stored
param. When that param is missing, the tool errors. The model asks for
a place. The Host does not substitute a city.

These handlers are Platform code, registered for a Bot after Apply.
They are not user-supplied scripts
([ADR 0006](0006-day-1-declarative-modules.md)). They join the Chat
allowlist for every turn on that Bot once the id is bound: Owner,
creator, grantee, room mention, and Wake. The Wake uses the same tool
loop ([ADR 0027](0027-bot-schedules.md),
[ADR 0011](0011-chat-mcp-tool-loop.md)). Before Apply, the tools are
absent.

If `HTTPS_PROXY` or `https_proxy` is set for the LLM gateway, this
fetch does not use that proxy. [`docs/deploy.md`](../deploy.md) tells
the operator to include `api.open-meteo.com` and
`geocoding-api.open-meteo.com` in `NO_PROXY` and `no_proxy`, or the
Host uses a separate fetch that ignores the proxy.

### Upgrade

An image upgrade does not Apply Weather onto existing Bots and does
not rewrite Schedule rows. An existing Дождевик Schedule stays. The
next ask from the creator or the Owner runs the rule: Apply, then the
Chat Cards. Do not put a running Cluster on the image that contains
this behavior until that image is green.

## Context

Schedule tools already write the Store
([ADR 0027](0027-bot-schedules.md)). Chat shows the model's prose. The
person cannot see that the row exists, so they ask again and the
second reply can look empty.

The same gap appears when the Bot has no weather Skill. It answers
that it lacks the module. The Host has no catalog to Apply, and
[ADR 0027](0027-bot-schedules.md) and
[ADR 0028](0028-bot-self-settings-via-chat.md) left Weather out of
those milestones. A morning jacket check needs both a Schedule and a
forecast. Builder is the later path for a package the catalog does not
hold ([ADR 0006](0006-day-1-declarative-modules.md)). It is not how
day-1 gets Open-Meteo.

[ADR 0025](0025-chat-bubble-parts.md) stores button and status parts
on the assistant line and refuses model-authored parts. A Chat Card
extends that family. Tables and forms in the bubble still wait. The
Schedule Sheet is the editor for one row, which
[ADR 0027](0027-bot-schedules.md) deferred as a list.

Kitchen remains a Host seed with no package row
([ADR 0026](0026-kitchen-module-day-1.md)). Weather is the first
catalog seed. Apply is the copy into the Store. The grill on
2026-09-24 locked the Card, the quiet Apply, the Open-Meteo fetch, and
the refusal to bind Weather onto every Bot at upgrade.

## Consequences

- This record is documentation. The code PR adds
  `packages/modules/weather/`, bundles that tree into the Host image,
  adds `module_packages` and `bot_module_params`, extends part parsing
  with kind `card`, registers Sheet id `schedule`, injects the Cards,
  adds the platform rule, adds the catalog and Apply tools, and adds
  the Open-Meteo handlers. Tests cover the equivalent-Schedule Card,
  the miss Card, quiet Apply, the hash, and a Wake that can call
  weather tools only after Apply.
- `messages.parts_json` gains no new column. Kind `card` has to be
  accepted on read or reload drops the Card.
- The Chat allowlist gains `dostigus_modules_catalog` and
  `dostigus_modules_apply` for the creator and the Owner. Weather
  tools appear on a Bot's turns only after Apply. Turn journal list
  and get stay off the Chat allowlist
  ([ADR 0029](0029-turn-journal.md)). Journal rows store the tool name,
  not the forecast and not the arguments.
- Member Chat that is messages-only stays messages-only for a grantee,
  plus the Schedule tools and timezone get already on that list
  ([ADR 0027](0027-bot-schedules.md)). A Member creator also receives
  catalog and Apply on their Bot.
- The prompt line that forbids inventing Module packages stays. Apply
  of a catalog id is the exception the new instruction names.
- Sheet id `schedule` is a Kit Sheet for one row. Kitchen's Sheet id
  is unchanged ([ADR 0026](0026-kitchen-module-day-1.md)).
- The runtime image must contain the seed bytes. Host boot must not
  Apply them.
- Open-Meteo is a separate fetch from the LLM gateway.
  [`docs/deploy.md`](../deploy.md) records `NO_PROXY` /
  `no_proxy` for the two hosts.
- Upgrade the running Cluster only after that Host image is green.
  The Store volume stays. Existing Bots do not gain Weather. Existing
  Schedule rows stay, including a Дождевик Schedule. The next ask
  Applies and shows the Cards.
- The Kitchen Module is still not an applied Module package.

### Out of scope

- Builder Jobs and a cluster coding sandbox.
- Enabling Weather on every Bot in the Host image, and Apply on image
  upgrade or on boot.
- OpenWeather, an API key, and weather numbers invented by the model.
- A Weather Sheet, and a full Schedule list as the primary UI.
- Auto-upgrade of an applied hash without a later Apply call.
- Tables, forms, and other Card kinds in the bubble.
- A Kitchen package in the catalog.
- The Host parsing a sentence into a Schedule or a package id.

## Alternatives

- A system line instead of an assistant part — rejected. The Chat Card
  reloads with the reply, in the [ADR 0025](0025-chat-bubble-parts.md)
  family.
- Confirmation only in the closet — rejected. The person is in the
  thread.
- Ask the model to emit part JSON — rejected. The Host injects the
  Card after the tool result.
- The Host parses «каждое утро…» or a weather sentence — rejected.
  The Bot calls tools. Equivalent create returns `already: true`.
- A Builder Job that writes Weather — rejected here. The catalog seed
  is Platform git. Builder remains later.
- Import Weather as a workspace package that every Bot loads —
  rejected. The seed is files. Apply binds one Bot.
- A root `catalog/` tree — rejected. The layout is
  `packages/modules/<id>/`.
- Bake Open-Meteo into every Bot at image build — rejected. The image
  holds the seed. Apply binds it.
- Apply to every existing Bot on upgrade — rejected. The next ask
  Applies. Stored Schedules stay.
- OpenWeather or a model-written forecast — rejected. Open-Meteo
  tools return the numbers.
- Send Open-Meteo through the LLM `HTTPS_PROXY` — rejected. Direct
  HTTPS. Deploy notes name `NO_PROXY`.
- A Weather Sheet on day-1 — rejected. Tools and `SKILL.md`. The
  module Card has no `openSheet`.
- A Cluster-wide Schedule manager — rejected. Sheet id `schedule` is
  the row the Card names. Delete confirms there.
- A Card button that deletes without confirm — rejected.
- Hardcode Svetlogorsk in the package — rejected. The first ask sets
  `location`. Дождевик is the example ask.
- Treat every list call as «уже стоит» — rejected. List injects that
  Card only with `intent: set` when an enabled equivalent exists.
  Create against that row injects the same Card and does not duplicate
  it in the turn.
