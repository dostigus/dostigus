# ADR 0038: Settings chrome

- Status: accepted
- Date: 2026-09-25

Settings information architecture stays
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md)
(**Провайдеры** / **Прочее**). Locale strings stay
[ADR 0037](0037-host-ui-i18n.md). The Host messenger sidebar
stays [ADR 0014](0014-host-messenger-shell.md) and
[ADR 0015](0015-host-desktop-shell.md) for Chat, Threads, and
Members. This record owns the Settings *shell* only.

## Decision

`/settings` and every `/settings/...` page use a **dedicated
Settings chrome**. They do **not** mount the Host messenger
layout (`layouts/host.vue`): no Bot / Thread sidebar, no
search loupe, no Chat header, no `HostMenuButton` drawer.

The Settings layout (`layouts/settings.vue`) is the primary
chrome:

- A **left Settings nav**: back row at the top, then the
  existing Settings pages.
- A **right content column** that is the only scrollport.
  The section title (**Settings** / Locale equivalent) and
  the page forms live **inside** that column. There is no
  fixed page header above a separately scrolling inner pane.

### Back row

The top of the Settings nav is a back control: a chevron
plus the label **Bots** (EN) / **Боты** (RU). It navigates
to `/` (the Host Threads / Bot list home). There is **no**
search field in this nav header.

Nick locked the RU label **Боты** on 2026-09-25 for this
control. It is chrome for the destination, not a glossary
rewrite of **Bot** in running copy. EN stays **Bots**.
Dictionaries own both strings
(`settings.nav.back` / `settings.nav.backAria`).

### Active item

The current Settings page uses a subtle selected background
on its nav row (`aria-current="page"`), same family as a
selected Thread row on the Host sidebar.

### Pages

Day-1 slugs stay `/settings/providers` and `/settings/other`.
`/settings` still lands on Providers. This record does not
add Settings tabs or rewrite those pages.

Members stays on the Host messenger layout. A Member still
cannot open Settings
([ADR 0012](0012-household-members.md)).

## Context

Settings already had a left nav inside the Host pane
([ADR 0036](0036-llm-providers-tier-resolve-escalate.md)),
but `layouts/host.vue` still painted the Bot list and a
fixed Settings header bar. Nick’s 2026-09-25 lock: Settings
is its own chrome (nav + scrolling content), like a Cursor
Settings page, and the global bots rail is gone on those
routes.

## Consequences

- `definePageMeta({ layout: 'settings' })` on the Settings
  parent page. Chat, home, Threads, and Members keep
  `layout: 'host'`.
- [ADR 0014](0014-host-messenger-shell.md) no longer lists
  Settings as a `host` layout route.
- Providers two-column container queries measure the
  Settings content column, not a Host pane minus the Bot
  list.
- Preview `shoot:preview` states for Settings still wait on
  the same ready markers; the frame no longer includes the
  Bot sidebar.

## Alternatives

- Keep Settings inside `layouts/host.vue` and hide the
  sidebar with CSS — rejected. The Host layout still mounts
  search, create, and Bot list state.
- Settings as a Sheet over Chat — already rejected in
  [ADR 0014](0014-host-messenger-shell.md).
- Search in the Settings nav header (reference loupe) —
  rejected. Nick: do not implement.
