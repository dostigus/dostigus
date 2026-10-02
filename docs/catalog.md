# Catalog Store

Marketplace listings live in the **Catalog Store** on the
marketing site / dostigus.ru (`dostigus/cloud`)
([ADR 0047](adr/0047-marketplace-catalog-store.md)). This is
not the Cluster Store. Platform Host does **not** run Catalog
Store for the public marketplace.

This Host does not ship `@dostigus/catalog`, `/api/catalog/*`,
or Catalog env (`CATALOG_*`, `*_CATALOG_PUBLISH_TOKEN`). Host
[#189](https://github.com/dostigus/dostigus/pull/189) landed
those on Platform Host (`dostigus.kosarev.space`); that Port
was the wrong place for a shared Marketplace and is removed.

Pack format stays
[ADR 0039](adr/0039-pack-vs-bot-portable-recipe.md)
(`pack.json`, `packFormat` 1). Secrets stay out of the Pack
zip. Host Closet Import is unchanged: a local file, a public
`.zip` URL, or an https git remote, preview → confirm. This
Host does not pull a catalog index and does not
Apply-from-index.

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
preview. The Host handler is a follow-up. Copy-URL stays
the fallback.

## Ship order

1. Docs amend (Catalog Store on cloud, not Host) — landed.
2. Cloud Catalog Store + mirrors + seed + site consume.
3. Host remove of `#189` catalog — this Host.
4. Optional Host `applyPack=` deep-link → existing preview /
   Apply (`PackApplySheet`).
5. Mailer product Pack later ADR.

Ask Nick before merge and before Port.
