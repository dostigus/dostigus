# ADR 0039: Pack vs Bot portable recipe

- Status: accepted
- Date: 2026-09-26

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

This record is the decision. It does not change Host, Store, MCP
surface, or Apply code. The impl PR lands after this docs PR
merges.

Nick locked the nouns and the export / import shape below on
2026-09-26.

## Decision

A **Bot** is a runtime identity on a Cluster. A **Pack** is a
portable recipe. They are not the same object. A Pack is also
**not** a Module package.

| Noun | What it is | What it is not |
| --- | --- | --- |
| **Bot** | Live identity on one Cluster: id, display name, avatar / appearance, Threads / Chat history, live memory, bound secrets / API keys / MCP sessions, enabled Schedules, computer / sandbox assignment | A Pack, a shareable zip, a Module package |
| **Pack** | Portable recipe: soul / instructions, Skill docs (`SKILL.md`-class / skills files), Schedule **templates** (import paused), integration **stubs**, optional `ui/` HTML mini-apps, optional `suggestedAppearance` (create only), optional human README. Semver `id` + `version` | A live Bot, Chat, secrets, host paths, a Module package |
| **Module package** | Heavier declarative unit: schema / migrations, MCP tools, Kit UI bindings, Skill diffs ([ADR 0006](0006-day-1-declarative-modules.md)) | A Pack, a Bot |

Day-1 marketplace / OSS share ships **Packs**. Module package
Apply and Module package Marketplace remain later and separate
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

Integration stubs are slug + reason + required env **names**.
Never values.

### Apply / import (day-1)

Sources:

- local file or folder
- URL to an archive or raw `pack.json`
- git repo (optional path / ref; shallow fetch)

Trust is preview + consent. There is no repo whitelist on
day-1.

A later Marketplace catalog indexes the same format (cloud /
site). That catalog is not a Host blocker.

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
the snapshot (overwrite from the Pack). A local override means
fork the Pack or pin the old version. Never wipe Chat / history
on update.

Schedules from a Pack import **paused** (`enabled: false`). The
person enables them by hand.

Integrations are stubs only. The Host prompts to bind after
Apply. Tools do not start unbound.

### Export

Two artifacts. Do not mix them.

| Export | Purpose | Contains | Never contains |
| --- | --- | --- | --- |
| **Export Pack** | share / Marketplace / git | scrubbed recipe: soul, Skills, Schedule templates, stubs, optional `ui/`, optional `suggestedAppearance` | Chat, memory, API keys, MCP tokens, computer paths |
| **Export Bot backup** | Host → Host migrate | may include scrubbed memory / notes + optional Chat history toggle | secrets |

A Bot backup is a separate artifact from a Pack.

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

### Host UI (intent only)

Day-1 Host surfaces, when implemented:

- Export Pack
- Export Bot backup
- Import / Apply (file + URL + git)

This record does not implement those screens.

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
- Day-1 marketplace track is Packs. Module package Marketplace
  / Apply stays later
  ([ADR 0030](0030-chat-cards-module-catalog.md)).
- `pack.json` + `packFormat` + `engines.dostigus` are the
  Host-compatibility fields. Apply warns or blocks outside
  the range.
- Installed Pack snapshots are Store rows (`id@version`).
  The Bot stores a ref. This record does not add those
  columns.
- Update overwrites Pack-owned Skills and `ui/`. Chat and
  history stay. Local Skill / UI edits that must survive an
  update are a fork or a pin, not a silent merge.
- Imported Schedules start paused. Unbound integration stubs
  do not run tools.
- Pack `ui/` is HTML in a sandboxed iframe inside the Sheet
  shell. It does not inject Vue / Kit into the Host and does
  not get Host Node APIs. [ADR 0006](0006-day-1-declarative-modules.md)
  still forbids arbitrary in-cluster module code.
- Kitchen stays a Host seed
  ([ADR 0026](0026-kitchen-module-day-1.md)). This record does
  not turn Kitchen into a Pack.
- Signing / notarization is later.

### Out of scope

- Runtime / impl, Store migrations, MCP tools, Host UI
  screens, and Apply code.
- Multi-bot team Packs.
- Module package Apply and Module package catalog tools.
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
