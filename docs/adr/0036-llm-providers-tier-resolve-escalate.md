# ADR 0036: LLM Providers, tier resolve, and escalate

- Status: accepted
- Date: 2026-09-25

The OpenAI-compatible LLM gateway shape and transient *same-model*
retry stay [ADR 0004](0004-llm-gateway-tiers.md). Model tier *names*
stay `cheap` | `strong` | `code` | `toy`. This record owns how those
tiers are **bound and resolved**, and how the Host **escalates** after
a failed attempt.

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

This record is the decision. It does not change Host or Store code.
The impl PR lands after this docs PR merges.

Nick locked the shape below on 2026-09-25 (grill «рекомендуемые» +
«да погнали»).

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

A later Advanced pin of a concrete catalog id is a Policy kind
too. That pin is **not** day-1. When it exists, an optional steal
from OpenMausBot is `allow_fallbacks: false` on a pinned concrete
id. That steal is not required for meta free / meta auto.

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

Design for `GET /models` (or the Provider catalogue) with refresh
and cache. Day-1 **does not** require a live catalog for casual
OpenRouter resolve (meta Policies). Advanced **pin a specific
id** from the catalog is later.

### Settings UI (sketch)

Owner Settings, not the Bot closet (the closet already has no
model field; that stays
[ADR 0020](0020-bot-closet.md) /
[ADR 0028](0028-bot-self-settings-via-chat.md)).

Day-1 sketch:

1. **Providers** list — add / edit / remove instances (`kind`,
   key, optional `baseUrl`).
2. **Tiers** — each of `cheap` | `strong` | `code` | `toy` shows
   Provider + Policy. Casual auto-fill covers the empty case.

No Bot closet model field. No Advanced pin UI on day-1.

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

- The impl PR adds Provider instances, tier → Provider + Policy
  bind, casual auto-fill, situation start, escalate, and the
  legacy compat read. This record does not.
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
  attempt’s resolved id.
- [ADR 0033](0033-cluster-outbound-llm-vs-bot-http-proxy.md)
  still owns which proxy env the LLM client uses. Each Provider
  call is still an LLM-path fetch.
- Glossary terms **Provider** and **Policy** land in
  [`CONTEXT.md`](../../CONTEXT.md). **LLM gateway** stays the
  Cluster capability. Do not rename the gateway per Provider.
- Settings grows a Providers list and a tier bind. The Bot
  closet stays without a model field.
- No model-id allowlist is baked in Host source as the product
  catalog.
- Exact OpenRouter meta slugs are verified at impl time.

### Out of scope

- Host or Store implementation. That is the impl PR.
- Bot override of Provider / Model tier / model
- Advanced pin of a concrete catalog id in Settings
- Host refresh + pick “best free slug” every resolve (policy C)
- Silent message-complexity classifier
- Owner-visible escalate badge in Chat
- Effectiveness / eval scores UI
- Per-call attempt rows beyond existing Turn aggregates
- A baked model-id catalog in Dostigus source
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
- Live catalog + Advanced pin on day-1 — rejected. Meta
  Policies cover casual OpenRouter. Pin is later.
- Copy OpenMausBot many CLI engines into Cluster Settings —
  rejected. Gateway stays OpenAI-compatible kinds above.
- Copy OpenMausBot `allow_fallbacks: false` onto meta free /
  meta auto — rejected for day-1. Optional later, on a pinned
  concrete id only.
