# ADR 0002: Host UI kit and Sheets

- Status: accepted
- Date: 2026-09-21

## Decision

One Host. Chat, Cards, and Sheets / modals come from the Kit. Bots do not
ship their own SPA, domain, or iframe app. UI modules bind to Kit components
and talk to the Store only through the Bot’s MCP surface.

## Context

Per-bot sites (e.g. `meal.kosarev.space`) split the product into many frontends
and break portability. A messenger-shaped host plus Sheets keeps one chrome,
one kit, and one place to learn the UI.

## Consequences

- `apps/web` is the only user-facing app in this monorepo.
- `packages/ui-kit` is the Kit barrel for Sheets and Cards.
- Assistant Chat bodies render through `KitMarkdown`
  ([ADR 0022](0022-chat-assistant-markdown.md)). An assistant line may
  also carry Kit parts (a button that opens a Sheet, and a status)
  ([ADR 0025](0025-chat-bubble-parts.md)). User and system lines stay
  plain text.
- New Bot UI is a Kit binding + MCP surface, not a new Nuxt app.
- Host empty states (Chat, Sheet) are first-class; do not replace them with a
  marketing landing page.
- Host UI text is Nunito (headings and body). Dark charcoal canvas, firm
  coral accent, rounded Kit chrome. Tokens: [`docs/ui.md`](../ui.md).
- Kit implementation (Reka UI, Sheet shell, Brand) is
  [ADR 0013](0013-kit-reka-ui-and-brand.md).
- The wide-screen Host (sidebar plus Chat) and optimistic send are
  [ADR 0014](0014-host-messenger-shell.md).
- Desktop sidebar grammar (resize, collapse, user menu, Bot Sheet) is
  [ADR 0015](0015-host-desktop-shell.md).

## Alternatives

- Per-bot Nuxt apps under `apps/*` — rejected; explodes chrome and domains.
- Headless API + arbitrary client — rejected for day-1; the host *is* the UI.
