# ADR 0019: Bot picker and Chat purpose

- Status: accepted
- Date: 2026-09-22

Amended the same day: the picker is the whole Chat pane. A **×** on the
header returns to the pane that was open before it. The sidebar empty
line is centered. The main pane, with no Bots, keeps the wave sticker
and **Create a Bot**.

## Decision

Creating or opening a Bot starts from a picker that **is** the Chat pane.
The sidebar stays visible. The Create Bot modal (`KitDialog`, name field,
sticker) is removed. A centered card over the pane is not this picker.

### Opening the picker

The sidebar `+` and the main-pane **Create a Bot** replace the Chat pane
with the picker. The Host remembers that route. **×** on the right of the
**To:** row, and Escape, return there: the open Chat, or the empty main
pane. It is not a route, not a right Sheet, and not a dialog. Choosing a
Bot in the picker, creating a Bot, or choosing a Bot row in the sidebar
also leaves the picker, without jumping backward. There is no group-chat
row and no keyboard shortcut in this change.

With no Bots, the sidebar list region centers a short muted line. No
sticker and no Create button there. The main pane shows the wave sticker,
short copy, and **Create a Bot** for the Owner.

### Rows

- A search field filters existing Bots by name. It does not create a Bot
  from the query.
- **Create new Bot** is an Owner row, with a plain **+** in the text
  color. A Member does not see it.
- Each existing Bot is a row: flock mark, name, and the latest Chat line
  when there is one.

Choosing an existing Bot closes the picker and opens that Bot's Chat.

### Create new Bot

The Owner row persists a Bot and opens its Chat immediately:

- Name is `New Bot` (`DEFAULT_BOT_NAME`). Another Bot may already use that
  name.
- Appearance is a random flock `avatarShape` and a random accent from the
  sixteen Bot accents. Omitted shape or color on the API still default to
  `goose` and `#1F7AE5` for other callers.
- The Store still writes the assistant greeting as the first Chat line.

Rename and appearance stay on the Bot settings Sheet. The Chat header
avatar and name open that Sheet, as in
[ADR 0015](0015-host-desktop-shell.md). Create does not ask for a name
first.

### Member

A Member may open the picker from the sidebar `+` to find a Bot. Search
and existing Bots only. Create, delete, Members, and Settings stay with
the Owner ([ADR 0012](0012-household-members.md)). This replaces the
earlier "a Member has no `+`" rule for that control: the control finds a
Bot; it does not create one.

### Chat purpose

The greeting stays the first assistant message (`botGreetingContent`): a
short hello that names the Bot. Until the first user message, Chat shows
a purpose Card:

- Prompt: what this Bot should be for.
- Chips: Personal, Work, Learning, Other.
- A free-text field on the Card, and the composer, both send a normal
  user message.

The Bot replies on the usual Chat path. With no LLM gateway key, that
reply is the existing quiet stub. Purpose is Chat history only. It is
not a Manifest field and this change adds no Store migration.

## Context

[ADR 0014](0014-host-messenger-shell.md) opened Create Bot in a modal and
landed in Chat. The grill on 2026-09-22 asked for the messenger list
grammar: find or create in the Chat pane, a random flock mark, and a
purpose Card in Chat instead of a name field up front. A first pass drew
that list as a centered card. The visual pass asked for the pane itself.

## Consequences

- `BotCreateDialog` and the empty-state sticker are gone. The Host picker
  is `BotPicker`, and it replaces the Chat pane. Add Member stays a
  `KitSheet`.
- Host create sends `DEFAULT_BOT_NAME` plus a random shape and accent.
  The create route remains Owner-only.
- Shared copy: greeting, purpose prompt, and the four chips.
- Out of this change: `Manifest.purpose`, group chat, and command
  shortcuts.

## Alternatives

- Keep the name modal — rejected. The name starts as New Bot; Chat asks
  what it is for, and the header opens rename.
- A floating card, a right Sheet, or a **Close** control — rejected. The
  picker is the Chat pane. A separate URL is unnecessary for that.
- Create a Bot named from the search query — rejected. Search filters.
- Store purpose on the Manifest — rejected for this change. The answer
  is a Chat line.
