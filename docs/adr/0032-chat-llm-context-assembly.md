# ADR 0032: Chat LLM context assembly

- Status: accepted
- Date: 2026-09-24
- Amended: 2026-09-24 — Chat slim and Wake gain `dostigus_artifacts_put`.
  There is no `dostigus_artifacts_get`. Current-turn Artifact text /
  meta inject is [ADR 0034](0034-artifacts.md).
- Amended: 2026-09-25 — The triggering user message may use OpenAI
  content **parts** (text + `image_url`) per
  [ADR 0035](0035-image-artifact-vision.md). History lines stay
  string `content` plus the [ADR 0034](0034-artifacts.md) meta note.
  Slim tools stay unchanged. There is still no
  `dostigus_artifacts_get`.
- Amended: 2026-09-26 — Stored Wake content is the Schedule display
  name. The firing turn sends `wakeText` as the triggering system
  line ([ADR 0027](0027-bot-schedules.md)).

The tool loop stays [ADR 0011](0011-chat-mcp-tool-loop.md). Gateway
and Model tiers stay [ADR 0004](0004-llm-gateway-tiers.md). Schedules
and the Wake line stay [ADR 0027](0027-bot-schedules.md). Self-settings
write rules stay [ADR 0028](0028-bot-self-settings-via-chat.md). Meta
Skills stay [ADR 0030](0030-chat-cards-module-catalog.md). Host HTTP
get stays [ADR 0031](0031-host-http-get.md). Artifacts stay
[ADR 0034](0034-artifacts.md). Image Artifact vision stays
[ADR 0035](0035-image-artifact-vision.md). This record is how the
Host builds the LLM request on one Bot turn: system prompt, Skill
catalog, history window, and Chat tool allowlist.

This record is the decision. It does not change Host or Store code.
The impl PR lands after this docs PR merges.

## Decision

On each configured Bot turn the Host sends one OpenAI-compatible
`chat/completions` request. That request is **small by default**: a
short system prompt with a Skill **catalog**, a bounded history
window, and a slim Chat tool list. Full Skill bodies and Manifest
write tools are on demand, not always-on.

A live Bot that created a correct soft Schedule from natural language
still over-acted (`dostigus_bots_update` plus a long lecture). The
audit of that turn is the reason this record exists. Nick locked the
shape below on 2026-09-24.

### Skills: catalog and read

The system prompt lists each Skill as `id` plus **`description`**. It
does not inject `instructions`.

A Skill in the Store is `{ id, description, instructions }`. Skills
still live in `bots.skills_json`. No new table and no new column.
`id` and `instructions` stay [ADR 0028](0028-bot-self-settings-via-chat.md):
`parseSkillId` (1–64, letters, digits, `_`, or `-`) and
`parseSkillInstructions` (1–4,000). **`description` is required on
upsert.** The impl PR adds `parseSkillDescription`: 1–200 characters
after trim (`SKILL_DESCRIPTION_MAX = 200`), same error class as the
other Skill parsers.

| Tool | Returns / writes |
| --- | --- |
| `dostigus_skills_list` | `{ id, description }[]` only. Breaking vs today's full `instructions`. |
| `dostigus_skills_read` | one Skill by id: `{ id, description, instructions }` |
| `dostigus_skills_upsert` | requires `id`, `description`, and `instructions` |
| `dostigus_skills_delete` | unchanged |

`dostigus_skills_read` is a new Chat and `/mcp` tool. It is the only
tool that returns `instructions`. The Host does not always-inject
Skill bodies on a user turn or a Wake.

A legacy Skill with no `description` still lists. The catalog line is
`Skill {id}` until the creator or the Owner upserts. Lazy repair is
acceptable. The impl PR does not need a SQL migration for this JSON
field.

Meta platform Skills
(`platform-meta-schedules`, `platform-meta-skills`,
`platform-meta-self-settings`, `platform-meta-marketplace`,
`platform-meta-http-get`) stay as Skills on the Bot. They are
**catalog + read**, not always injected. The seed supplies a good
`description` for each. Long how-to stays in those bodies.

Short always-on **Host rules** stay Host rules, not Skills:

- `CHAT_SELF_SETTINGS_RULE` ([ADR 0028](0028-bot-self-settings-via-chat.md))
- `CHAT_NO_PACKAGE_RULE` ([ADR 0030](0030-chat-cards-module-catalog.md))
- a one-line Host HTTP get hint if the slim tool list needs it
  (`dostigus_http_get`; `truncated` means incomplete). Long how-to
  stays in `platform-meta-http-get`.

### History window

Each turn sends the **last 40** stored messages (`role` + `content`).
There is no summary and no compaction in this record.

History lines stay **string** `content`. When a historical line
joins Artifacts, the Host may append the short Artifact meta note
(name, mime, size, id) from
[ADR 0034](0034-artifacts.md). History does **not** grow
`image_url` parts.

The **triggering user message** may use OpenAI content **parts**
(`text` + `image_url`) when that line has image Artifacts
([ADR 0035](0035-image-artifact-vision.md)). A Wake line stays
string `content`.

Always include the current triggering user line or Wake line when that
line would otherwise fall outside the window.

Stored `system` messages (Wake text, Skill and self-settings notices)
are sent to the LLM as **`role: system`**. They are not remapped to
`user`.

Chat Cards, other `parts`, and prior-turn `tool_calls` / tool results
stay **out** of LLM history. Skill and self-settings outcomes stay
the system notices
([ADR 0030](0030-chat-cards-module-catalog.md)). The in-loop tool
round still sees that turn's tool results
([ADR 0011](0011-chat-mcp-tool-loop.md)).

### System prompt

The Manifest line includes **name, label, description, modelTier,
skillIds, modulePackageIds**. Label and description were missing.

Drop the always-on «You are new. Ask and learn what this Bot is
for.». Replace it with stay-on-Manifest / reply-briefly style. The
existing closing «Reply briefly and stay in character.» stays.

The Skill section is the catalog (`id` + `description`), not full
bodies.

### Chat tool surfaces

`/mcp` Bearer auth is unchanged
([ADR 0009](0009-mcp-toolkit-endpoint.md)). Slim and expand are the
**Chat** allowlist. Kitchen tools and Turn journal tools stay on
`/mcp` and stay off Chat
([ADR 0026](0026-kitchen-module-day-1.md),
[ADR 0029](0029-turn-journal.md)).

#### Owner / Creator-Member slim baseline

Before expand, Owner Chat and a creator-Member Chat receive:

- `dostigus_messages_list`, `dostigus_messages_create`
- all six `dostigus_schedules_*` (list, create, update, pause,
  resume, delete)
- `dostigus_cluster_timezone_get`
- `dostigus_http_get`
- `dostigus_artifacts_put`
- `dostigus_skills_list`, `dostigus_skills_read`

#### Outside slim until expand

- `dostigus_bots_list`, `dostigus_bots_get`, `dostigus_bots_create`,
  `dostigus_bots_update`
- `dostigus_skills_upsert`, `dostigus_skills_delete`
- `dostigus_cluster_timezone_set`
- `dostigus_cluster_http_allowlist_get`,
  `dostigus_cluster_http_allowlist_set`

#### Still never in Chat

Unchanged: `dostigus_bots_delete`, Kitchen tools, Turn journal tools.
There is no `dostigus_artifacts_get`
([ADR 0034](0034-artifacts.md),
[ADR 0035](0035-image-artifact-vision.md)).

#### Keyword expand (this turn only)

On a **user** message (bot-thread or room mention), the Host does a
case-insensitive **substring** match on that line's `content`. A hit
adds that actor's builder tools **for this turn only**. The next turn
starts slim again.

The match does **not** run on a Wake. It does not read earlier
history. It is not an LLM classifier.

Any hit expands the actor's full expand set. There is no per-category
tool subset on day-1 of this record. A miss means the person
rephrases or uses the Closet / Sheet.

| Category | Example substrings (EN / RU) |
| --- | --- |
| name | `name`, `rename`, `название`, `имя` |
| label | `label`, `метка` |
| description | `description`, `описание` |
| Skill | `skill`, `skills`, `навык` |
| allowlist | `allowlist` |
| Marketplace | `marketplace` |
| timezone | `timezone`, `таймзон` (prefix; `таймзона` matches) |
| self-settings | `self-settings`, `настрой бота`, `параметры` |

**Owner expand** adds the outside-slim set above
(`bots_list` / `get` / `create` / `update`, Skills upsert and delete,
timezone set, allowlist get and set).

**Creator-Member expand** adds `dostigus_bots_update`,
`dostigus_skills_upsert`, and `dostigus_skills_delete` only. Not
`bots_create`, not `bots_delete`, not timezone set, not allowlist.

**Grantee Member:** no expand to Manifest or Skill write.

#### Grantee Member

Slim like today's Member set, plus `dostigus_skills_list` and
`dostigus_skills_read`. Messages, that person's Schedule tools,
timezone get, Host HTTP get, and `dostigus_artifacts_put` stay. No
Manifest write. No Skill upsert or delete.

#### Room mention

A room mention uses the same slim + expand as that person's user
turn. Wake is the exception.

### Wake

A Wake uses the **same Skill catalog** in the system prompt and has
`dostigus_skills_read` (and `dostigus_skills_list`). That fixes the
current bug where a Wake omits `skills` entirely.

Wake tools are **narrower than user slim**:

- `dostigus_http_get`
- `dostigus_artifacts_put`
- `dostigus_skills_list`, `dostigus_skills_read`
- `dostigus_schedules_list`
- `dostigus_messages_list`, `dostigus_messages_create`
- `dostigus_cluster_timezone_get`

No Schedule create, update, pause, resume, or delete on a Wake. No
`dostigus_bots_*`. No keyword expand to builder tools.

The stored Wake line is the Schedule display name
([ADR 0027](0027-bot-schedules.md)). It is `system`. Later history
sends that stored name as `role: system`. On the firing turn the
Host sends `wakeText` as the triggering system content. The
transcript does not store `wakeText`.

### Live Bots and lazy backfill

Documented here. Code is the impl PR.

- Seed or lazy-fill `description` on `platform-meta-*`.
- Insert-if-missing `platform-meta-http-get` (same rule as
  [ADR 0030](0030-chat-cards-module-catalog.md)).
- User Skills without `description` use the catalog fallback
  `Skill {id}` until upsert.

## Context

Today each user turn injects full Skill bodies (meta Skills alone are
about 3.3k characters), sends unbounded thread history, remaps stored
`system` lines to `user`, and offers about twenty Owner Chat tools
including Manifest write. A Wake reuses the turn pipeline but omits
`skills`. The Bot «Дождевик» wrote a correct Schedule and then called
`dostigus_bots_update` and lectured.

Lighter competitors: rakazo (Skill catalog + read), OpenMausBot
(history compaction), Grok (read-on-demand). This record takes
catalog + read and a hard window. It does not take compaction or an
LLM classifier on day-1.

The grill on 2026-09-24 locked catalog + `dostigus_skills_read`,
window 40, `role: system` for stored system lines, slim Chat tools,
keyword expand on the user line only, a narrower Wake, and lazy
description backfill. Schedule soft-prompt weather stays the design
already locked in [ADR 0031](0031-host-http-get.md) and
[ADR 0030](0030-chat-cards-module-catalog.md).

## Consequences

- The impl PR changes Skill shape, `dostigus_skills_list`, adds
  `dostigus_skills_read`, assembles the catalog, windows history,
  keeps `system` as `system`, slims Chat tools, and adds keyword
  expand. This record does not.
- `/mcp` `dostigus_skills_list` is the same breaking shape
  (`{ id, description }[]`). `/mcp` still lists upsert, delete, Bots,
  Kitchen, and Turn journal. Chat does not gain those last three
  families.
- Owner Chat and creator-Member Chat start slim. Manifest write,
  Skill write, timezone set, and allowlist tools wait for expand.
- A grantee can list and read Skills and cannot write them.
- A Wake can read Skills and cannot write Schedules or the Manifest.
- Always-on Host rules stay short. Meta Skill how-to is on-demand.
- A legacy Skill without `description` is visible in the catalog as
  `Skill {id}`.
- Chat Cards and prior-turn tool transcripts stay out of the LLM
  history window.
- The triggering user message may use OpenAI content parts when
  that line has image Artifacts
  ([ADR 0035](0035-image-artifact-vision.md)). History lines stay
  string plus the Artifact meta note. There is still no
  `dostigus_artifacts_get`.

### Out of scope

- History summary or compaction beyond the window of 40.
- Persisting tool transcripts into Store history.
- An LLM classifier for expand.
- Changing Schedule soft-prompt weather design
  ([ADR 0031](0031-host-http-get.md),
  [ADR 0030](0030-chat-cards-module-catalog.md)).
- Implementation of the parsers, tools, allowlists, and lazy
  backfill. Those are the impl PR.

## Alternatives

- Always inject full Skill bodies — rejected. Meta how-to plus
  domain Skills overflow the turn and invite lectures.
- Keep Manifest write tools on every Owner turn — rejected. The
  live Bot over-acted. Slim first; expand on a keyword hit.
- LLM classifier for expand — rejected for day-1. Host substring
  match. A miss is a rephrase or the Closet / Sheet.
- Per-category expand tool subsets — rejected for day-1. Any hit
  adds that actor's builder set for the turn.
- History compaction or a running summary — rejected for day-1.
  Last 40 plus the triggering line.
- Remap stored `system` lines to `user` — rejected. Wake and
  notices stay `role: system`.
- Same Chat tools on Wake as on a user slim turn — rejected. Wake
  is read-mostly: no Schedule writes, no `bots_*`, no expand.
- Omit Skills from Wake (today's bug) — rejected. Catalog +
  `dostigus_skills_read` match the user turn.
- Put meta how-to in always-on Host rules — rejected. Host rules
  stay short. Long how-to stays in meta Skill bodies for read.
- Drop meta Skills from the Bot — rejected. They stay Skills,
  catalog + read.
- Require a SQL migration for `description` — rejected. The field
  lives on the existing `bots.skills_json` object. Lazy fallback
  covers legacy rows.
- Persist tool_calls and tool results into Store history — rejected
  for day-1. Notices cover Skill and self-settings outcomes.
- Keep «You are new. Ask and learn…» — rejected. Stay on the
  Manifest and reply briefly.
- A description longer than 200 characters — rejected. Catalog
  lines stay short. Full text is `instructions` via
  `dostigus_skills_read`.
