# ADR 0045: Marketplace on the marketing site

- Status: accepted
- Date: 2026-10-02
- Amended: 2026-10-02 — Nick rename lock: the public catalog is
  **Marketplace** at `/marketplace` (not a separate Packs brand).
  Packs are the first catalog kind; Module packages and
  integrations later on that same Marketplace. `/packs` and
  `/packs/:slug` 301 to Marketplace. Host out-link is Closet
  Параметры Pack (`PackClosetActions`):
  https://dostigus.ru/marketplace, new tab. Pro stays out of
  the public field ([ADR 0040](0040-collective-host-direction.md))
  and is removed from the public site.
- Amended: 2026-10-02 — Site public URLs are
  `prefix_except_default` (unprefixed = RU, EN `/en/...`)
  ([ADR 0046](0046-site-i18n-url-prefix.md)). Host Closet
  out-link stays https://dostigus.ru/marketplace (RU).
- Amended: 2026-10-02 — Static-only
  `content/packs` plus copy-URL CTA are
  superseded by
  [ADR 0047](0047-marketplace-catalog-store.md)
  (Catalog Store on `dostigus/cloud` /
  dostigus.ru, hybrid mirror, public
  read API, deep-link Apply). Host
  [#189](https://github.com/dostigus/dostigus/pull/189)
  Catalog Store on Platform Host is
  misplaced / removed. Host-pulled
  catalog and Apply-from-index still
  stand rejected. Marketplace name,
  `/marketplace`, Host out-link, `/packs`
  301, Pro out of the public field, and
  Packs as the first kind stay.
- Amended: 2026-10-02 — Mailer Pack
  `dostigus.mailer` is
  [ADR 0048](0048-mailer-product.md).
  Marketplace listing waits for Host
  tools, then Nick publish
  ([ADR 0047](0047-marketplace-catalog-store.md)).
  Do not seed it beside
  `dostigus.mail` in that docs PR.

Pack Apply stays
[ADR 0039](0039-pack-vs-bot-portable-recipe.md): file, public
`.zip` URL, or https git, preview / plan, then confirm.
Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). Module package
Apply stays later
([ADR 0030](0030-chat-cards-module-catalog.md)). Kitchen stays
a Host seed, not a Pack in this Host
([ADR 0026](0026-kitchen-module-day-1.md),
[ADR 0039](0039-pack-vs-bot-portable-recipe.md)). This record
names the public **Marketplace**. The Host out-link is in
this Host (Closet). It does not add a Store migration, a
Host-pulled catalog, or marketing-site pages.

Nick locked the first shape on 2026-10-02, then the rename
below the same day.

## Decision

The public catalog is named **Marketplace**. It lives on the
**marketing site** (https://dostigus.ru/marketplace). It is
not an in-product Host marketplace and not a live catalog the
Host pulls.

Packs are the **first catalog kind**. Module packages and
integrations are later kinds on that same Marketplace, not a
separate Packs brand.

This record **is** the later public-catalog track that
[ADR 0039](0039-pack-vs-bot-portable-recipe.md) and
[ADR 0040](0040-collective-host-direction.md) left open.
The shape is marketing-site-first, Host link-only.

### Not in-product Apply

The Host does **not** pull a live catalog. Host v1 has no
catalog index, no Apply-from-index, and no in-product
Marketplace. Closet Import stays the Apply path already in
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).
Deep-link Apply from the site (`applyPack=`) is
[ADR 0047](0047-marketplace-catalog-store.md), not
Apply-from-index.

### Marketing site

The catalog is on dostigus.ru. Home links to Marketplace.
Each Pack has its own page plus SEO (title, description,
text). Pages live in GitHub repo `dostigus/cloud`, not in
this Platform monorepo. `/marketplace` is Marketplace.
Listing source of truth is the Catalog Store on
`dostigus/cloud` / dostigus.ru
([ADR 0047](0047-marketplace-catalog-store.md)). The
site owns that Store, mirrors, Nick publish, and
the public read API. Static `content/packs` and
`packs/` trees are not the forever publish path.
Platform Host does not run Catalog Store for the
public marketplace. That API is not a Host-pulled
catalog and not a Module catalog.

### Host out-link

This Host product has a simple section or link that
**references** Marketplace only (an out-link:
https://dostigus.ru/marketplace). No direct catalog
integration. No Apply-from-index. Placement is Closet
Параметры Pack (`PackClosetActions`): a `KitListRow` in
a new tab.

### Site visual

Align with the product visual language: tokens, fonts,
goose stickers, Bot flock marks, and animation feel where
reasonable ([`docs/ui.md`](../ui.md), Brand in the Kit).
The site is **not** required to reuse Kit Vue components
1:1. Tokens, marks, and goose yes.

### Paths and Locale

Site path is `/marketplace`. Packs sit inside that
Marketplace. RU and EN, like the existing landing.
`/packs` and `/packs/:slug` **301** to Marketplace
(`/marketplace`, and the matching Pack page when that slug
exists). Site public URLs are
[ADR 0046](0046-site-i18n-url-prefix.md):
`prefix_except_default`, unprefixed = RU, EN under
`/en/...`. The Host out-link stays the unprefixed RU URL.
`/en/packs` 301s like `/packs`.

### Pro out of the public field

The marketing site does not advertise a Pro tier. Remove
Pro from the public site. Pro stays out of the public field
([ADR 0040](0040-collective-host-direction.md)): Host,
README, and Platform docs still do not advertise Pro.

### Content and CTA

The first lock made the catalog **static** in the
marketing-site repo (frontmatter plus markdown) and
made the page CTA copy the public Pack Apply URL.
[ADR 0047](0047-marketplace-catalog-store.md)
supersedes that: listings live in the Catalog Store
on `dostigus/cloud` / dostigus.ru; Member Apply
uses our cloud mirror zip URL; the CTA deep-links
into the Host (`applyPack=` → `PackApplySheet`
preview). Copy-URL is the fallback when the Host
is unreachable or the origin is not that Host.

### First content

Ship 2–3 **real** Packs plus the Marketplace chrome. Use the
verticals people already see in this Host (Kitchen, and
the README fixture Bots Mail and Reader when those recipes
exist). Publishing those Pack files (zip or git) and the
markdown pages was the first site catalog PR. Migrate
those three onto the Catalog Store is
[ADR 0047](0047-marketplace-catalog-store.md). This record
does not invent stub paid listings and does not turn the
Kitchen Module seed into a Pack in this Host.

### Ship order

After this ADR merges:

1. Marketing-site Marketplace UI (`/marketplace`, Pack
   pages, `/packs` 301, static content, SEO, CTA, Pro
   removed from the public site).
2. A small Host out-link PR in this Platform repo
   (https://dostigus.ru/marketplace). This Host PR is that
   Closet row.

This PR is ADR plus CONTEXT / SPEC glossary only. No site
pages. No Host UI. No Port.

### Scope of this record

Docs only. Implementation, Port, and any Host chrome land
in later PRs after a merge ask.

## Context

[ADR 0039](0039-pack-vs-bot-portable-recipe.md) made Pack
the share format and already accepted Apply from a file, a
public `.zip` URL, or https git. It left “a later
Marketplace catalog (cloud / site)” unnamed.
[ADR 0040](0040-collective-host-direction.md) said a Pack
marketplace was likely later, and kept Pro out of the
public field.
[ADR 0030](0030-chat-cards-module-catalog.md) kept Module
package Apply later and separate.

An in-product Host catalog that Applies from a live index
would pull a remote feed into the Cluster and blur Pack
Apply with a later Module kind. The Host already has Closet
Import. The missing piece is a public place to find a Pack
and copy its Apply URL.

A marketing-site catalog keeps SEO, RU/EN landing Locale,
and Brand on the public site. That site is GitHub repo
`dostigus/cloud` (dostigus.ru), not this Platform
monorepo — do not hunt Host routes or `content/` here for
the catalog. The Host stays self-host first
([ADR 0005](0005-self-host-first.md)): one out-link, no
live pull.

The first lock on 2026-10-02 named that catalog **Pack
catalog** at `/packs` and treated existing `/marketplace`
as a Module-pack stub. The same-day rename lock makes
**Marketplace** the public name at `/marketplace`, with
Packs as the first kind and `/packs` as a 301. A separate
Packs brand would split the public catalog. Advertising
Pro on the public site would break
[ADR 0040](0040-collective-host-direction.md).

Static frontmatter plus markdown matches a small first
set (2–3 Packs) and does not need a Host API or a Module
package registry.

## Consequences

- The Host out-link is Closet Параметры Pack. No Store
  migration, Host-pulled catalog, MCP surface change,
  marketing-site page, or Port in this record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) uses
  **Marketplace** (not Pack catalog as a public brand).
  Pack Apply stays [ADR 0039](0039-pack-vs-bot-portable-recipe.md).
  Module packages are a later Marketplace kind, not a
  separate brand
  ([ADR 0030](0030-chat-cards-module-catalog.md)).
- [ADR 0039](0039-pack-vs-bot-portable-recipe.md) “later
  Marketplace catalog” is this record: marketing site
  `/marketplace`, Host out-link
  https://dostigus.ru/marketplace. File / URL / git Apply
  still stands.
- [ADR 0040](0040-collective-host-direction.md) Pack
  marketplace line is this record for the public catalog.
  In-product Marketplace Apply stays out of v1. Pro stays
  out of the public field; the public site does not
  advertise Pro.
- [ADR 0030](0030-chat-cards-module-catalog.md) Module
  package Apply stays later. That later kind lands on
  Marketplace, not on a second public brand.
- SPEC “In scope” names Marketplace and the Host out-link.
  SPEC “This Host” names the Closet Параметры Pack row.
  SPEC out of scope still excludes in-product Marketplace
  Apply and a Host-pulled catalog. Site public URLs
  (unprefixed = RU, EN `/en/...`) are
  [ADR 0046](0046-site-i18n-url-prefix.md). The Host
  out-link stays https://dostigus.ru/marketplace (RU).
- Kitchen Module seed stays a seed
  ([ADR 0026](0026-kitchen-module-day-1.md)). A Kitchen
  Pack page on the site is a recipe people Apply; it is
  not an installed Module package.
- Paid Module packs, Pro checkout, signing /
  notarization, and auto-update stay later or
  rejected as below. Host deep-link Apply is
  [ADR 0047](0047-marketplace-catalog-store.md).
  Static-only catalog and copy-URL-only CTA
  are superseded there. Host-pulled catalog
  still stands rejected.

## Alternatives

- In-product Marketplace with Apply-from-index —
  rejected. Host v1 is an out-link only.
- Host pulls a live catalog feed — rejected.
- A separate Packs brand beside Marketplace — rejected.
  Packs are the first kind inside Marketplace.
- A separate Module Marketplace product name — rejected
  for the public site. Module packages are a later kind
  on the same Marketplace.
- Host paths `/packs` or `/marketplace` as the catalog —
  rejected. Those paths are the marketing site.
- Keep the public catalog at `/packs` as the live path —
  rejected on the 2026-10-02 rename. `/packs` 301s to
  `/marketplace`.
- Keep `/marketplace` as a Module-pack stub only —
  superseded by the rename. `/marketplace` is Marketplace.
- Advertise Pro on the public site — rejected.
  [ADR 0040](0040-collective-host-direction.md) stands.
- Dynamic CMS or a Host API as the content source —
  superseded as the sole forever path.
  [ADR 0047](0047-marketplace-catalog-store.md)
  puts listings in the Catalog Store on
  `dostigus/cloud` / dostigus.ru. CMS as the
  sole source without that Store still
  rejected. A Host-pulled catalog API still
  rejected. Catalog Store on Platform Host
  is rejected (Host #189 misplaced).
- CTA that Applies inside the Host from the site —
  superseded for deep-link Apply.
  [ADR 0047](0047-marketplace-catalog-store.md)
  opens the Host with `applyPack=` (preview,
  then confirm). Apply-from-index and Apply
  without preview still rejected. Copy-URL
  stays the fallback.
- Reuse Kit Vue components 1:1 on the site — rejected as
  a requirement. Tokens, fonts, goose stickers, and Bot
  flock marks yes.
- Invent stub paid listings as first content — rejected.
  2–3 real Packs from existing product / seed verticals.
- Turn the Kitchen Module seed into a Pack in this Host
  — rejected. [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
  still stands.
- Site UI or Host out-link in this PR — rejected. Docs
  only.
- Port or merge without a Nick ask — rejected.
