# ADR 0036: LLM Providers, tier resolve, and escalate

- Status: accepted
- Date: 2026-09-25
- Amended: 2026-09-25 — Settings / OpenRouter catalog: casual key-only
  path, Host-proxied live catalog (`kind=openrouter` only), quality
  shelf Free / Smart / Coding as Policy pins, Advanced pin now day-1
  of this amend. Escalate and meta free / auto stay. This docs PR
  does not implement Host code.
- Amended: 2026-09-25 — Settings information architecture (grill
  Q13–Q17): multi-page `/settings/...` with left nav; day-1 pages
  **Провайдеры** and **Прочее**; Providers page two-column story;
  health / confidence from key + soft catalog probe (not a Chat
  blocker). Catalog / shelf / Advanced / pin / cache / OpenRouter-only
  stay.
- Amended: 2026-09-25 — Settings / catalog impl notes: child slugs,
  the key-accepted signal, and the shelf ranking rule (see Settings
  impl notes). No decision above changes.

The OpenAI-compatible LLM gateway shape and transient *same-model*
retry stay [ADR 0004](0004-llm-gateway-tiers.md). Model tier *names*
stay `cheap` | `strong` | `code` | `toy`. This record owns how those
tiers are **bound and resolved**, and how the Host **escalates** after
a failed attempt. Settings catalog, the OpenRouter quality shelf,
and Settings information architecture also live here. Do not mint
a new ADR for that layer.

Turn journal fields stay
[ADR 0029](0029-turn-journal.md) (`modelId`, `servedModelId`, token
aggregates, `llmCallCount`). Image Artifact vision stays
[ADR 0035](0035-image-artifact-vision.md). Cluster outbound (LLM
proxy vs Bot HTTP egress) stays
[ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md). Chat
assembly stays [ADR 0032](0032-chat-llm-context-assembly.md). The
tool loop stays [ADR 0011](0011-chat-mcp-tool-loop.md). Session and
Household stay [ADR 0010](0010-owner-auth-session.md) and
[ADR 0012](0012-household-members.md).

This record is the decision. The first Host impl (Provider
instances, tier bind, silent escalate) has landed. This amend
does **not** change Host or Store code. The Settings / catalog
Host impl lands after this docs PR merges.

Nick locked the bind / escalate shape on 2026-09-25 (grill
«рекомендуемые» + «да погнали»). Nick locked the Settings /
OpenRouter catalog layer the same day (grill rounds 1–3), then
Settings information architecture (Q13–Q17).

## Decision

The Cluster still owns an **LLM gateway**. Day-1 Owners connect
**Provider** instances, bind each **Model tier** to a Provider plus
a **Policy**, and the Host always pursues a usable result along a
fixed escalate chain. Dostigus source does **not** bake a model-id
catalog.

### Provider

A **Provider** is an Owner-connected gateway instance:

| Field | Day-1 |
| --- | --- |
| `kind` | `openrouter` \| `openai` \| `openai-compatible` |
| API key | required to call that instance |
| `baseUrl` | optional; required in practice for `openai-compatible` |

It is not a frozen model list in this monorepo. Several instances
may exist (two OpenRouter keys, or OpenRouter plus a direct
OpenAI). Kind is the driver, not the catalog.

`VISION_MODEL_NEEDLES`-style code lists stay
[ADR 0035](0035-image-artifact-vision.md). They are orthogonal and
stay until a later ADR. They are not the product catalog.

### Policy

A **Policy** is how the Host resolves a model id on that Provider
for one Model tier.

OpenRouter casual Policies:

| Policy | Intended request id | Meaning |
| --- | --- | --- |
| `free` | meta **free** — intended `openrouter/free` | OpenRouter free routing |
| `auto` | meta **auto** — intended `openrouter/auto` | OpenRouter auto routing |

The impl PR verifies those slugs against current OpenRouter docs
and may use a documented equivalent. This record may say “meta
free / meta auto” with those as the intended ids.

Direct OpenAI and `openai-compatible`: when that instance is the
**sole** Provider, **one** live-chosen model id is shared across
all tiers (Owner may later split). Day-1 does not require a
per-tier pin on that sole instance.

A pin of a concrete catalog id is a Policy kind too. Day-1 of
this amend: OpenRouter Settings may write that pin (quality
shelf or Advanced). OpenAI / `openai-compatible` live lists
stay later. When a pin exists, an optional steal from
OpenMausBot is `allow_fallbacks: false` on a pinned concrete
id. That steal is not required for meta free / meta auto, and
is still optional on a pin.

### Tier bind

Each Model tier binds to **Provider + Policy**, not a baked id.

| Model tier | Intent (unchanged from [ADR 0004](0004-llm-gateway-tiers.md)) |
| --- | --- |
| `cheap` | low-cost / routine |
| `strong` | default capable Chat |
| `code` | harder / escalate step |
| `toy` | playground / explicit only |

`toy` is outside the escalate chain. It is not a production start
and not an upshift target.

### Casual onboarding

- Owner adds **one** Provider → the Host **auto-fills all empty
  tiers** with that Provider.
- OpenRouter fill defaults: `cheap` + `toy` → Policy `free`;
  `strong` + `code` → Policy `auto`.
- Sole direct OpenAI (or `openai-compatible`): **one** model for
  all tiers (pick from a live list or a Settings default once).
- Second and later Providers: the Owner assigns per-tier which
  Provider (weak → one, hard → another). Empty tiers are not
  auto-stolen from the first instance once the Owner has more
  than one.

This **supersedes** the [ADR 0004](0004-llm-gateway-tiers.md)
sentence that free / random model roulette is toy only.
OpenRouter Policy `free` on `cheap` and `toy` is allowed for
casual. `toy` remains the playground slot. `cheap` may use meta
free for Wake / Schedule starts.

### Start tier

Situation picks the **first** attempt. A Bot Manifest `modelTier`
is not a day-1 override (Bot override of Provider / tier / model
is later). The column may stay for compat; it does not pick the
first attempt.

| Trigger / situation | Start tier |
| --- | --- |
| Chat / `user` (and a room `mention`) | `strong` |
| Wake / Schedule | `cheap` |
| `code` as start | **never day-1** (`code` is an escalate step only) |
| `toy` | outside the escalate chain (playground / explicit only) |

### Escalate

On failure of the current attempt, the Host **upshifts** along a
fixed chain:

`cheap` → `strong` → `code`

Skip a tier that is unset or that already resolved to the same
Provider + Policy (or the same pinned id) as an attempt this Turn
already tried.

Max **3** LLM-tier attempts per Turn. The
[ADR 0004](0004-llm-gateway-tiers.md) same-model transient retry
does **not** count as a second tier attempt.

Day-1 triggers (**soft + hard**, not a quality judge):

- API / HTTP error, timeout
- empty completion
- tool loop exhausted without an assistant answer
- explicit model refuse (detectable)

**Not** day-1: LLM-as-judge, thumbs, or an “answer quality score”.

Escalate is **silent** in Chat. The person sees a normal reply or
the existing Russian error bubble after attempts are exhausted
([ADR 0004](0004-llm-gateway-tiers.md) copy). There is no
Owner-visible escalate badge on day-1.

Ops sees attempts through the Turn journal / MCP
([ADR 0029](0029-turn-journal.md)): `modelId`, `servedModelId`,
tokens, `llmCallCount`. Each attempt accumulates on the **same**
Turn.

Prefer the existing aggregates: last **successful** resolve on
`modelId` / `modelTier` / `servedModelId`, plus `llmCallCount`
across completions (including the same-model transient retry).
If the Turn ends in error, keep the **last attempted** resolve so
ops can see what failed. Re-patch those fields after each
resolve while `outcome` is still `running`. Per-attempt journal
rows are later; amend [ADR 0029](0029-turn-journal.md) in the
**impl** PR only if those aggregates are not enough.

### Transient retry vs escalate

These are different knobs. Do not merge them.

| | [ADR 0004](0004-llm-gateway-tiers.md) retry | This record (escalate) |
| --- | --- | --- |
| What changes | Nothing. Same completion, same model | Upshift Model tier / Provider |
| When | Transient network, abort, timeout, HTTP 429, HTTP 5xx | Soft + hard failure after that attempt (API / timeout / empty / tool-loop exhausted / refuse) |
| Empty body | **Not** retried | **Does** escalate |
| HTTP 401 / 403 | **Not** retried | May escalate to another Provider if one is bound; a sole bad key still fails |
| Count | One retry on that completion | Max 3 tier attempts per Turn |
| Chat | Error bubble only after that retry is exhausted **and** escalate is exhausted | Silent while a later tier still runs |

Order on one attempt: run the tool loop on the resolved model;
apply the 0004 same-model retry when that completion is
transient; if the attempt still has no assistant answer, escalate.

### Live catalog

Casual OpenRouter resolve still uses meta Policies and does
**not** require a live catalog to succeed. Day-1 of this amend
fetches the live OpenRouter list for Settings only (see
Settings / OpenRouter catalog). OpenAI /
`openai-compatible` catalogues stay later, same pattern.

### Settings UI (sketch)

Owner Settings, not the Bot closet (the closet already has no
model field; that stays
[ADR 0020](0020-bot-closet.md) /
[ADR 0028](0028-bot-self-settings-via-chat.md)).

The first day-1 sketch put a four-tier Provider + Policy grid
in the face on one Settings page. This amend **supersedes**
that for OpenRouter: paste key, meta routing by default,
optional quality shelf, details under «Подробнее». The
four-tier bind remains the Store model; it is not required
in the casual face. Settings itself becomes multi-page (see
Settings information architecture). No Bot closet model field.

### Settings / OpenRouter catalog (amend)

Nick locked this on 2026-09-25 after the Providers Port
(grill rounds 1–3). This is a Settings / catalog layer on
the same record. It does not mint ADR 0037. Escalate,
situation start, and meta free / auto stay.

#### Casual path

The Owner adds OpenRouter and pastes the key. Save is enough.
Chat and Wake work through the existing casual Policies
(`cheap` + `toy` → meta **free**; `strong` + `code` → meta
**auto**). The default face is «Маршрутизация OpenRouter».
The four-tier matrix is **not** required in the face. Details
live under «Подробнее» / Advanced.

#### Catalog fetch

After the key is saved, the Host `GET`s OpenRouter
`/api/v1/models`. The Host uses the stored Provider key
**server-side**. The UI never sees the key. The catalog is
an Owner-session Host endpoint that returns the proxied /
cached list for a Provider id.

Cache is about **24 hours**, plus an explicit «Обновить» /
Refresh in Settings. A Refresh bypasses the stale cache.

Day-1 of this amend is `kind=openrouter` only. An OpenAI
(or `openai-compatible`) list later uses the same Host
proxy + cache pattern.

#### Quality shelf

Settings shows a short shelf of three ranked cards — **Free /
Smart / Coding** — plus «Оставить маршрутизацию OpenRouter».
Not four identical tier pickers.

Rank from the **live** API (intelligence / price / free
filter). **No model ids are baked into git.** Shelf labels
are Settings quality slots. They are **not** Model tier
names. `cheap` | `strong` | `code` | `toy` stay.

| Shelf card | Policy pin |
| --- | --- |
| Free | `cheap` + `toy` |
| Smart | `strong` |
| Coding | `code` |

That map matches the escalate chain. A pick writes Policy
pins (concrete catalog ids) on those tiers through the
existing Policy write path.

«Оставить маршрутизацию OpenRouter» **clears** those pins
and restores meta free / auto. Escalate is unchanged: soft
+ hard fail only. The shelf is not a quality judge and does
not change escalate triggers.

#### Catalog fail

A catalog miss (auth, network, empty, cache miss + upstream
error) is a red / info banner in Settings. The Cluster
**still runs** on meta free / auto. The shelf is unavailable.
That is not a blocker. Casual Chat does not wait on the
catalog.

#### Advanced

Under «Подробнее» / Advanced:

- searchable full live list («Все модели»)
- optional per-tier pin (same Policy write as the shelf)
- «Обновить список» (the same Refresh)
- raw Policy view

#### Vision badge

Shelf and Advanced cards may show a vision badge from
OpenRouter `architecture.modality`.
[ADR 0035](0035-image-artifact-vision.md) vision needles,
JPEG wire, and the modality-error retry stay unchanged on
day-1 of this amend. The badge is Settings chrome, not a
new gate.

#### Host API (this amend)

- Owner-session `GET` catalog for a Provider id → proxied
  OpenRouter `GET /api/v1/models` plus the ~24h cache.
- Policy write / clear already exist. A pin clear restores
  meta free / auto.

Do not invent other catalog routes in this record. Do not
put the Provider key in the catalog response.

### Settings information architecture (amend)

Nick locked this on 2026-09-25 (grill Q13–Q17, «рекомендуемые»).
Same record as the catalog / shelf. It does not mint ADR 0037.
Catalog fetch, cache, shelf pins, Advanced, vision badge, and
`kind=openrouter` only stay as written above.

#### Shell

Settings is **multi-page** Host routes under `/settings/...`
with a **left nav**, not one monolithic page. Pages are
deep-linkable.

Day-1 carve-out (two pages only):

| Page | What it holds |
| --- | --- |
| **Провайдеры** | Providers page: story, configure, shelf, Advanced, health |
| **Прочее** | Leftover existing Settings (Cluster timezone, Cluster http allowlist, and anything else already on `/settings`) without a full redesign of every section |

A broader Settings redesign is later. `/settings` may land on
**Провайдеры**. Exact child slugs are the impl PR. Do not add
more Settings tabs on day-1 of this amend.

The Owner page gate stays
[ADR 0010](0010-owner-auth-session.md) /
[ADR 0012](0012-household-members.md). It must cover `/settings`
and `/settings/...`. A Member still cannot open Settings.
Today’s exact-path set that only lists `/settings` is not
enough once child routes exist.

#### Providers page

The Owner must see how the platform works: **Bots need an LLM
to think; Providers supply that.** Key in → green status
without touching the tier grid. Advanced / «Подробнее» stays
for pins and the full catalog.

Prefer a **two-column** layout, or an equivalent clear split:

| Side | Content |
| --- | --- |
| One | Bots / Model tiers that depend on Providers (the dependency) |
| Other | Pick and configure a Provider, the quality shelf, and health |

This is a mental model, not a screenshot. Do not invent extra
Host APIs for the left column beyond the Store data the Host
already has (Bots, tier → Provider + Policy).

#### Health / confidence

Green “works as intended” when **at least one** Provider key
is accepted **and** a **soft probe** succeeds. The soft probe
is the catalog load (`GET /models` or the same Host catalog
endpoint). It is not a second Chat-path ping and not a Chat
gate.

Show routing mode: OpenRouter meta free / auto versus pinned.
Copy like «Ключ принят · каталог загружен · маршрутизация: …».

If the probe fails, Settings shows a banner or a **degraded**
status only. The Cluster **still runs** on meta free / auto.
That is the same rule as catalog fail: not a Chat blocker.

#### Settings impl notes

The impl PR filled in what this record left open.

- Slugs: `/settings` lands on `/settings/providers`
  (**Провайдеры**). **Прочее** is `/settings/other`.
- Catalog route: `GET /api/settings/llm-gateway/providers/:id/catalog`
  (Owner session). `?refresh=1` bypasses the cache. An upstream
  miss after a good load serves that list as stale.
- Key accepted: OpenRouter `GET /models` answers without a valid
  key, so the same catalog request also calls OpenRouter
  `GET /key` with the stored key (LLM-path fetch). HTTP 401 / 403
  there is “key not accepted”. Any other miss is “not checked”
  (degraded, not red).
- Shelf candidates: `tools` in `supported_parameters` (Chat runs
  the tool loop), text output, not an `openrouter/` router, not a
  `~` alias, not a `:batch` variant, no `expiration_date`.
- Free: best Artificial Analysis Intelligence Index among free
  candidates. Smart: best Intelligence Index, and Coding: best
  Coding Index, among paid candidates at or below the catalog’s
  75th-percentile blended price (3 prompt : 1 completion). The
  shelf shows the top pick plus two runner-ups. With no indexes in
  the payload, the shelf ranks the newest models instead.
- Advanced lists every text-output model. A model without `tools`
  cannot be pinned.

### Legacy compat

Live Clusters today store one LLM gateway row: base URL, key,
default Model tier, and optional **per-tier raw model strings**
(`llm_gateway.modelOverrides`, env `LLM_MODEL` /
`LLM_MODEL_*`). Settings treats “tier = raw model string”.

The impl PR **must** read that shape so a live Cluster does not
brick:

- Treat the existing row as **one** Provider instance. Infer
  `kind`: `openrouter` when the base is OpenRouter (including
  the [ADR 0004](0004-llm-gateway-tiers.md) default
  `https://openrouter.ai/api/v1` when a key is set and no base
  is stored); otherwise `openai-compatible` (or `openai` when
  the base is the official OpenAI URL).
- Treat each stored / env model string as a **pinned-model
  Policy** on that single Provider for that tier.
- An empty override keeps today’s
  [ADR 0004](0004-llm-gateway-tiers.md) default id until the
  Owner adds a Provider through the new Settings and casual
  auto-fill runs. Auto-fill does not wipe a non-empty pin.
- Env override / bootstrap
  (`OPENAI_COMPATIBLE_BASE_URL`, `LLM_API_KEY` /
  `OPENROUTER_API_KEY`, `LLM_MODEL` / `LLM_MODEL_*`) stays the
  [ADR 0004](0004-llm-gateway-tiers.md) bootstrap path until
  the impl migrates it onto the same Provider + pin read.

Write path after the impl: persist Provider instances and
tier → Provider + Policy. The compat read remains for Stores
that have not been saved through the new Settings.

### Vision

[ADR 0035](0035-image-artifact-vision.md) is orthogonal. The
vision needles gate, JPEG wire, and modality-error retry still
run on the **resolved** model id of the current attempt. An
escalate to a later tier re-runs that gate on the new id.

## Context

Today Cluster Model tiers are often all `openrouter/free`
strings. Baking concrete model ids in Host source is wrong
(catalog churn). The Owner wants casual multi-provider: connect
keys, map weak vs strong situations, and always pursue a usable
result — without picking OpenRouter slugs by hand.

[ADR 0004](0004-llm-gateway-tiers.md) already named the tiers
and the OpenAI-compatible `POST {base}/chat/completions` client,
plus one same-model retry for transient network / 429 / 5xx. It
also said free / random roulette is toy only. That last sentence
blocked casual OpenRouter Policy `free` on `cheap`. This record
keeps the client and the same-model retry, and takes bind /
resolve / escalate.

[ADR 0029](0029-turn-journal.md) already stores `modelId` (id
**sent** after resolve), `servedModelId` (last non-empty
`response.model`), tokens, and `llmCallCount`. Escalate stays
out of Chat and uses those aggregates. A free-roulette served id
must not be written onto `modelId`.

[ADR 0035](0035-image-artifact-vision.md) vision needles are a
capability gate on the resolved id, not a product catalog.

The grill on 2026-09-25 settled Provider instances (three kinds),
tier → Provider + Policy, OpenRouter casual `free` / `auto` meta
Policies, one-Provider auto-fill, situation start (Chat →
`strong`, Wake → `cheap`), escalate `cheap` → `strong` → `code`
with max 3 attempts, soft + hard triggers without a quality
judge, silent Chat, journal aggregates, and a compat read of
legacy “tier = raw model string” as a pin on one Provider.

A later grill the same day (rounds 1–3) found the four-tier
Settings face too hard after that Port. Casual is key → works
via meta free / auto. Live catalog + quality shelf + Advanced
pin are Settings on top of the same bind. They are not a new
ADR and not a change to escalate.

Q13–Q17 the same day locked Settings **information
architecture**: `/settings/...` with a left nav, **Провайдеры**
as the clear page, leftover settings under **Прочее**, a
two-column Providers story (Bots need an LLM; Providers
supply it), and a green health status from key + soft catalog
probe. The probe is Settings chrome. It does not block Chat.

Competitor notes (botato, OpenMausBot, rakazo; 2026-09-25)
confirmed all three are **Owner-selected single model (or
Provider + model) per bot / thread / space**. None implement
named Cluster Model tiers, automatic complexity routing, or
`openrouter/free` as a product Policy. OpenRouter appears as one
provider among many. Closest “free” mentions are botato Ollama
(local), OpenMausBot OpenCode legacy `*-free` slug remap, and
OpenMausBot `/key` `is_free_tier` (auth verdict only). This
record does **not** copy “one model per Bot only”, OpenMausBot
CLI engine sprawl, or a silent complexity classifier. Optional
later steal: OpenMausBot `allow_fallbacks: false` on a **pinned**
concrete id.

## Consequences

- The first impl PR added Provider instances, tier →
  Provider + Policy bind, casual auto-fill, situation start,
  escalate, and the legacy compat read. This amend does not
  change that code.
- A later Host impl PR adds the Owner-session catalog proxy
  (~24h cache + Refresh), the OpenRouter quality shelf, the
  Advanced pin UI, multi-page Settings (`/settings/...` with
  **Провайдеры** / **Прочее**), and Settings health chrome.
  This record does not.
- [ADR 0004](0004-llm-gateway-tiers.md) still owns the
  OpenAI-compatible request shape, key masking, quiet / stub
  path when no key, Russian error copy, and one same-model
  transient retry. It no longer owns how a tier becomes a model
  id, and it no longer forbids OpenRouter Policy `free` on
  `cheap` for casual.
- [ADR 0029](0029-turn-journal.md) still owns Turn fields.
  Escalate re-patches last successful (or last attempted)
  resolve and increments `llmCallCount`. Day-1 does not add
  per-attempt rows.
- [ADR 0035](0035-image-artifact-vision.md) still owns vision
  parts, needles, and the modality-error retry on the current
  attempt’s resolved id. The Settings vision badge is chrome
  on the live catalog. It does not replace those needles.
- [ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)
  still owns which proxy env the LLM client uses. Each Provider
  call is still an LLM-path fetch. The catalog `GET` is an
  LLM-path fetch too (stored Provider key, same proxy).
- Glossary terms **Provider** and **Policy** stay in
  [`CONTEXT.md`](../../CONTEXT.md). **LLM gateway** stays the
  Cluster capability. Do not rename the gateway per Provider.
  Shelf labels Free / Smart / Coding are not Model tier names.
- Settings casual face is OpenRouter key → meta routing on
  the **Провайдеры** page. The four-tier bind stays in the
  Store and under Advanced. Leftover Cluster settings sit on
  **Прочее**. The Bot closet stays without a model field.
- Settings health is Owner chrome (key accepted + soft
  catalog probe + routing mode). A failed probe is a banner
  or degraded status. It does not gate Chat.
- No model-id allowlist is baked in Host source as the product
  catalog. The shelf is ranked from the live API.
- Exact OpenRouter meta slugs are verified at impl time.

### Out of scope

- Host or Store implementation for this amend. That is the
  Settings / catalog impl PR.
- A full redesign of every Settings section (timezone,
  allowlist, and the rest stay under **Прочее** on day-1)
- Extra Settings tabs beyond **Провайдеры** and **Прочее**
- Soft probe as a Chat blocker
- OpenAI / `openai-compatible` live catalogs (later, same
  Host proxy + cache pattern)
- A baked model-id shortlist in Dostigus source
- Bot override of Provider / Model tier / model
- Host refresh + pick “best free slug” every resolve (the
  shelf ranks when the Owner picks; resolve still uses the
  bound Policy)
- Turning escalate into a quality judge
- Silent message-complexity classifier
- Owner-visible escalate badge in Chat
- Effectiveness / eval scores UI
- Per-call attempt rows beyond existing Turn aggregates
- Dropping Cluster Model tiers for “one model per Bot”
- Treating `modelId` as `response.model` under meta free
- Marketplace, Share link, guests, agent runtime, Meal port,
  Builder Module-package writer

## Alternatives

- Amend [ADR 0004](0004-llm-gateway-tiers.md) only, with no new
  record — rejected. 0004 stays historical for the client, tier
  names, and same-model retry. Bind / resolve / escalate need
  their own record.
- Bake a Host model-id catalog (or keep `openrouter/free` on
  every tier by hand) — rejected. Catalog churn. Owner connects
  Providers and Policies.
- Drop Cluster Model tiers and copy competitor “one model per
  Bot / thread” — rejected. Tiers are the Host differentiator
  for Chat vs Wake vs escalate. Competitors simply do not have
  them.
- Free / random roulette stays toy only
  ([ADR 0004](0004-llm-gateway-tiers.md)) — rejected for casual
  OpenRouter. Policy `free` is allowed on `cheap` and `toy`.
  Host-picked “best free slug” every call stays later.
- Start `code` from a Skill or a “this looks like code”
  classifier — rejected for day-1. `code` is escalate only.
- Wake starts on `strong` — rejected. Wake / Schedule starts
  `cheap`.
- Escalate on thumbs or an LLM-as-judge quality score —
  rejected. Soft + hard failure only.
- Show an escalate badge in Chat on day-1 — rejected. Silent.
  Journal / MCP is the ops surface.
- Per-attempt Turn rows on day-1 — rejected. Last successful
  (or last attempted) resolve + `llmCallCount`.
- Bot closet or Manifest `modelTier` as the day-1 start picker
  — rejected. Situation table. Bot override is later.
- Live catalog + Advanced pin on the first day-1 — rejected
  **then** so casual OpenRouter could ship on meta Policies.
  This amend **supersedes** “pin is later” for OpenRouter
  Settings. Meta still covers casual without the catalog.
  OpenAI / `openai-compatible` lists stay later.
- Four identical tier pickers in the OpenRouter face —
  rejected after the Providers Port. Key first. Shelf +
  Advanced. The Store still binds each Model tier.
- Mint ADR 0037 for Settings / catalog — rejected. Same
  record. Bind, resolve, escalate, Settings catalog, and
  Settings information architecture are one decision.
- Keep one monolithic `/settings` page — rejected. Multi-page
  `/settings/...` with a left nav. Deep-linkable.
- Redesign timezone, http allowlist, and every other Settings
  block on day-1 — rejected. Carve out **Провайдеры**; leftovers
  under **Прочее**.
- Soft catalog probe blocks Chat — rejected. Banner /
  degraded status only. Same as catalog fail.
- Rank a Host-baked shortlist — rejected. Live API only.
  No model ids in git.
- Catalog fail blocks Chat — rejected. Banner in Settings.
  Cluster stays on meta free / auto.
- Copy OpenMausBot many CLI engines into Cluster Settings —
  rejected. Gateway stays OpenAI-compatible kinds above.
- Copy OpenMausBot `allow_fallbacks: false` onto meta free /
  meta auto — rejected for day-1. Optional later, on a pinned
  concrete id only.
