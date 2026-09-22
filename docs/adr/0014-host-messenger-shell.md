# ADR 0014: Host messenger shell

- Status: accepted
- Date: 2026-09-22

## Decision

On a wide screen the Host is a messenger-shaped shell
([ADR 0002](0002-host-ui-kit-and-sheets.md)):

- A narrow sidebar lists Bots and offers create (Owner only).
- Members and Settings are quiet links at the bottom of that sidebar.
  **Settings** stays the `/settings` page. **Members** stays `/members`.
  Neither is a Sheet over Chat.
- The rest of the screen is Chat when a Bot is selected: the Bot name, the
  timeline, and the composer. The composer stays on screen.
- Below `52rem`, the sidebar collapses to a drawer opened from a Bots
  control. Chat, Settings, and Members stay usable.
- Sign-in and onboarding stay outside this shell.

Sending a Chat line is optimistic. The user line shows at once, the Bot
shows a pending reply (“Replying…”), and the stored assistant line replaces
that pending state when the request finishes. The rest of the Host stays
usable. There is no page-level spinner. Token streaming is a later change.

An empty Bot list shows the wave sticker and **Create a Bot**. Creating a
Bot opens that Bot’s Chat, composer included. No coach marks.

Kit pieces stay as in [ADR 0013](0013-kit-reka-ui-and-brand.md): `KitButton`,
`KitDialog` for Create Bot, `KitSheet` for Add Member, Brand stickers from
the Kit. This shell does not add another overlay library.

Household rules are unchanged ([ADR 0012](0012-household-members.md)). A
Member sees the Bot list and Chat, without create, delete, Members, or
Settings.

## Context

Chat was its own page: bubbles on an empty canvas, with the Bot list only
on `/`. Newcomers lost the list as soon as they opened a Bot, and Settings
and Members lived in the Chat header. A send waited on the composer, then
the user line and the Bot line appeared together.

Nick’s grill settled the shell: sidebar plus Chat, Settings as a page,
optimistic send without streaming, and a single empty-state call to action.

## Consequences

- `layouts/host.vue` wraps `/`, `/bots/:id`, `/settings`, and `/members`.
- The LLM gateway, the in-process tool loop, and message routes are
  unchanged. Optimism is Host UI only.
- A failed send leaves the user line in place with a retry. It does not
  cover Chat with an error page.
- Out of this change: token streaming, share/invite, and a restyle of
  every control.

## Alternatives

- Keep Chat as a separate page with a back link — rejected. The list has
  to stay visible while a Bot is open.
- Open Settings as a Sheet over Chat — rejected. Settings is a page of its
  own.
- Stream tokens in this change — rejected. The pending reply is enough
  until a later change.
- Coach marks after create — rejected. Landing in Chat is the next step.
