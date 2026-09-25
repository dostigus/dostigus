# ADR 0038: Dashboard chrome

- Status: accepted
- Date: 2026-09-25

Providers product behavior stays
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md).
Locale strings stay [ADR 0037](0037-host-ui-i18n.md). The Host
messenger sidebar stays
[ADR 0014](0014-host-messenger-shell.md) and
[ADR 0015](0015-host-desktop-shell.md) for Chat, Threads, and
Members. This record owns the Dashboard *shell* only.

Nick first locked a Settings-only chrome on 2026-09-25, then
the same day renamed that chrome **Dashboard**. Settings is
one page inside it. This file is that later lock.

## Decision

`/dashboard` and every `/dashboard/...` page use a **dedicated
Dashboard chrome**. They do **not** mount the Host messenger
layout (`layouts/host.vue`): no Bot / Thread sidebar, no
search loupe, no Chat header, no `HostMenuButton` drawer.

The Dashboard layout (`layouts/dashboard.vue`) is the primary
chrome:

- A **left Dashboard nav**: back row at the top, then grouped
  pages, then the same Host user control pinned at the bottom
  (`HostUserMenu` with `hideSettings`). The menu omits
  Settings (the Owner is already in Dashboard) and keeps
  every other item the Host user menu already has (Members
  and Sign out on day-1). Do not fork that menu.
- A **right content column** that is the only scrollport.
  The section title (**Dashboard** / Locale equivalent) and
  the page forms live **inside** that column. There is no
  fixed page header above a separately scrolling inner pane.

### Back row

The top of the Dashboard nav is a back control: a chevron
plus the label **Bots** (EN) / **Боты** (RU). It navigates
to `/` (the Host Threads / Bot list home). There is **no**
search field in this nav header.

Nick locked the RU label **Боты** on 2026-09-25 for this
control. It is chrome for the destination, not a glossary
rewrite of **Bot** in running copy. EN stays **Bots**.
Dictionaries own both strings
(`dashboard.nav.back` / `dashboard.nav.backAria`).

### Active item

The current Dashboard page uses a subtle selected background
on its nav row (`aria-current="page"`), same family as a
selected Thread row on the Host sidebar.

### Pages (day-1 scaffold)

| Group | Item | Route | Content |
| --- | --- | --- | --- |
| (top) | Overview / Главная | `/dashboard` | Stub: Cluster status / work |
| Cluster / Кластер | Cluster settings / Настройки кластера | `/dashboard/cluster` | Ex-Other: timezone, http allowlist, Locale |
| Integrations / Интеграции | Providers | `/dashboard/providers` | OpenRouter shelf, catalog, health |
| Account / Аккаунт | Settings / Настройки | `/dashboard/settings` | Stub: Owner account. Host user-menu **Settings** opens this page |

Overview and Settings are placeholders. Do not invent Cluster
monitoring or a Marketplace UI in this record.

Leftover Host links stay valid:

- `/settings` → `/dashboard`
- `/settings/providers` → `/dashboard/providers`
- `/settings/other` → `/dashboard/cluster`

Members stays on the Host messenger layout. A Member still
cannot open Dashboard
([ADR 0012](0012-household-members.md)). The Owner page gate
covers `/dashboard`, `/dashboard/...`, and the leftover
`/settings` redirects.

## Context

Settings already had a left nav inside the Host pane
([ADR 0036](0036-llm-providers-tier-resolve-escalate.md)),
then a Settings-only chrome without the Bot list. Nick’s
later 2026-09-25 lock: that chrome is **Dashboard**. Settings
is one page. Providers and Cluster leftover keep their
product behavior; this record is routing and shell IA.

## Consequences

- `definePageMeta({ layout: 'dashboard' })` on the Dashboard
  parent page. Chat, home, Threads, and Members keep
  `layout: 'host'`.
- [ADR 0014](0014-host-messenger-shell.md) no longer lists
  Settings as a `host` layout route.
- Providers two-column container queries measure the
  Dashboard content column, not a Host pane minus the Bot
  list.
- Preview `?settings=1` opens `/dashboard`. `?providers=1`
  opens `/dashboard/providers`.

## Alternatives

- Keep Dashboard inside `layouts/host.vue` and hide the
  sidebar with CSS — rejected. The Host layout still mounts
  search, create, and Bot list state.
- Settings as a Sheet over Chat — already rejected in
  [ADR 0014](0014-host-messenger-shell.md).
- Search in the Dashboard nav header (reference loupe) —
  rejected. Nick: do not implement.
- Keep the chrome named Settings with Providers / Other
  only — superseded the same day by this Dashboard IA.
