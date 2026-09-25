# ADR 0014: Host messenger shell

- Status: accepted
- Date: 2026-09-22

Amended 2026-09-25: Dashboard leaves this shell.
`/dashboard` and `/dashboard/...` use `layouts/dashboard.vue`
([ADR 0038](0038-dashboard-chrome.md)). Leftover `/settings`
routes redirect there. Members and Chat stay here.

Desktop list chrome, Chat labels, and the composer are refined in
[ADR 0015](0015-host-desktop-shell.md). The Create Bot modal and the wave
empty state are replaced by the full-pane picker in
[ADR 0019](0019-bot-picker-and-chat-purpose.md). Optimistic send and the
drawer below `52rem` still stand. The in-thread busy mark for a configured
reply is the activity row in [ADR 0021](0021-chat-activity-status.md).
Assistant bubble Markdown is [ADR 0022](0022-chat-assistant-markdown.md).
Kit parts under that body are [ADR 0025](0025-chat-bubble-parts.md).

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

Sending a Chat line is optimistic. The user line shows at once. While the
reply is in flight, a configured Chat shows the activity row from
[ADR 0021](0021-chat-activity-status.md); with no key it still shows the
flock mark. The stored assistant line replaces that row when the request
finishes. The rest of the Host stays usable. There is no page-level
spinner. Token streaming is a later change.

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

- `layouts/host.vue` wraps `/`, `/bots/:id`, `/threads/:id`, and
  `/members`. Dashboard is [ADR 0038](0038-dashboard-chrome.md).
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
