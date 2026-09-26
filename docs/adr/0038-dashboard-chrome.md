# ADR 0038: Dashboard chrome

- Status: accepted
- Date: 2026-09-25

Amended 2026-09-26: Members is a Dashboard page under Account.
Old `/members` bookmarks 404. No HTTP/Nuxt redirect.

Providers product behavior stays
[ADR 0036](0036-llm-providers-tier-resolve-escalate.md).
Locale strings stay [ADR 0037](0037-host-ui-i18n.md). The Host
messenger sidebar stays
[ADR 0014](0014-host-messenger-shell.md) and
[ADR 0015](0015-host-desktop-shell.md) for Chat and Threads.
Household Members stay [ADR 0012](0012-household-members.md)
and Invites stay [ADR 0023](0023-household-member-invites.md).
This record owns the Dashboard *shell* only.

Nick first locked a Settings-only chrome on 2026-09-25, then
the same day renamed that chrome **Dashboard**. Settings is
one page inside it. On 2026-09-26 Nick locked Members into
that same chrome. This file is those locks.

## Decision

`/dashboard` and every `/dashboard/...` page use a **dedicated
Dashboard chrome**. They do **not** mount the Host messenger
layout (`layouts/host.vue`): no Bot / Thread sidebar, no
search loupe, no Chat header, no `HostMenuButton` drawer.

The Dashboard layout (`layouts/dashboard.vue`) is the primary
chrome:

- A **left Dashboard nav**: back row at the top, then grouped
  pages, then the same Host user control pinned at the bottom
  (`HostUserMenu` with `hideSettings` and `hideMembers`). The
  menu omits Settings and Members (both live in the nav) and
  keeps Sign out. Do not fork that menu. The Host messenger
  sidebar still shows Members (Owner only) at
  `/dashboard/members`.
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
| Account / Аккаунт | Members | `/dashboard/members` | Invite by email, pending Invites, Member list, add, disable |
| Account / Аккаунт | Settings / Настройки | `/dashboard/settings` | Stub: Owner account. Host user-menu **Settings** opens this page |

Overview and Settings are placeholders. Do not invent Cluster
monitoring or a Marketplace UI in this record.

Do **not** keep `/settings` or `/members` pages or HTTP/Nuxt
redirects. In-app links use `/dashboard/...`. Old `/settings`
and `/members` bookmarks 404.

A Member still cannot open Dashboard
([ADR 0012](0012-household-members.md)). The Owner page gate
covers `/dashboard` and `/dashboard/...`.

## Context

Settings already had a left nav inside the Host pane
([ADR 0036](0036-llm-providers-tier-resolve-escalate.md)),
then a Settings-only chrome without the Bot list. Nick’s
later 2026-09-25 lock: that chrome is **Dashboard**. Settings
is one page. Providers and Cluster leftover keep their
product behavior; this record is routing and shell IA.

Nick’s 2026-09-26 lock: Members leaves the Host messenger
layout and sits under Account, first, then Settings. Product
content of Members does not change.

## Consequences

- `definePageMeta({ layout: 'dashboard' })` on the Dashboard
  parent page. Chat, home, and Threads keep `layout: 'host'`.
  Members is `/dashboard/members` and uses the Dashboard
  layout.
- [ADR 0014](0014-host-messenger-shell.md) no longer lists
  Settings or Members as a `host` layout route.
- Providers two-column container queries measure the
  Dashboard content column, not a Host pane minus the Bot
  list.
- Preview `?settings=1` opens `/dashboard`. `?providers=1`
  opens `/dashboard/providers`. `?members=1` opens
  `/dashboard/members`.

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
- HTTP/Nuxt redirects from `/settings` or `/members` to
  `/dashboard` — rejected. Remove those pages. Old bookmarks
  404.
- Keep Members on the Host messenger layout — superseded
  2026-09-26. Members is a Dashboard page under Account.
