# ADR 0002: Host UI kit and Sheets

- Status: accepted
- Date: 2026-09-21

## Decision

One Host shell. Chat, inline cards, and Sheets / modals come from a
shared design kit. Bots do not ship their own SPA, domain, or iframe app.
UI modules bind to kit components and talk to storage only through the Bot’s
MCP contract.

## Context

Per-bot sites (e.g. `meal.kosarev.space`) split the product into many frontends
and break portability. A messenger-shaped host plus Sheets keeps one chrome,
one kit, and one place to learn the UI.

## Consequences

- `apps/web` is the only user-facing app in this monorepo.
- `packages/ui-kit` is the component barrel for Sheets and cards.
- New Bot UI is a kit binding + MCP contract, not a new Nuxt app.
- Host empty states (chat, Sheet) are first-class; do not replace them with a
  marketing landing page.

## Alternatives

- Per-bot Nuxt apps under `apps/*` — rejected; explodes chrome and domains.
- Headless API + arbitrary client — rejected for day-1; the host *is* the UI.
