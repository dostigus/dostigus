# ADR 0025: Chat bubble parts

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24 — Schedule Chat Cards extend this parts family ([ADR 0030](0030-chat-cards-module-catalog.md)). Tables and forms still wait. A Card after Apply is not in this record. Skill and self-settings success is a system Chat line, not a Card.

Assistant Markdown stays [ADR 0022](0022-chat-assistant-markdown.md).
Bubbles stay unlabeled
([ADR 0015](0015-host-desktop-shell.md)). Sheets stay Kit drawers
([ADR 0002](0002-host-ui-kit-and-sheets.md)). Threads and Bot visibility
stay [ADR 0024](0024-threads-and-bot-visibility.md) (amended 2026-09-24:
a personal Bot plus explicit grants). This ADR does not build them.

## Decision

An assistant Chat line keeps `content` as the Markdown string and may
also carry Kit parts. User and system lines stay a plain string and
have no parts.

The Store column is `messages.parts_json` (`[]` when empty). On read,
unknown kinds and invalid rows are dropped. A user or system row that
somehow holds JSON still returns no parts.

Day-1 part kinds:

| Kind | Fields | Renders |
|------|--------|---------|
| `button` | `label`, `action` | `KitButton` |
| `status` | `label`, `tone` `neutral` \| `ok` \| `warn` | a status chip in the Kit |

A button action is `openSheet` with a Sheet id. The Host keeps a small
registry of Sheets that id may open. A button whose id is not in the
registry is not rendered. Day-1 registers `demo`: title **Demo sheet**,
a short body, presented with `KitSheet`. That drawer is the place the
Kitchen Module hangs. [ADR 0026](0026-kitchen-module-day-1.md) registers
`kitchen` beside `demo`. This milestone does not add a second app
or a raw control in the bubble.

The list is capped. Labels are short plain text. The bubble template
uses Kit components only. Markdown does not become a button.

How parts arrive:

1. Preview seed `GET /preview-seed?parts=1` inserts one assistant line
   once (a status and an **Open demo** button). HEAD ignores the query.
   Another visit does not append again.
2. `insertMessage` and `appendClusterMessage` accept `parts` for an
   assistant line. That is the extension point for a later MCP tool or
   Kitchen writer.

`dostigus_messages_create` and the Chat reply path do not accept parts.
The LLM is not asked to emit them. The prompt is unchanged
([ADR 0011](0011-chat-mcp-tool-loop.md)).

## Context

[ADR 0024](0024-threads-and-bot-visibility.md) ordered the next Host
work as bubble parts, then a Kitchen Module demo, then Bot visibility
and per-person bot-threads, then `dm` / `group` / `room`. Amended
2026-09-24, Bot visibility is a personal Bot plus explicit grants.
Household-wide `shared` | `private` is not the target. The running
Host may still store that column until the grants milestone. Nick’s note
on 2026-09-23 locked day-1 as a button in an assistant bubble that opens
a Sheet. A Card catalog (tables, forms) waits. Threads runtime waits.

The glossary **Card** names inline structured UI in the Chat (button,
table, status). This ADR ships the button and the status as Kit parts
on the assistant message. It does not introduce a Card catalog.

## Consequences

- Assistant bubbles render `KitMarkdown`, then `KitChatParts` when the
  line has parts the Host can show.
- Clicking the button opens the registered Sheet in `KitSheet`.
- Sidebar preview and Host search still use `content` only.
- The Kitchen Module registers Sheet id `kitchen` and writes parts
  through `appendClusterMessage`
  ([ADR 0026](0026-kitchen-module-day-1.md)). It does not get a new
  CSS app.
- Out of this ADR: Kitchen domain data, Bot visibility
  ([ADR 0024](0024-threads-and-bot-visibility.md): personal Bot plus
  explicit grants), per-person threads, `dm` / `group` / `room`,
  forms inside a bubble, and a status-driven tool loop beyond the chip.

## Alternatives

- Encode the button as Markdown or raw HTML — rejected. ADR 0022 keeps
  HTML escaped. Interactive bits are Kit parts.
- Ask the LLM to emit parts in this milestone — rejected. The Store
  column and `appendClusterMessage` are the extension point.
- Open an arbitrary URL from the button — rejected. The action is
  `openSheet`, and only a registered Sheet id renders.
- A full Card catalog (table, form) in the same change — rejected.
  Day-1 is the button and the status chip.
- A second page for the demo Sheet — rejected. One Host, one Sheet
  shell.
