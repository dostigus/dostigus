# Catalog Store

Marketplace listings live in the **Catalog Store** on the
marketing site / dostigus.ru (`dostigus/cloud`)
([ADR 0047](adr/0047-marketplace-catalog-store.md)). This is
not the Cluster Store. Platform Host does **not** run Catalog
Store for the public marketplace.

**Host [#189](https://github.com/dostigus/dostigus/pull/189)
misplaced.** `@dostigus/catalog` and `/api/catalog/*` on
Platform Host (`dostigus.kosarev.space`) were the wrong
place for a shared Marketplace all Clusters Apply from.
Treat that Port as **deprecated / to remove or no-op**.
Remove Catalog from the Host Port in a follow-up PR. Do
not expand Host catalog.

Pack format stays
[ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md)
(`pack.json`, `packFormat` 1). Secrets stay out of the Pack
zip. Host Closet Import is unchanged. This Host does not
pull a catalog index and does not Apply-from-index.

## Intended home (cloud)

`dostigus/cloud` owns:

- Catalog Store schema and listings
- immutable `{id}-{version}.zip` mirrors
- Nick publish / seed
- public read API under dostigus.ru (for example
  `/api/catalog/...`, or the path that site documents)
- Marketplace pages that consume that API

Member Apply uses the **cloud** mirror zip URL. Deep-link
Apply is `applyPack=` plus that URL → `PackApplySheet`
preview (Host handler is a later, optional step). Copy-URL
stays the fallback.

## Misplaced Host Port (do not expand)

[#189](https://github.com/dostigus/dostigus/pull/189) landed
`@dostigus/catalog` on this monorepo and Host routes below.
They are not the public marketplace. Self-host Clusters
should leave publish disabled and should not seed. A later
PR removes this Port.

| Variable | Default | Purpose (Host #189 only) |
| --- | --- | --- |
| `CATALOG_DATABASE_URL` | `file:.data/catalog.sqlite` | Misplaced Host Catalog Store file. Not `DATABASE_URL`. |
| `CATALOG_MIRROR_DIR` | next to the Store (`catalog-mirrors/`) | Misplaced Host mirrors. |
| `CATALOG_ASSETS_DIR` | next to the Store (`catalog-assets/`) | Misplaced Host listing screenshots. |
| `CATALOG_PUBLIC_ORIGIN` | empty | Do not point the site at a Member Host. |
| `DOSTIGUS_CATALOG_PUBLISH_TOKEN` | empty | Leave empty on Member Hosts. |
| `NUXT_CATALOG_PUBLISH_TOKEN` | empty | Alias for that Bearer. |

Self-host compose does not need these. A self-host Cluster
Store stays on `DATABASE_URL`.

The Host routes that #189 added (public GET + Nick Bearer
POST) stay documented only so the follow-up can delete
them. Cloud should re-home the same shape under
dostigus.ru, not grow this Host surface.

```
GET /api/catalog/packs
GET /api/catalog/packs/:id
GET /api/catalog/packs/:id/versions/:version
GET /api/catalog/packs/:id/versions/:version/zip
GET /api/catalog/assets/:id
```

`:id` is the Pack id (`author.slug`, example
`dostigus.kitchen`). List returns the latest published
version per Pack. Each published Pack includes
`mirror.href` for the immutable zip.

## Ship order

1. This docs amend (Nick ask, no Port).
2. Cloud Catalog Store + mirrors + seed + site consume.
3. Host remove of `#189` catalog / optional deep-link only.
4. Mailer product Pack later ADR.

Ask Nick before merge and before Port.
