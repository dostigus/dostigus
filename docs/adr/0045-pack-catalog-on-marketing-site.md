# ADR 0045: Pack catalog on the marketing site

- Status: accepted
- Date: 2026-10-02

Pack Apply stays
[ADR 0039](0039-pack-vs-bot-portable-recipe.md): file, public
`.zip` URL, or https git, preview / plan, then confirm.
Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). Module package
Marketplace / Apply stays later
([ADR 0030](0030-chat-cards-module-catalog.md)). Kitchen stays
a Host seed, not a Pack in this Host
([ADR 0026](0026-kitchen-module-day-1.md),
[ADR 0039](0039-pack-vs-bot-portable-recipe.md)). This record
names the public **Pack catalog**. It does not change
[SPEC](../SPEC.md) "This Host" runtime, the Store, or Host
code. It does not add marketing-site pages.

Nick locked the nine decisions below on 2026-10-02.

## Decision

The public Pack catalog lives on the **marketing site**
(dostigus.ru). It is not an in-product Pack marketplace and
not a live catalog the Host pulls.

This record **is** the later public-catalog track that
[ADR 0039](0039-pack-vs-bot-portable-recipe.md) and
[ADR 0040](0040-collective-host-direction.md) left open.
The shape is marketing-site-first, Host link-only.

### Not in-product Apply

The Host does **not** pull a live catalog. Host v1 has no
catalog index, no Apply-from-index, and no in-product Pack
marketplace. Closet Import stays the Apply path already in
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).

### Marketing site

The catalog is on dostigus.ru. Home links to the catalog.
Each Pack has its own page plus SEO (title, description,
text). Pages live in the marketing-site repo tree, not in
this Platform monorepo.

### Host out-link

This Host product grows a simple section or link that
**references** the marketing-site catalog only (an
out-link). No direct catalog integration. No
Apply-from-index. Placement (Closet, Dashboard, or another
chrome slot) is the later Host PR.

### Site visual

Align with the product visual language: tokens, fonts,
goose stickers, Bot flock marks, and animation feel where
reasonable ([`docs/ui.md`](../ui.md), Brand in the Kit).
The site is **not** required to reuse Kit Vue components
1:1. Tokens, marks, and goose yes.

### Paths and Locale

Site paths are `/packs` (index) and `/packs/:slug`
(detail). RU and EN, like the existing landing. A
`/marketplace` Module-pack listing is not this catalog.

### Content and CTA

The catalog is **static** in the marketing-site repo:
frontmatter plus markdown. The page CTA copies the public
Pack Apply URL (a `.zip` or an https git remote) and shows
short “how to Apply in Host” instructions. A deep-link
into the Host is later, not this record.

### First content

Ship 2–3 **real** Packs plus the catalog chrome. Use the
verticals people already see in this Host (Kitchen, and
the README fixture Bots Mail and Reader when those recipes
exist). Publishing those Pack files (zip or git) and the
markdown pages is the site catalog PR. This record does
not invent stub paid listings and does not turn the
Kitchen Module seed into a Pack in this Host.

### Ship order

After this ADR merges:

1. Marketing-site catalog UI (`/packs`, detail pages,
   static content, SEO, CTA).
2. A small Host out-link PR in this Platform repo.

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
marketplace was likely later.
[ADR 0030](0030-chat-cards-module-catalog.md) kept Module
package Marketplace later and separate.

An in-product Host catalog that Applies from a live index
would pull a remote feed into the Cluster and blur Pack
Apply with Module Marketplace. The Host already has Closet
Import. The missing piece is a public place to find a Pack
and copy its Apply URL.

A marketing-site catalog keeps SEO, RU/EN landing Locale,
and Brand on the public site. The Host stays self-host
first ([ADR 0005](0005-self-host-first.md)): one out-link,
no live pull.

Static frontmatter plus markdown matches a small first
set (2–3 Packs) and does not need a Host API or a Module
package registry.

## Consequences

- Docs only. No Store migration, route, Host UI, MCP
  surface, marketing-site page, or Port change in this
  record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) adds **Pack
  catalog**. Pack Apply stays [ADR 0039](0039-pack-vs-bot-portable-recipe.md).
  Module catalog / Module Marketplace stay later
  ([ADR 0030](0030-chat-cards-module-catalog.md)).
- [ADR 0039](0039-pack-vs-bot-portable-recipe.md) “later
  Marketplace catalog” is this record: marketing site,
  Host out-link. File / URL / git Apply still stands.
- [ADR 0040](0040-collective-host-direction.md) Pack
  marketplace line is this record for the public catalog.
  In-product marketplace Apply stays out of v1.
- [ADR 0030](0030-chat-cards-module-catalog.md) Module
  package Marketplace / Apply stays later. Pack catalog
  is not that product.
- SPEC “In scope” names the marketing-site catalog and
  the Host out-link as accepted direction. SPEC “This
  Host” stays unchanged until the Host out-link PR. SPEC
  out of scope still excludes in-product marketplace
  Apply, a Host-pulled catalog, and Module Marketplace.
- Kitchen Module seed stays a seed
  ([ADR 0026](0026-kitchen-module-day-1.md)). A Kitchen
  Pack page on the site is a recipe people Apply; it is
  not an installed Module package.
- Paid Module packs, Pro checkout, Host deep-link Apply,
  signing / notarization, and auto-update stay later or
  rejected as below.

## Alternatives

- In-product Pack marketplace with Apply-from-index —
  rejected. Host v1 is an out-link only.
- Host pulls a live catalog feed — rejected.
- Catalog as Module Marketplace / Module packages —
  rejected. Pack ≠ Module package
  ([ADR 0039](0039-pack-vs-bot-portable-recipe.md)).
- Host paths `/packs` as the catalog — rejected. Those
  paths are the marketing site.
- Keep the public catalog at `/marketplace` — rejected.
  Paths are `/packs` and `/packs/:slug`.
- Dynamic CMS or a Host API as the content source —
  rejected. Static frontmatter plus markdown in the
  marketing-site repo.
- CTA that Applies inside the Host from the site —
  rejected for v1. Copy the public Apply URL plus short
  Host instructions. Deep-link later.
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
