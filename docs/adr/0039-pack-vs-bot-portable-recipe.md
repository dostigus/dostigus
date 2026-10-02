# ADR 0039: Pack vs Bot portable recipe

- Status: accepted
- Date: 2026-09-26
- Amended: 2026-09-28 — Export Bot-part slug is RU→lat then
  slugify (no silent `pack` fallback for a named Bot); Export
  Sheet only when the Bot-part slug would be empty/`pack`, the
  Pack id conflicts with another Bot's installed Pack, or this
  Bot already has `installed_pack_id`; Export omits Host seed
  Skills; Export stamps the installed Pack snapshot and the Bot
  ref; Apply update owns only Schedules stamped with the previous
  Pack snapshot (Owner-created and unlabeled grandfather rows
  stay).
- Amended: 2026-09-28 — URL / git Apply is in scope. File Apply
  and preview / plan stay. URL (non-git) is `.zip` only. Git is
  https, `git clone --depth 1`, optional path + ref. Destination
  SSRF matches Host HTTP get. Caps: 25 MB, 60 s. Successful Apply
  stores snapshot `source` (`file` / `url` / `git`). Host runtime
  image installs `git`.
- Amended: 2026-10-02 — Public Pack catalog is
  [ADR 0045](0045-pack-catalog-on-marketing-site.md)
  (marketing site `/marketplace`, Host out-link). This record's Apply
  sources stay. In-product catalog Apply stays out.
- Amended: 2026-10-02 — Public catalog is **Marketplace** at
  `/marketplace` ([ADR 0045](0045-pack-catalog-on-marketing-site.md)).
  Packs are the first catalog kind. `/packs` 301s. Host out-link
  is https://dostigus.ru/marketplace. This record's Apply
  sources stay. In-product Marketplace Apply stays out.
- Amended: 2026-10-02 — Marketplace listings live in the
  Catalog Store
  ([ADR 0047](0047-marketplace-catalog-store.md)).
  Member Apply from Marketplace uses our mirror zip
  URL. Deep-link `applyPack=` opens this record's
  preview / plan (`PackApplySheet`). File / URL / git
  Apply stay. Host-pulled catalog and auto-update
  stay out. Pack format stays this record.

Platform git vs Cluster objects stays
[ADR 0001](0001-platform-git-vs-in-cluster-bot-packages.md).
Declarative Module packages stay
[ADR 0006](0006-day-1-declarative-modules.md). Module package
Marketplace / Apply stays later
([ADR 0030](0030-chat-cards-module-catalog.md)). Kitchen stays a
Host seed, not a Pack
([ADR 0026](0026-kitchen-module-day-1.md)). Sheet shell and Kit
bindings stay [ADR 0002](0002-host-ui-kit-and-sheets.md) and
[ADR 0013](0013-kit-reka-ui-and-brand.md).

Nick locked the nouns and the export / import shape below on
2026-09-26, and the Export / Apply polish below on 2026-09-28.

## Decision

A **Bot** is a runtime identity on a Cluster. A **Pack** is a
portable recipe. They are not the same object. A Pack is also
**not** a Module package.

| Noun | What it is | What it is not |
| --- | --- | --- |
| **Bot** | Live identity on one Cluster: id, display name, avatar / appearance, Threads / Chat history, live memory, bound secrets / API keys / MCP sessions, enabled Schedules, computer / sandbox assignment | A Pack, a shareable zip, a Module package |
| **Pack** | Portable recipe: soul / instructions, Skill docs (`SKILL.md`-class / skills files), Schedule **templates** (import paused), integration **stubs**, optional `ui/` HTML mini-apps, optional `suggestedAppearance` (create only), optional human README. Semver `id` + `version` | A live Bot, Chat, secrets, host paths, a Module package |
| **Module package** | Heavier declarative unit: schema / migrations, MCP tools, Kit UI bindings, Skill diffs ([ADR 0006](0006-day-1-declarative-modules.md)) | A Pack, a Bot |

Day-1 marketplace / OSS share ships **Packs**. The public
**Marketplace** is [ADR 0045](0045-pack-catalog-on-marketing-site.md)
(https://dostigus.ru/marketplace, Host out-link; `/packs`
301s). Listing source of truth is the Catalog Store
([ADR 0047](0047-marketplace-catalog-store.md)). Packs are
the first catalog kind. Module package
Apply remains later
([ADR 0030](0030-chat-cards-module-catalog.md)).

Seller compatibility class: closer to Cursor skills / OpenMaus
packs than to Nuxt modules. A Pack does not inject Vue / Kit
into the Host process and does not receive an arbitrary Host
Node API.

### Artifact shape

Canonical on disk is a folder:

```
pack.json
skills/
schedules/          # optional
ui/<id>/            # optional
README              # optional
```

Share is a zip of that same tree.

The manifest file is **`pack.json`** (not `dostigus.pack.json`).
It carries a `packFormat` integer (schema version) and
`engines.dostigus` (semver range for the Host). Apply warns or
blocks when the Host is outside that range.

Public `id` is `author.slug` (not a UUID) plus semver `version`.
Author is the Owner username (or email local-part), slugified.
The Bot-part slug is **RU→lat transliteration** (in-repo char
table: ё→yo, ж→zh, …) then the same slugify. A Bot with a
non-empty name that only needs translit must not fall back to
`pack`. Zip filename is `{id}-{version}.zip`.

Integration stubs are slug + reason + required env **names**.
Never values. Export does not invent stubs from live Bot
secrets or MCP. `integrations` stays `[]` unless they already
exist on a previously installed Pack snapshot.

### Apply / import (day-1)

Sources (one Closet Import flow → the same preview / plan →
confirm → write):

- local file or folder
- public URL to a **`.zip` only** (suffix or zip Content-Type)
- https git remote (`git clone --depth 1`; optional path + ref)

A paste is classified by suffix / Content-Type (`.zip` → zip
fetch). Otherwise the Host treats it as git when the URL looks
cloneable: bare `https://github.com/owner/repo` becomes
`.git`; a GitHub web `…/tree/<ref>/<path>` becomes ref + path.
Unclear URLs fail with a hint. No raw `pack.json`. No GitHub
tree HTML as an archive substitute. No SSH, PAT, private auth,
LFS, or submodules.

Owner Host egress uses the same destination SSRF rules as
Host HTTP get ([ADR 0031](0031-host-http-get.md)): block
loopback, private, and link-local. Trust remains preview +
consent (no domain whitelist). Zip fetch reuses the Bot HTTP
egress helpers / `DOSTIGUS_HTTP_PROXY` knobs
([ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)).
Caps: **25 MB** archive / working tree, **60 s**, depth 1.

A zip or git checkout may have `pack.json` at the root or a
single top-level wrapper folder (unwrap).

On successful Apply the installed Pack snapshot stores
`source: { kind: 'url' | 'git' | 'file', url?, ref?, path? }`.
There is no auto-update / “check for update” UI.

The Host runtime image installs **`git`** so shallow clone
works.

Trust is preview + consent. There is no repo whitelist on
day-1.

The public Marketplace that indexes the same format is
[ADR 0045](0045-pack-catalog-on-marketing-site.md): marketing
site `/marketplace` first, Host out-link. Listings live in
the Catalog Store
([ADR 0047](0047-marketplace-catalog-store.md)). Deep-link
`applyPack=` reuses this preview. That catalog is not a
Host-pulled index and is not Apply-from-index.

Apply always shows a **preview / plan** before write: Bot
create vs update, Skills, Schedules (paused), `ui/`, missing
integrations. Confirm → write.

Apply target is an existing Bot **or** create a new Bot.
Day-1: one Pack → one primary Bot. Multi-bot team Packs are
later.

On create, optional `suggestedAppearance` may seed appearance.
Otherwise appearance lives on the Bot.

An installed Pack is an immutable snapshot `id@version` in the
Cluster Store. The Bot holds a ref to that installed Pack
version.

Update to a new version: the Pack **owns** Skills and `ui/` in
the snapshot (overwrite from the Pack), except Host seed Skills
(`platform-meta-*` or the Host seed allowlist). A local override
means fork the Pack or pin the old version. Never wipe Chat /
history on update.

Schedules from a Pack import **paused** (`enabled: false`). The
person enables them by hand. The Pack **owns** Schedules that
came from a Pack Apply, symmetrical to Skills replace. Those
rows store `schedules.installed_pack_id` (the snapshot id).
On create, new Schedules land paused and stamped with the new
snapshot. On update, remove / replace only Schedules stamped
with the **previous** Pack snapshot for this Bot. Owner-created
rows (null provenance) stay. Schedules with no provenance from
older Hosts are **not** deleted on the first Pack-update
(grandfather). Preview / plan shows Schedule add / replace /
remove.

Integrations are stubs only. The Host prompts to bind after
Apply. Tools do not start unbound.

### Export

Two artifacts. Do not mix them.

| Export | Purpose | Contains | Never contains |
| --- | --- | --- | --- |
| **Export Pack** | share / Marketplace / git | scrubbed recipe: soul, Skills (not Host seed Skills), Schedule templates (empty live name becomes cadence+time, Locale twin), stubs already on a snapshot, optional `ui/`, optional `suggestedAppearance` | Chat, memory, API keys, MCP tokens, computer paths, Host seed Skills |
| **Export Bot backup** | Host → Host migrate | may include scrubbed memory / notes + optional Chat history toggle | secrets |

A Bot backup is a separate artifact from a Pack.

A successful Export writes `putInstalledPack` and
`setBotInstalledPack` so the Bot refs that snapshot. The next
Export keeps the same id and uses `nextPackVersion` (patch bump)
unless the Export Sheet overrides version. Snapshot write is not
Apply-only.

Export omits Host seed Skills: id starts with `platform-meta-`,
or id is in the Host seed allowlist (`META_SKILL_IDS` in
`packages/db/src/meta-skills.ts` is the one source of truth).
Share Packs must not overwrite those Skills on Apply. A weather
Bot recipe is soul + wake + Host `http_get` at runtime.

### Export Sheet (Host)

Open the Export Sheet **only** when:

1. Without Sheet intervention the Bot-part slug would be empty /
   `pack`, or
2. The Pack id would conflict with another Bot's `installed_pack`
   on the Cluster, or
3. This Bot already has `installed_pack_id` (re-export).

Otherwise Export is one click (no Sheet). Sheet fields: author
(read-only), Bot slug part (editable), version (editable),
optional README. Confirm downloads the zip. Cancel dismisses.

### Sheet UI in a Pack

A Pack may ship Sheet UI as **HTML (+ assets)** under
`ui/<id>/`. The Host opens that tree in the Sheet shell as a
**sandboxed iframe** mini-app (Telegram-like), not as author
Vue / Kit components.

The schema includes the optional UI slot from day-1 even when
the first Packs ship an empty `ui/`.

Day-1 bridge is a narrow `postMessage` allowlist:
`getContext`, `close`. A richer tool bridge is later. The
iframe does not receive a raw Host API.

This is not arbitrary in-cluster module code
([ADR 0006](0006-day-1-declarative-modules.md)). It is not a
per-bot SPA or a per-bot domain
([ADR 0002](0002-host-ui-kit-and-sheets.md)).

### Host UI

Day-1 Host surfaces:

- Export Pack (one-click, or Export Sheet when a trigger above
  fires)
- Import / Apply from a local file or folder, a public `.zip`
  URL, or an https git remote (one Closet surface, preview /
  plan, then confirm)

Export Bot backup stays later.

## Context

[ADR 0001](0001-platform-git-vs-in-cluster-bot-packages.md)
keeps git for the Platform monorepo and says Clusters
export / import packages as objects. That sentence mixed a
shareable recipe with a live Bot and with a Module package.

Household share and a later Marketplace need a portable
**recipe** that is safe to zip, publish, and Apply onto another
Cluster. A live Bot also needs a Host → Host **backup** that
can carry history. Those are different artifacts. Secrets stay
on the Cluster.

Module packages remain the heavier declarative install unit
([ADR 0006](0006-day-1-declarative-modules.md)). Day-1 share
should look like a skill / pack tree, not like a Nuxt module
that loads into the Host process.

## Consequences

- Glossary: **Pack ≠ Bot ≠ Module package**. Use Pack for the
  portable recipe. Use Bot for the runtime identity. Use
  Module package for schema / MCP / Kit bindings.
- Day-1 marketplace track is Packs. The public Marketplace is
  [ADR 0045](0045-pack-catalog-on-marketing-site.md).
  Catalog Store and deep-link Apply are
  [ADR 0047](0047-marketplace-catalog-store.md). Module
  package Apply stays later
  ([ADR 0030](0030-chat-cards-module-catalog.md)).
- `pack.json` + `packFormat` + `engines.dostigus` are the
  Host-compatibility fields. Apply warns or blocks outside
  the range.
- Installed Pack snapshots are Store rows (`id@version`).
  The Bot stores a ref. Export and Apply both write that
  snapshot.
- Update overwrites Pack-owned Skills and `ui/`. Host seed
  Skills stay. Chat and history stay. Local Skill / UI edits
  that must survive an update are a fork or a pin, not a
  silent merge.
- Imported Schedules start paused and stamped with the
  snapshot id. Update replaces only rows stamped with the
  previous snapshot. Unbound integration stubs do not run
  tools.
- Pack `ui/` is HTML in a sandboxed iframe inside the Sheet
  shell. It does not inject Vue / Kit into the Host and does
  not get Host Node APIs. [ADR 0006](0006-day-1-declarative-modules.md)
  still forbids arbitrary in-cluster module code.
- Kitchen stays a Host seed
  ([ADR 0026](0026-kitchen-module-day-1.md)). This record does
  not turn Kitchen into a Pack.
- Signing / notarization is later.

### Out of scope

- Export Bot backup.
- In-product Host Marketplace / Apply-from-index. Public
  Marketplace is
  [ADR 0045](0045-pack-catalog-on-marketing-site.md).
  Catalog Store and deep-link Apply are
  [ADR 0047](0047-marketplace-catalog-store.md).
  Module packages are a later Marketplace kind.
- Pack `ui/` iframe host.
- Private packs, SSH, PAT, LFS, submodules, and auto-update
  from source.
- Module package Apply and Module package catalog tools.
- Inventing integration stubs from live secrets / MCP.
- Multi-bot team Packs.
- Signing / notarization.
- Changing the Kitchen seed into a Pack.

## Alternatives

- Treat the live Bot as the shareable package — rejected.
  Chat, memory, secrets, and host paths must not leave the
  Cluster on a share / Marketplace export.
- One artifact for share and for Host → Host migrate —
  rejected. Export Pack is the recipe. Export Bot backup is
  the migrate artifact (still never secrets).
- Ship day-1 share as Module packages — rejected. Module
  packages stay declarative and later
  ([ADR 0006](0006-day-1-declarative-modules.md),
  [ADR 0030](0030-chat-cards-module-catalog.md)). Pack is the
  seller-facing recipe.
- Author Vue / Kit components in a Pack, loaded into the Host
  process — rejected. Compatibility is skills / OpenMaus-class
  packs, not Nuxt modules. Pack UI is sandboxed HTML.
- Arbitrary in-cluster JS / Python as Pack UI — rejected.
  That is the [ADR 0006](0006-day-1-declarative-modules.md)
  sandbox, still later. HTML iframe is not that sandbox.
- UUID as the public Pack id — rejected. Public id is
  `author.slug` plus semver `version`.
- Silent `pack` Bot-part when the name is Cyrillic — rejected.
  Transliterate, then slugify.
- Always open an Export Sheet — rejected. Sheet only for
  empty/`pack` slug, id conflict, or re-export.
- Export Host seed Skills — rejected. Share must not
  overwrite Host meta Skills on Apply.
- Invent integration stubs from live Bot secrets / MCP —
  rejected. Leave `integrations: []` unless a snapshot
  already has them.
- Write the installed Pack snapshot only on Apply — rejected.
  Export stamps the snapshot so the next Export can bump
  version.
- Wipe every Schedule on Pack update — rejected. Pack owns
  only provenance-stamped rows from the previous snapshot.
  Owner-created and unlabeled grandfather rows stay.
- Raw `pack.json` or GitHub tree HTML as a URL Apply source —
  rejected. URL (non-git) is `.zip` only.
- SSH, PAT, or private git auth on day-1 — rejected.
- Domain whitelist as the day-1 URL / git trust model —
  rejected. Trust is preview + consent plus destination SSRF.
- Auto-update / “check for update” from stored source —
  rejected. Provenance only.
- Import Schedules already enabled — rejected. Templates
  land paused.
- Merge local Skill / UI edits on Pack update — rejected.
  The Pack owns those files in the snapshot. Fork or pin.
- Wipe Chat on Pack update — rejected.
- Repo whitelist as the day-1 trust model — rejected.
  Trust is preview + consent.
- Multi-bot team Packs on day-1 — later.
- `dostigus.pack.json` as the filename — rejected for
  day-1. The file is `pack.json` with `packFormat`.
