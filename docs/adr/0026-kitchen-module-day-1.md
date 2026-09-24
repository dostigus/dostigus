# ADR 0026: Kitchen Module day-1

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24 — Kitchen stays this Host seed. [ADR 0030](0030-chat-cards-module-catalog.md) does not add a Module catalog or Apply of a stock package.

Bubble parts stay [ADR 0025](0025-chat-bubble-parts.md). Sheets stay Kit
drawers ([ADR 0002](0002-host-ui-kit-and-sheets.md)). Declarative Module
packages stay [ADR 0006](0006-day-1-declarative-modules.md). The Host
and the MCP surface share Store helpers
([ADR 0008](0008-host-store-routes.md),
[ADR 0009](0009-mcp-toolkit-endpoint.md)). Threads and Bot visibility
stay [ADR 0024](0024-threads-and-bot-visibility.md) and are not built
here.

## Decision

Day-1 Kitchen is a **seed** of a Module package, not an installed
Module package and not a Meal port.

The Cluster Store holds one Household kitchen:

| Table | Rows |
|-------|------|
| `kitchen_pantry` | name, optional qty text |
| `kitchen_cooked` | label, `10` XP each, optional person id |
| `kitchen_recipe` | one recipe: name and ingredients text |

XP is the sum of cooked rows. There is no second recipe and no meal plan.

The MCP surface adds five tools. They use the same Store helpers as the
Host routes. Owner and Member sessions may list and add pantry, mark
cooked, and get or save the recipe. `/mcp` stays Bearer-gated and does
not read the Host session. The Chat reply path does not receive these
tools. `dostigus_messages_create` still does not accept parts. The LLM
is not asked to emit them ([ADR 0025](0025-chat-bubble-parts.md)).

The Host registry adds Sheet id `kitchen`. An assistant button
`openSheet` with that id opens a `KitSheet` titled **Kitchen**: pantry
list and add, cooked log and XP, recipe view and edit. The Sheet uses
Kit controls and Host tokens. It is not a custom CSS app.

Preview `GET /preview-seed?kitchen=1` fills empty Kitchen tables once
each (Eggs, Milk, recipe Omelette, one cooked row) and appends one
assistant line through `appendClusterMessage`: a status **Kitchen** and
a button **Open Kitchen**. Another visit does not append that line
again and does not duplicate rows that are already there. HEAD ignores
the query.

There is no Module package runtime in this Host. `bots.modules_json`
stays empty. Nothing is Applied. The SQL, the tool files, and the Sheet
binding live in the Platform until a later record can install a
declarative package from the Store.

## Context

[ADR 0024](0024-threads-and-bot-visibility.md) ordered a Kitchen Module
demo after bubble parts. [ADR 0006](0006-day-1-declarative-modules.md)
says a Module package is SQL, a templated MCP surface, Kit UI bindings,
and Skill diffs — not a sandbox. This repo has Manifest
`modulePackageIds` and no installer, no package table, and no templated
tool loader. Waiting for that runtime would block the Chat → button →
Sheet loop the demo is for.

Kitchen data is Cluster data, shared by the Household, the same way
[ADR 0024](0024-threads-and-bot-visibility.md) places Module package
data in the Store rather than on one bot-thread. Bot visibility is
still not implemented. Owner and Member both use the Kitchen Sheet
because it is Household domain, like Chat, and unlike Settings or Bot
create.

## Consequences

- Store migration `0010_kitchen` runs on Host start with the other
  migrations.
- Host routes: `GET /api/kitchen`, `POST /api/kitchen/pantry`,
  `POST /api/kitchen/cooked`, `PUT /api/kitchen/recipe`. A Member may
  call them. Settings, Bot create/delete, and Members stay with the
  Owner.
- MCP tools: `dostigus_kitchen_pantry_list`,
  `dostigus_kitchen_pantry_add`, `dostigus_kitchen_cooked_mark`,
  `dostigus_kitchen_recipe_get`, `dostigus_kitchen_recipe_save`.
- A cooked mark from the Host stores the signed-in person id. A Bearer
  `/mcp` call may pass `personId` or leave it empty.
- Chat bubbles still render parts only from stored assistant lines.
  The preview seed is the day-1 writer. A production Host does not
  seed Kitchen rows.
- Out of this ADR: a Meal port, a meal plan, shopping, more than one
  recipe, Apply of a Module package, Builder, marketplace, and the
  Thread runtime.

## Alternatives

- Port Meal — rejected. The loop is pantry, one recipe, and XP. The
  product stays on the Host.
- A declarative package file with no installer — rejected as a pretend
  Apply. The seed is the tables, the tools, and the Sheet. The ADR
  says they are not a Module package yet.
- Put Kitchen tools on the Chat LLM loop — rejected for this seed.
  [ADR 0011](0011-chat-mcp-tool-loop.md) still limits that loop, and
  [ADR 0025](0025-chat-bubble-parts.md) does not ask the model for parts.
- A new Nuxt app or custom CSS for Kitchen — rejected. One Host, one
  Sheet shell.
- Per-Bot pantry — rejected. The Household shares one kitchen in the
  Cluster Store.
