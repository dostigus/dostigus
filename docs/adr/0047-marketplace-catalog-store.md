# ADR 0047: Marketplace Catalog Store

- Status: accepted
- Date: 2026-10-02

Marketplace on the marketing site stays
[ADR 0045](0045-pack-catalog-on-marketing-site.md).
Site locale URLs stay
[ADR 0046](0046-site-i18n-url-prefix.md).
Pack format and Closet Import stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).
This record names the **Catalog Store** on Platform
and the hybrid mirror. It does not add Host UI,
a Port, or marketing-site pages.

Nick locked the twelve decisions below on 2026-10-02.
Do not reopen these locks in the impl PRs.

## Decision

The public Marketplace listing source of truth is a
**Catalog Store** on Platform (this monorepo). It is
not the Cluster Store. It is not static-only
`content/packs` plus `packs/` trees in
`dostigus/cloud` forever.

The marketing site (`dostigus/cloud`) reads a
**public read API**. It does not own publish.

### Catalog Store

Published Pack listings live here: title, short and
long copy (i18n), screenshots and assets we host,
version, author string, publish status, and a
mirror zip pointer. Packs stay the first Marketplace
kind ([ADR 0045](0045-pack-catalog-on-marketing-site.md)).

### Mirror (hybrid)

After Nick approves a listing to published, Platform
hosts an immutable `{id}-{version}.zip`. Author origin
(https git or a zip URL) is for develop and submit
only. Member Apply uses **our mirror URL** (stable).
Host fetch SSRF and size limits stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).
This zip is not a Cluster Artifact
([ADR 0034](0034-artifacts.md)).

### Not Host-pulled. Deep-link Apply is in.

The Host still does **not** pull a live catalog feed
and does not Apply-from-index. Closet Import stays
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).

Deep-link Apply **is** this record. The Marketplace
CTA opens the Host with `applyPack=` set to our
mirror zip URL. The Host opens `PackApplySheet`
preview, then confirm. If the Host is unreachable
or the origin is not that Host, the page falls back
to copy-URL.

### Publish v1

Only Nick approves a listing to published. No
auto-publish. This is not Cluster Admin
([ADR 0042](0042-admin-role-and-share-permission.md)).
A Publisher role and a Submit portal are later.

### Author identity v1

Pack id stays `author.slug` as
[ADR 0039](0039-pack-vs-bot-portable-recipe.md)
(`dostigus.mailer`). The listing has an author
string and an optional link. Member or Org bind
is later.

### Updates

No auto-update
([ADR 0039](0039-pack-vs-bot-portable-recipe.md)).
A Member Re-Applies the new version. An
“Update available” badge is later.

### Listing assets

Screenshots upload to our object storage on
submit or publish. They are not required inside
the Pack zip. Listing ≠ binary (App Store model).

### Migrate

Move Kitchen, Mail, and Reader from
`dostigus/cloud/packs/` and `content/packs/`
into the Catalog Store and mirrors. Deprecate
those static trees as the publish path.

### Authoring DX (outline)

Name `dostigus/pack-template` and a CLI
validate / submit in Consequences and ship
order. A detailed Submit portal is later.
This record's impl path is Catalog Store +
mirror + public read API + deep-link + migrate.

### Mailer later

A Mailer product Pack (IMAP / SMTP) is a
**separate later ADR**. It is the first Pack
expected to use the new path after migrate.
This record is catalog infrastructure.

### Pack format

`pack.json`, `packFormat`, `engines.dostigus`,
semver, `skills/`, `schedules/`, `ui/` stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).
Secrets stay out of the Pack zip.

### Ship order

1. This docs PR merge (Nick ask, no Port).
2. Platform impl: Catalog Store schema, Nick
   publish, mirror storage, public read API
   for the site.
3. `dostigus/cloud`: consume the public API,
   deep-link CTA, migrate the three Packs.
4. Host: deep-link handler → existing
   preview / Apply (`PackApplySheet`).
5. Later: Submit portal, CLI, Mailer product
   ADR.

### Scope of this record

Docs only. No Host UI. No Port. No site pages
in this PR. Ask Nick before merge.

## Context

[ADR 0045](0045-pack-catalog-on-marketing-site.md)
put Marketplace on the marketing site and locked
static frontmatter plus a copy-URL CTA. That
matched a first 2–3 Pack set. It left the
catalog in `dostigus/cloud` trees and deferred
deep-link Apply.

A static tree as the forever publish path
cannot host listing assets beside the zip,
cannot give a stable mirror URL after author
origin moves, and cannot grow past a handful
of hand-edited pages.

A Host-pulled catalog index would pull a
remote feed into the Cluster and blur Closet
Import with Apply-from-index.
[ADR 0045](0045-pack-catalog-on-marketing-site.md)
still rejects that. The missing piece is a
Platform source of truth the site can read,
plus a deep-link that reuses the preview
already in
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).

Apply without preview would write a remote
zip onto a Bot with no plan. Secrets in a
Pack zip would leave the Cluster on a share.

A CMS as the sole listing source without a
Platform Catalog Store would keep publish
outside this monorepo and leave mirrors
unowned.

Kitchen, Mail, and Reader already exist as
site Pack pages. They should migrate onto
the Catalog Store, not stay a second publish
path.

A Mailer IMAP / SMTP Pack is a product, not
catalog infrastructure. It waits for its own
ADR after this path exists.

## Consequences

- Docs only. No Cluster Store migration,
  Host UI, MCP surface, site page, or Port
  in this record.
- Glossary: **Catalog Store** is Platform,
  not the Cluster Store. **Marketplace**
  pages read the public API. Pack Apply
  stays [ADR 0039](0039-pack-vs-bot-portable-recipe.md).
  Deep-link Apply is this record.
- [ADR 0045](0045-pack-catalog-on-marketing-site.md)
  static-only catalog and copy-URL-only CTA
  are superseded here. Host-pulled catalog
  and Apply-from-index still stand rejected.
  Marketplace name, `/marketplace`, Host
  out-link, `/packs` 301, Pro out of the
  public field, and Packs as the first kind
  stay.
- [ADR 0046](0046-site-i18n-url-prefix.md)
  Site URLs stay. Host out-link stays
  https://dostigus.ru/marketplace (RU).
- [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
  format, file / URL / git Apply, preview,
  and no auto-update stay. Member Apply
  from Marketplace uses the mirror zip URL.
- SPEC “In scope” names Catalog Store and
  deep-link Apply. SPEC “This Host” still
  has no live catalog pull and no
  `applyPack=` handler today. SPEC out of
  scope still excludes Host-pulled catalog
  and Apply-from-index. Submit portal,
  Publisher role, “Update available”,
  Member / Org bind, and the Mailer product
  Pack stay later.
- Kitchen Module seed stays a seed
  ([ADR 0026](0026-kitchen-module-day-1.md)).
  A Kitchen listing is a recipe people
  Apply.
- Authoring DX names `dostigus/pack-template`
  and a CLI validate / submit. Detail is
  later.
- Mailer (IMAP / SMTP) waits for its own
  ADR. It is the first Pack expected on
  this path after migrate.

## Alternatives

- Host-pulled catalog index / Apply-from-index
  — rejected. Closet Import stays
  [ADR 0039](0039-pack-vs-bot-portable-recipe.md).
- Keep static `content/packs` + `packs/` as
  the forever publish path — rejected.
  Migrate the three Packs. Deprecate those
  trees as publish.
- Copy-URL-only CTA forever — superseded.
  Deep-link Apply is this record. Copy-URL
  stays the fallback.
- Auto-update installed Packs — rejected.
  [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
  stands. Re-Apply a new version.
- Auto-publish on submit — rejected. Nick
  approves v1.
- Cluster Admin as Marketplace publisher —
  rejected. Not
  [ADR 0042](0042-admin-role-and-share-permission.md).
- CMS as the sole listing source without a
  Platform Catalog Store — rejected.
- Apply without preview / plan — rejected.
- Secrets in the Pack zip — rejected.
- Require screenshots inside the Pack zip
  — rejected. Listing ≠ binary.
- Bind listing author to a Member or Org
  in v1 — rejected. Author string + optional
  link.
- “Update available” badge in v1 — rejected.
  Later.
- Turn this record into the Mailer product
  Pack — rejected. Separate later ADR.
- Advertise Pro on the public site —
  rejected.
  [ADR 0040](0040-collective-host-direction.md).
- Change Pack format (`pack.json`,
  `packFormat`, `engines.dostigus`) —
  rejected.
- Host UI, site pages, or Port in this PR
  — rejected. Docs only. Ask Nick before
  merge.
