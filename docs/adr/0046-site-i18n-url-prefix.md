# ADR 0046: Site i18n URL prefix

- Status: accepted
- Date: 2026-10-02

Marketplace on the marketing site stays
[ADR 0045](0045-pack-catalog-on-marketing-site.md).
Host UI i18n stays
[ADR 0037](0037-host-ui-i18n.md): `no_prefix` on Host
routes. This record names **SEO-facing locale URLs** for
the marketing site only. The site lives in GitHub repo
`dostigus/cloud` (https://dostigus.ru), not this Platform
monorepo. This record does not change Host code, Store,
or SPEC “This Host” runtime.

Nick locked the ten decisions below on 2026-10-02. Do not
reopen these locks in the `dostigus/cloud` impl PR.

## Decision

The marketing site serves a distinct URL per Locale so
search engines can index RU and EN as separate pages.

### Strategy

Nuxt `@nuxtjs/i18n` **`prefix_except_default`**. Site
default Locale is **`ru`**. `/` and every unprefixed
public path are RU. EN lives under **`/en/...`**.

### Scope

All public marketing pages: Home, Marketplace, Pack
detail, legal, and the rest of the public path set. The
same path set exists in both Locales.

### First visit

Always RU. Keep `detectBrowserLanguage: false`. No
`Accept-Language` redirect. No geo redirect.

### Language switch

The switcher changes the **path**
(`/marketplace` ↔ `/en/marketplace`) **and** the cookie.
The URL wins over the cookie for which HTML is served.
An unprefixed URL is always RU content. The cookie must
not override SSR / SEO for unprefixed URLs.

### hreflang and canonical

Every public page emits a `ru` / `en` hreflang pair.
**`x-default` → RU** (the unprefixed URL). Canonical
matches the URL that served the HTML.

### Host out-link

The Host Closet Marketplace out-link stays
https://dostigus.ru/marketplace (RU). This record does
not make Host links locale-aware.

### Sitemap

One `sitemap.xml` lists both locale URLs with hreflang
linkage.

### Legacy redirects

Mirror the existing `/packs` → `/marketplace` 301
([ADR 0045](0045-pack-catalog-on-marketing-site.md)):
`/en/packs` and `/en/packs/:slug` **301** to
`/en/marketplace` (and `/en/marketplace/:slug` when that
slug exists).

### Ship order

Impl follows in `dostigus/cloud` after this ADR merges
(a separate PR). This PR is docs only. No Host code. No
Port.

### Copy

Existing site `en.json` / content. This record does not
require a copy rewrite. The follow-up impl is wiring
only.

### Scope of this record

Docs only. Implementation lands in `dostigus/cloud`. Ask
Nick before merge. No Port.

## Context

The marketing site already uses `@nuxtjs/i18n` in
`dostigus/cloud` (`apps/web/nuxt.config.ts`) with
`strategy: 'no_prefix'`, `defaultLocale: 'ru'`, and
`detectBrowserLanguage: false`. The language switch
changes Locale and cookie but not the URL. One URL
serves both languages. That is weak SEO for EN.

[ADR 0045](0045-pack-catalog-on-marketing-site.md) put
Marketplace on that site (https://dostigus.ru/marketplace)
and kept RU and EN “like the existing landing.” It did
not lock a URL prefix. The Host Closet out-link is the
unprefixed RU URL.

[ADR 0037](0037-host-ui-i18n.md) locked Host chrome to
`no_prefix` (default `en`, cookie / `Member.locale`). A
Host `/en` prefix would fork every Host route. The
marketing site is a different surface: public pages,
crawlers, and a RU-first default. Applying Host
`no_prefix` there keeps EN off its own URL.

`prefix_except_default` with default `ru` keeps today’s
unprefixed RU URLs stable (including the Host out-link)
and gives EN a crawlable `/en/...` tree. First visit
stays RU when `detectBrowserLanguage` stays false.

A cookie that overrode an unprefixed URL would serve EN
HTML at the RU URL and break the hreflang / canonical
pair. The URL decides which HTML is served.

## Consequences

- Docs only. No Store migration, Host route, Host UI,
  MCP surface, or Port change in this record. No site
  pages in this Platform monorepo.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) **Locale**
  stays Host chrome ([ADR 0037](0037-host-ui-i18n.md)).
  Marketing-site public URLs are this record. Do not
  treat `/en` on dostigus.ru as Host Locale.
- [ADR 0045](0045-pack-catalog-on-marketing-site.md)
  “RU and EN, like the existing landing” is this
  prefix: unprefixed = RU, `/en/...` = EN. Marketplace
  path and Host out-link
  https://dostigus.ru/marketplace stay. `/packs` 301
  still stands; the EN mirror is `/en/packs` →
  `/en/marketplace`.
- [ADR 0037](0037-host-ui-i18n.md) Host `no_prefix`
  still stands. This record does not add `/en` or `/ru`
  to Host routes and does not locale-aware the Closet
  Marketplace href.
- SPEC “This Host” Closet out-link stays
  https://dostigus.ru/marketplace (RU). SPEC out of
  scope still excludes Host Locale prefixes and
  locale-aware Host out-links. Site wiring is
  `dostigus/cloud`, not this monorepo.
- Copy rewrite of site `en.json` / content is not this
  record.
- New locales beyond `ru` / `en` stay out. Subdomains
  stay out.

## Alternatives

- Keep site `strategy: 'no_prefix'` — rejected. One URL
  for both languages is weak EN SEO.
- `strategy: 'prefix'` (`/ru/...` and `/en/...`) —
  rejected. Default RU stays unprefixed so today’s
  dostigus.ru paths and the Host out-link stay stable.
- Subdomains (`en.dostigus.ru`) — rejected.
- `detectBrowserLanguage: true` or a geo redirect on
  first visit — rejected. First visit is always RU.
- Cookie overrides which HTML an unprefixed URL
  serves — rejected. URL wins for SSR / SEO.
- Locale-aware Host Closet / other Host out-links —
  rejected for this record. Href stays
  https://dostigus.ru/marketplace (RU).
- Separate `sitemap.xml` per Locale — rejected. One
  sitemap lists both URLs with hreflang linkage.
- New locales beyond `ru` / `en` — rejected.
- Change Host UI i18n ([ADR 0037](0037-host-ui-i18n.md))
  — rejected. Host stays `no_prefix`.
- Require a site copy rewrite in this record —
  rejected. Existing `en.json` / content. Wiring only
  in the follow-up impl.
- Implement the Nuxt strategy change in this Platform
  PR — rejected. Impl is `dostigus/cloud`.
- Port or merge without a Nick ask — rejected.
