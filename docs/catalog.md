# Catalog Store

Marketplace listings live in the **Catalog Store** on Platform
([ADR 0047](adr/0047-marketplace-catalog-store.md)). This is not the
Cluster Store. The marketing site (`dostigus/cloud`) reads the public
API. It does not own publish. Pack format stays
[ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md) (`pack.json`,
`packFormat` 1). Secrets stay out of the Pack zip.

Host Closet Import is unchanged. This Host does not pull a catalog
index and does not Apply-from-index.

## Store

Separate SQLite (`@dostigus/catalog`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `CATALOG_DATABASE_URL` | `file:.data/catalog.sqlite` | Catalog Store file. Compose: `file:/var/lib/dostigus/catalog.sqlite`. |
| `CATALOG_MIRROR_DIR` | next to the Store (`catalog-mirrors/`) | Immutable `{id}-{version}.zip`. |
| `CATALOG_ASSETS_DIR` | next to the Store (`catalog-assets/`) | Listing screenshots we host. |
| `CATALOG_PUBLIC_ORIGIN` | empty | Absolute origin for public `mirror.href` (example `https://host.example`). Empty → relative `/api/catalog/…` paths. |
| `DOSTIGUS_CATALOG_PUBLISH_TOKEN` | empty | Nick publish Bearer. Empty → publish disabled (403). |
| `NUXT_CATALOG_PUBLISH_TOKEN` | empty | Preferred alias for that Bearer. |

Self-host compose does not need these. A self-host Cluster Store stays
on `DATABASE_URL`. An empty Catalog Store answers an empty public list.

## Public read (cloud)

CORS `*` on GET. No session.

```
GET /api/catalog/packs
GET /api/catalog/packs/:id
GET /api/catalog/packs/:id/versions/:version
GET /api/catalog/packs/:id/versions/:version/zip
GET /api/catalog/assets/:id
```

`:id` is the Pack id (`author.slug`, example `dostigus.kitchen`).
List returns the latest published version per Pack, `sortOrder` then id.
Each published Pack includes `mirror.href` for the immutable zip.

Example list item:

```json
{
  "id": "dostigus.kitchen",
  "version": "1.0.0",
  "author": "Dostigus",
  "authorLink": "https://dostigus.ru",
  "title": { "en": "…", "ru": "…" },
  "short": { "en": "…", "ru": "…" },
  "long": { "en": "…", "ru": "…" },
  "screenshots": [],
  "assets": [],
  "status": "published",
  "mirror": {
    "filename": "dostigus.kitchen-1.0.0.zip",
    "href": "/api/catalog/packs/dostigus.kitchen/versions/1.0.0/zip"
  },
  "publishedAt": "2026-10-02T00:00:00.000Z"
}
```

`dostigus/cloud` should:

1. Set `CATALOG_PUBLIC_ORIGIN` on the Platform Host that holds the
   Catalog Store (or prepend that origin itself).
2. Replace static `content/packs` reads with `GET /api/catalog/packs`.
3. Point the Marketplace CTA at the Host with
   `applyPack=` plus `mirror.href` (Host handler is a follow-up).
   Copy-URL stays the fallback.
4. Stop treating `packs/` trees as the publish path.

## Nick publish

Not Cluster Owner. Not Cluster Admin. Bearer only.

```
Authorization: Bearer <DOSTIGUS_CATALOG_PUBLISH_TOKEN>
```

```
GET  /api/catalog/listings
POST /api/catalog/listings
POST /api/catalog/listings/:id/versions/:version/publish
POST /api/catalog/assets
POST /api/catalog/seed
```

`POST /api/catalog/listings` accepts JSON `{ listing, pack, publish }`
(`pack` is a Pack tree) or `{ listing, zipBase64, publish }`, or
multipart `file` + `listing` JSON + `publish=1`. The zip is validated
with `packages/shared` `pack.ts` (`packFormat` 1, no secrets).
`publish: true` writes the immutable mirror in the same call.

Approve a draft (zip already submitted) with
`POST /api/catalog/listings/:id/versions/:version/publish`.
A published `(id, version)` is immutable. A new version is a new row.

Listing screenshots are not required inside the Pack zip. Upload with
`POST /api/catalog/assets` (multipart) and put the returned `href` on
the listing.

## Seed Kitchen / Mail / Reader

`POST /api/catalog/seed` (Nick token) publishes the three Packs from
`dostigus/cloud` `packs/` + `content/packs/` (copied into
`@dostigus/catalog` fixtures). Idempotent for `1.0.0`.

To push a newer tree from cloud without waiting for a Platform fixture
bump:

```
POST /api/catalog/listings
Authorization: Bearer …
Content-Type: application/json

{
  "publish": true,
  "listing": {
    "author": "Dostigus",
    "authorLink": "https://dostigus.ru",
    "title": { "en": "…", "ru": "…" },
    "short": { "en": "…", "ru": "…" },
    "long": { "en": "…", "ru": "…" },
    "originUrl": "https://github.com/dostigus/cloud/tree/main/packs/kitchen",
    "sortOrder": 1
  },
  "zipBase64": "<packFormat 1 zip>"
}
```

## Deferred

- Host `applyPack=` → `PackApplySheet` (ADR 0047 ship order step 4).
- Site consume of this API (`dostigus/cloud`).
- Submit portal, CLI, Publisher role, Mailer product Pack.

Ask Nick before merge and before Port.
