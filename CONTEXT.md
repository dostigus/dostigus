# Dostigus — Domain Context

Self-host agent OS: portable bot packages + host UI sheets. This file
names the domain concepts. Keep these terms stable. Do not invent synonyms in
code, docs, or UI copy. Host chrome may be `en` or `ru`
([ADR 0037](docs/adr/0037-host-ui-i18n.md)); the terms below stay
Latin script in both Locales.

> Scope lives in [`docs/SPEC.md`](docs/SPEC.md). Decisions live in
> [`docs/adr/`](docs/adr/). Agent rules: [`AGENTS.md`](AGENTS.md).

## Language

**Dostigus**:
The self-host agent OS (Platform + Cluster runtime).
_Avoid_: product (unqualified), app (the Host is the client app).

**Platform**:
The open-source monorepo (`dostigus/dostigus`): Host, Kit, runtimes. Evolves
via git. The Platform is not a Cluster.
_Avoid_: repo (unqualified), codebase (when you mean this monorepo).

**Cluster**:
One user’s (or Household’s) running instance: Store, Bots, Module packages,
data. Not a git repo.
_Avoid_: tenant, workspace, site, instance (unqualified).

**Owner**:
Primary account that controls the Cluster. Exactly one Owner per Cluster.
_Avoid_: admin, user (unqualified).

**Member**:
A Household account on this Cluster, under the single Owner. Signs in on the
Host for Bot list and Chat. **Member.locale** is this Member's Host UI
Locale ([ADR 0037](docs/adr/0037-host-ui-i18n.md)).
_Avoid_: user, guest, account (unqualified), invitee.

**Member.locale**:
Store column on the Member row for Host UI Locale
(`en` | `ru` on day-1). Signed-out Host uses cookie
`dostigus_locale`. On first login that cookie may seed this
column when it is still null. Existing null migrates to `en`.
Not Cluster timezone. Not a Skill field.
_Avoid_: Accept-Language as the Store value, URL prefix,
treating Settings as a Member-visible switcher.

**Host**:
The single client app (web/PWA first): Chat + Cards + Sheets. **Host shell**
is a synonym — prefer Host.
_Avoid_: Host shell (prefer Host), mini-app, dashboard, admin (unqualified),
per-bot SPA.

**Settings**:
Owner Host pages under `/settings` and `/settings/...`. Own
chrome: left Settings nav + scrolling content, no Host Bot
list ([ADR 0038](docs/adr/0038-settings-chrome.md)). Day-1 of
the [ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)
Settings amend: **Провайдеры** (Providers page — catalog, shelf,
health) and **Прочее** (leftover Cluster settings, and the Host
Locale switcher
([ADR 0037](docs/adr/0037-host-ui-i18n.md))). Not the Bot
closet. Not Member-visible.
_Avoid_: admin panel, dashboard, Preferences (unqualified), treating
Settings as one monolithic page after this amend.

**Locale**:
Host UI language for chrome strings. Day-1 codes `en` and `ru`.
Default `en`. URLs have no `/en` or `/ru` prefix. Not Cluster
timezone. Not the language of Chat bodies, Skills, MCP tool
descriptions, or LLM replies. Product glossary terms in this
file stay Latin script in every Locale; translate only the
surrounding chrome words. See
[ADR 0037](docs/adr/0037-host-ui-i18n.md).
_Avoid_: language (unqualified), i18n (as a product noun),
treating timezone as Locale, translating Bot / Host / Cluster /
Skill / Schedule / Provider / Policy / Artifact / Member /
Household.

**Chat**:
The lines a person reads and writes on a Thread in the Host.
**Chat LLM context** is the system prompt, Skill catalog, history
window, and Chat tool allowlist the Host sends on one Bot turn
([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). The
triggering user message may use OpenAI content parts when that
line has image Artifacts
([ADR 0035](docs/adr/0035-image-artifact-vision.md)).
_Avoid_: messenger, inbox (unqualified), context window
(unqualified), prompt dump.

**Wake**:
A visible system Chat line the Host writes on a bot-thread when a
Schedule fires. The line carries the wake text the Bot supplied. The
Host then runs a Bot turn. The Skill catalog matches a user turn.
Wake tools are narrower than user slim, and there is no keyword
expand ([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). The
line is stored as `system` and sent to the LLM as `role: system`.
Not an Activity row.
_Avoid_: notification, push, ping, user line.

**Activity**:
Ephemeral Chat status for an in-flight Bot reply on a Thread. One row
in the thread: a glyph and a short line. Not a Chat line. Not stored.
_Avoid_: typing indicator (unqualified), presence, spinner.

**Activity phase**:
Which Activity that row shows while the reply is in flight: `thinking`,
`tool`, or `typing`. `connect` is a local preview row only.
_Avoid_: tool name, status string, Store row.

**Turn**:
One Host Bot Chat turn: one Bot LLM tool loop, the same span as one
Activity session. Trigger is `user`, `wake`, or `mention`. The row is
ops meta (outcome, phase times, tool names, modelId, modelTier,
visionParts, servedModelId, promptTokens, completionTokens,
totalTokens, llmCallCount). `modelId` is the id sent after resolve.
`servedModelId` is the last non-empty provider `response.model`.
Token fields are Turn aggregates. Escalate
([ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md))
is silent in Chat; the journal sees attempts via last successful
(or last attempted) resolve plus `llmCallCount`. It is not a Chat
line and not an Activity row.
_Avoid_: trace, span, log (unqualified), transcript.

**Turn journal**:
The Store table and MCP surface tools an ops agent uses to read Turns
on a live Host (`dostigus_turns_list`, `dostigus_turns_get`). Not an
Owner Sheet. Not part of the Chat LLM allowlist. Schedule detail may
list wake Turns for one `scheduleId`
([ADR 0027](docs/adr/0027-bot-schedules.md)). That is not a journal
browser. See [ADR 0029](docs/adr/0029-turn-journal.md).
_Avoid_: trace store, debug log, Activity poll.

**Thread**:
One conversation in the Cluster. It has participants and Chat lines.
Kinds are labels, not separate products: `dm` (person and person),
`group` (people), `bot` (one person and one Bot; a bot-thread), `room`
(people and at least one Bot). Each person who can open a Bot has their
own bot-thread with that Bot. A `room` is how a Bot joins a Thread with
more than one person. Personal use stays that bot-thread. There is no
private write on a shared chat timeline.
_Avoid_: channel, conversation (unqualified).

**Participant**:
A person or a Bot on a Thread. A person is the Owner or a Member.
_Avoid_: user, attendee.

**Card**:
Inline structured UI in the Chat (button, table, status). Day-1 renders
a button and a status as Kit parts on an assistant bubble
([ADR 0025](docs/adr/0025-chat-bubble-parts.md)). A **Chat Card** is the
Host-injected Card for a Schedule change
([ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)). A table and
other Card kinds stay later. An Artifact on a message is not a Card.
_Avoid_: widget, embed, attachment (unqualified; that word is the
Artifact join, not a Card).

**Chat Card**:
A Kit Card the Host injects in the thread after a successful Schedule
change. Stored as one assistant message part (`kind: card`) so reload
keeps it. Card kind is `schedule`. Not a system line and not a closet
control. Pause and Изменить open Sheet id `schedule`, the same detail
Sheet as the closet «Расписания» block
([ADR 0027](docs/adr/0027-bot-schedules.md)). Delete confirms in that
Sheet. The model does not emit the part. Day-1 does not inject a Card
after Apply, and does not inject a Card for a Skill upsert or delete,
a Bot self-settings update, or a bare list or get. Those Skill and
self-settings successes are a Host-written system Chat line (the Wake
family): plain string, no parts, no Изменить.
_Avoid_: widget, toast, system line, embed.

**Sheet**:
Modal/drawer app slice from the Kit, not a separate site.
_Avoid_: page, iframe, dialog (use Sheet; modal is a Sheet kind).

**Kit**:
Shared design system / building blocks the Host renders. Bots do not ship
custom CSS apps. Locale dictionaries the Host uses live with the Kit
([ADR 0037](docs/adr/0037-host-ui-i18n.md)).
_Avoid_: theme, CSS app, per-bot design system.

**Locale dictionary**:
Central nested JSON for Host chrome and Kit strings the Host
uses: `packages/ui-kit/locales/{en,ru}.json`. English is the
key and type source. A new language is copy `en.json` →
`xx.json` and translate. See
[ADR 0037](docs/adr/0037-host-ui-i18n.md).
_Avoid_: a second Host-only tree on day-1, one file per page,
translating Chat bodies or MCP tool descriptions here.

**Brand**:
The goose logo, the stickers, and the Bot marks shipped with the Kit. The
Host imports them from the Kit. A Bot avatar is a Bot mark — one bird of
the eight-bird flock drawn by `KitBotAvatar` — not a geometric blob.
_Avoid_: theme, mascot pack, logo set.

**Sticker**:
A goose illustration from the Brand, used in a Sheet, an empty state, or a
tutorial.
_Avoid_: emoji, icon (unqualified), meme.

**Sheet shell**:
The Kit frame that presents a Sheet (drawer or modal) on Reka UI and Host
tokens. Modal is a Sheet kind.
_Avoid_: dialog library, modal component.

**Bot**:
Long-lived persona in a Cluster (Skills, memory scope, MCP access). Talks to
the user. A Bot is **not** a Module package.
_Avoid_: app, assistant, Module package (a Bot binds packages; it is not one).

**Bot visibility**:
Who may see a Bot. A personal Bot plus explicit grants
([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md), amended
2026-09-24). A new Bot is personal to its creator. The creator can see
it. The Owner always can, including a Member-created Bot with no grant.
Anyone else needs a grant: one row, `bot_id` and `person_id`. "All
current Members" grants Members who can sign in now. A later Invite does not
receive those Bots. The Owner may grant or revoke on any Bot. The
creator may grant or revoke on their own Bot. A grantee cannot
re-share unless they are also the Owner or the creator. Revoke drops
list and open. That person's bot-thread rows
stay. The Host stores `bot_grants`. Migration `0013_bot_grants` copied
former `shared` Bots into one grant per Member row that existed then,
including a disabled Member, and dropped `visibility`. Module data
stays in the Cluster Store.
_Avoid_: public, secret, hidden.

**Orchestrator**:
Optional Bot that routes inbox ideas / digests (hybrid topology; not required
day-1).
_Avoid_: router, dispatcher (use Orchestrator).

**Builder**:
Cluster-side coding worker that emits a Module package. Distinct from any
Platform git agent.
_Avoid_: cloud agent (bare), codegen bot, authoring agent.

**Skill**:
Instructions a Bot follows. Not executable UI and not a
Module package. Not a Model-tier Policy
([ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)). A Skill id is letters, digits, `_`, or `-`. A dotted
id is not a Skill id. `parseSkillId` in
`packages/shared/src/skill.ts` checks that charset. A Skill is
`{ id, description, instructions }`. `description` is required on
upsert (1–200). There is no locale column (Host UI Locale is
[ADR 0037](docs/adr/0037-host-ui-i18n.md), not a Skill field). Skills live in
`bots.skills_json`. The Manifest lists that Bot's Skills. The system
prompt is a catalog of `id` + `description`. Full `instructions`
load through `dostigus_skills_read`. `dostigus_skills_list` returns
`{ id, description }[]` only
([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)).
Self-settings may list, read, upsert, and delete that text on the
Bot ([ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md)). On
Bot create the Host inserts a fixed set of meta Skills when each id is
missing (insert-if-missing, constructor how-to). That seed does not
call `upsertBotSkill`. Those instructions are Russian markdown in that
same string. Meta Skills stay catalog + read, not always injected.
The creator or the Owner may edit or delete them. An existing id is
not overwritten on boot. See
[ADR 0030](docs/adr/0030-chat-cards-module-catalog.md). A Skill does
not say when the Host wakes the Bot. A legacy Skill with no
`description` catalogs as `Skill {id}` until upsert.
_Avoid_: prompt (unqualified), tool, Module package, stock package.

**Schedule**:
A Cluster Store row on the Host that says when the Host wakes a Bot.
Not a Manifest field and not a Skill. A Skill says what; a Schedule
says when. Many Schedules may belong to one person and one Bot, on
that person's bot-thread (`botId`, `personId`). The Bot supplies the
cadence (`daily` or `weekly`), the local `HH:MM`, optional weekdays
when weekly, an optional display name, and the wake text. Empty name:
the Host list falls back to truncated wake text. The Host owns the
next fire instant. Closet Параметры shows a «Расписания» block for
this person's rows on this Bot
([ADR 0027](docs/adr/0027-bot-schedules.md)).
_Avoid_: cron, crontab, alarm, reminder, Skill, Manifest field,
Routines.

**Self-settings**:
A person's request in Chat that the Bot change its own name, label,
description, Skills, or Schedules. The Bot writes the Store through
the MCP surface. A reply that claims the change without a successful
tool result is not the write. The Host injects short always-on Host
rules on every Bot turn (`CHAT_SELF_SETTINGS_RULE`,
`CHAT_NO_PACKAGE_RULE`). Those rules are not Manifest fields and not
Skills. Full Skill bodies are not always injected. Manifest and
Skill write tools wait for keyword expand on that user turn
([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). The
creator and the Owner may change the name, label, description, and
Skills, including a Member who created the Bot. A grantee cannot.
Schedules follow
[ADR 0027](docs/adr/0027-bot-schedules.md). See
[ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md).
_Avoid_: prompt edit, config, profile.

**Manifest**:
Bot definition: persona, Skills, bound Module packages, Model tier,
avatar shape, avatar color (Bot accent palette), an optional label,
and an optional description. Chat Self-settings may change the name,
the label, and the description. Appearance and Model tier are not
Chat Self-settings
([ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md)).
_Avoid_: config, profile (unqualified).

**Module package**:
Versioned unit: schema/migration, MCP tools, Kit UI bindings, Skill diffs.
Lives in the Cluster Store. Not a Bot. This monorepo does not ship a
stock Module package.
_Avoid_: plugin, extension, addon, Bot.

**Module catalog**:
Not a day-1 artifact in this monorepo. There is no
`packages/modules/<id>/` seed and no Host-bundled Apply of platform
packages. A Marketplace of Module packages is a later cloud product.
See [ADR 0030](docs/adr/0030-chat-cards-module-catalog.md).
_Avoid_: stock seed, registry, plugin gallery, treating Marketplace as day-1.

**Kitchen Module**:
Day-1 Cluster domain: pantry items (name, optional qty), one recipe
(name and ingredients text), and a cooked log whose rows sum to an XP
counter. The Host opens it as a Sheet from a Chat button part. The
tables, MCP tools, and Sheet are the seed of a Module package. There is
no Apply runtime yet, so this seed is not an installed Module package.
[ADR 0030](docs/adr/0030-chat-cards-module-catalog.md) does not put
Kitchen in a catalog.
Not a Meal port.
_Avoid_: Meal, meal planner, Cook app, plugin.

**Store**:
Cluster database (SQLite day-1) holding domain data + Manifests + Module
packages.
_Avoid_: database (unqualified), repo.

**Artifact**:
A persisted Cluster file object: Store meta plus bytes on the Cluster
volume (`cluster-data` → `/var/lib/dostigus/artifacts/<uuid>`). An
**attachment** is that Artifact appearing on a Chat message (the join),
not a second Store type. UI may say «файл» or show a chip. Person
upload and Bot `dostigus_artifacts_put` both create Artifacts. There
is no `dostigus_artifacts_get`. Image Artifact vision on the
triggering line is
[ADR 0035](docs/adr/0035-image-artifact-vision.md). See
[ADR 0034](docs/adr/0034-artifacts.md).
_Avoid_: attachment (as a Store type), blob (unqualified), library
file, S3 object (day-1 is volume + Store).

**MCP surface**:
Tools a Bot calls to read/write the Store. The Host UI uses the same tools.
**MCP contract** is the interface definition of that surface — prefer MCP
surface as the runtime term.
_Avoid_: API, REST, RPC (unqualified). Prefer MCP surface over MCP contract.

**Job**:
Approved request to run a Builder for a missing module/feature.
_Avoid_: ticket, task (unqualified).

**Apply**:
Install a Module package into the live Cluster (after staging review).
Day-1 does not Apply a stock package from this repo and does not bundle
platform packages into the Host image. A Builder Job that Applies a
package, and a Marketplace of packages, stay later. See
[ADR 0030](docs/adr/0030-chat-cards-module-catalog.md).
_Avoid_: deploy, merge, ship (unqualified), Host-bundled Apply.

**LLM gateway**:
Cluster capability for LLM calls: OpenAI-compatible shape and
transient same-model retry
([ADR 0004](docs/adr/0004-llm-gateway-tiers.md)). Provider
instances, Model tier bind / resolve, escalate, and the
OpenRouter Settings catalog are
[ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md).
_Avoid_: renaming the gateway per Provider, model picker
(unqualified).

**Provider**:
An Owner-connected LLM gateway instance: kind (`openrouter` |
`openai` | `openai-compatible`), API key, optional base URL. Not
a frozen model list in Dostigus source. Several instances may
exist on one Cluster. After an OpenRouter key is saved, the
Host may proxy that instance’s live catalog for Settings
(`kind=openrouter` day-1 of the [ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)
Settings amend).
_Avoid_: vendor, engine, catalog (unqualified), treating a
Provider as the whole LLM gateway.

**Policy**:
How a Model tier resolves a model id on a Provider. OpenRouter
casual: `free` (meta free, intended `openrouter/free`) and `auto`
(meta auto, intended `openrouter/auto`). Direct OpenAI /
openai-compatible: one live-chosen model when that instance is
sole. A concrete catalog id pin is also a Policy. Day-1 of the
[ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)
Settings amend: OpenRouter shelf or Advanced may write that
pin. Clearing pins restores meta free / auto. OpenAI /
openai-compatible live lists stay later.
_Avoid_: router, slug (unqualified), Skill text (a Skill is
instructions, not this Policy).

**Cluster timezone**:
The one IANA timezone for the Cluster, stored as
`cluster_settings.timezone`. A Schedule keeps a local wall clock; the
Host converts that clock for the next fire. The default is the
`DOSTIGUS_TZ` env when set, otherwise `UTC`. The Owner sets it. A
Member may read it.
_Avoid_: user timezone, per-Bot timezone, Host UI Locale
([ADR 0037](docs/adr/0037-host-ui-i18n.md)), offset.

**Host HTTP get**:
The MCP surface tool `dostigus_http_get` the Host runs on a Bot turn
so the Bot can GET a public URL. GET only. Chat and Wake use the same
tool loop ([ADR 0011](docs/adr/0011-chat-mcp-tool-loop.md)). The Host
returns HTTP status and a body capped at 64 KiB (truncate, with
`truncated`). The GET uses Bot HTTP egress
(`DOSTIGUS_HTTP_PROXY`; empty = direct). LLM proxy is a separate
Cluster env ([ADR 0033](docs/adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md)).
Not a Module package and not a weather seed
([ADR 0031](docs/adr/0031-host-http-get.md),
[ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)).
_Avoid_: HTTP client (unqualified), fetch tool, weather tool, POST.

**Bot HTTP egress**:
Cluster capability for Host→internet tool traffic that is not the
LLM gateway. Day-1 env is `DOSTIGUS_HTTP_PROXY` (one URL for `http`
and `https` targets). Unset or empty is direct. Never falls back to
`HTTPS_PROXY`. Day-1 consumer is Host HTTP get. See
[ADR 0033](docs/adr/0033-cluster-outbound-llm-vs-bot-http-proxy.md).
_Avoid_: HTTP_PROXY (unqualified), LLM proxy, EnvHttpProxyAgent,
per-host NO_PROXY.

**Cluster http allowlist**:
The Owner-configured list of hostnames in Cluster Store settings
(`cluster_settings.http_allowlist`) that gates Host HTTP get
destinations. Empty means allow all public hosts. A non-empty list is
exact hostname match. The Host always blocks loopback, private, and
link-local destinations. The Owner gets and sets it through MCP
(`dostigus_cluster_http_allowlist_get`,
`dostigus_cluster_http_allowlist_set`) and Owner Settings. Members do
not set it. See [ADR 0031](docs/adr/0031-host-http-get.md).
_Avoid_: URL allowlist (unqualified), CORS, proxy list, per-Bot
allowlist.

**Model tier**:
`cheap` | `strong` | `code` (and `toy` for playground / explicit
only). Each tier binds to a Provider + Policy, not a baked id
([ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)).
Chat / `user` starts `strong`. Wake / Schedule starts `cheap`.
`code` is escalate only on day-1. `toy` is outside the escalate
chain. MCP Bots pin strong/mid. Settings shelf labels Free /
Smart / Coding are quality slots, not Model tier names.
_Avoid_: fast, smart, opus (aliases).

**Household**:
The Owner and the Members on one Cluster. One Cluster is one Household.
_Avoid_: team, org, family.

**Invite**:
A one-shot link the Owner creates so someone can become a Member. The Store
keeps a hash of the token, the reserved email, and an expiry. The raw token
is shown once, on the Invite URL the Owner copies. Accepting it creates a
Member. Not a Share link. An Invite does not grant Bots. A later Invite
does not receive grants made earlier.
_Avoid_: Share link, guest link, magic link (unqualified), invitee.

**Share link**:
Narrow public token to one object, not the whole Cluster.
_Avoid_: public share, invite (unqualified).

## Relationships

- Platform ≠ Cluster. Git is only for the Platform. A Cluster is not a git repo.
- A Cluster has one Owner, a Store, Bots, Module packages, and its Household.
  One Cluster is one Household.
- A Member signs in on the same Host. Bot visibility decides which Bots
  they see ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md),
  amended 2026-09-24). A Bot is personal to its creator;
  the Owner always sees the full list; other people need a grant. The
  creator and the Owner may edit the Manifest and delete the Bot. A
  grantee chats on their own bot-thread. Members and the LLM gateway
  stay with the Owner. Finding a Bot stays the picker. One bot-thread
  per person. The Host stores `bot_grants`. `dm`, `group`, and `room` are
  in the Host. A room does not grant access.
- The Owner adds a Member by hand, or creates an Invite for an email and
  copies the link. Accepting an Invite creates a Member and signs them in.
  Sending that link by SMTP is later. An Invite is not a Share link and
  does not grant Bots.
- The Owner or a Member creates a Bot from that list. The name starts as
  **New Bot**, with a random flock mark. The Bot is personal to
  its creator
  ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md)).
  What the Bot is for is a Chat line, not a Manifest field.
- A Host user message stores the Owner id or Member id, and the Host
  keeps that author's name on the line. Chat bubbles stay unlabeled.
  Turning off a Member's sign-in keeps the name and their Bots. The
  Owner still sees those Bots. Grant rows and bot-thread rows stay.
- Chat lines belong to a Thread. Each person who can open a Bot has
  their own bot-thread. A `room` is the Thread that includes a Bot and
  more than one person. `dm` and `group` are Threads among people. See
  [ADR 0024](docs/adr/0024-threads-and-bot-visibility.md).
- While a Bot reply is in flight, Chat may show Activity on that Thread.
  The Activity phase is ephemeral. The Owner and a Member see the same
  row. See
  [ADR 0021](docs/adr/0021-chat-activity-status.md) (amended 2026-09-24).
  The same phase set is copied onto the open Turn. The Activity poll
  does not read that Turn.
- A Host Bot Chat turn is a Turn in the Turn journal. A Wake sets
  `scheduleId`. A room line with no mention is not a Turn. Ops read
  the journal through the MCP surface. Chat does not receive those
  tools. See [ADR 0029](docs/adr/0029-turn-journal.md).
- When a Schedule is due, the Host writes a Wake on that person's
  bot-thread with that Bot, then runs the Bot turn. A room, a direct
  message, and a group do not get that fire. Closet Параметры lists
  this person's Schedules on this Bot. See
  [ADR 0027](docs/adr/0027-bot-schedules.md). That turn uses the same
  Skill catalog as a user turn and a narrower tool list. It does not
  expand to Manifest write
  ([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). It may
  call Host HTTP get. Destinations follow the Cluster http allowlist
  ([ADR 0031](docs/adr/0031-host-http-get.md)).
- When a person asks a Bot to change its name, label, description,
  Skills, or Schedules, that is Self-settings. The Bot calls MCP
  surface tools and does not claim success without a successful tool
  result. The creator and the Owner may change the Manifest fields and
  the Skills from Chat, including a Member who created the Bot. A
  grantee cannot. Schedule writes stay
  [ADR 0027](docs/adr/0027-bot-schedules.md). See
  [ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md).
  A missing capability uses Skills upsert, Schedule tools, and Bot
  self-settings already in Chat. Manifest and Skill write tools wait
  for keyword expand on that user turn
  ([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). On Bot
  create the Host inserts missing meta Skills that teach those tools
  (insert-if-missing). That seed does not call `upsertBotSkill`. They
  are plain Skills (catalog + read, not always injected). A successful Skill
  upsert or delete, and a successful `dostigus_bots_update` of name,
  label, or description, appends one system Chat line on that
  bot-thread (plain string, no parts, same family as a Wake). It is
  not a Chat Card. This monorepo does not ship a stock Module package
  ([ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)). A Bot that
  needs a public HTTP resource uses Host HTTP get
  ([ADR 0031](docs/adr/0031-host-http-get.md)). That is not a
  Weather seed.
- Module package data lives in the Cluster Store. Bot visibility does not
  give a Bot its own Store. A personal Bot uses the same MCP surface
  under that person's permissions.
- A Bot has a Manifest and bound Module packages. A Bot is not a Module package.
- The Kitchen Module is Cluster Store data, MCP tools, and a Kit Sheet.
  It is the seed of a Module package. It is not a Meal port and not a Bot.
- Builder writes Module packages via Job → Apply. Distinct from any Platform
  git agent. The chat Bot does not write Module packages. This monorepo
  ships no stock Module packages and no Weather seed. A Marketplace of
  packages is later. See
  [ADR 0030](docs/adr/0030-chat-cards-module-catalog.md).
- Host talks to Bots through the MCP surface and renders Cards and Sheets from
  the Kit. The Sheet shell and Brand stickers live in the Kit. An assistant
  Chat line keeps Markdown in `content`
  ([ADR 0022](docs/adr/0022-chat-assistant-markdown.md)) and may carry Kit
  parts: a button that opens a Sheet, a status
  ([ADR 0025](docs/adr/0025-chat-bubble-parts.md)), and a Chat Card the
  Host injects after a Schedule change
  ([ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)). User and
  system lines have no parts. A Chat line may join Artifacts
  ([ADR 0034](docs/adr/0034-artifacts.md)). Those refs are the join, not
  `parts_json`. Bot-threads, `dm`, `group`, and `room` are in the Host.
  Grant rows are in the Host
  ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md)).
- LLM gateway maps Model tiers through Provider + Policy for
  every Bot call. Escalate may upshift along `cheap` → `strong`
  → `code` ([ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)).
- Host chrome Locale is `en` or `ru` (default `en`). A Member
  stores it on `Member.locale`. Signed-out Host uses cookie
  `dostigus_locale`. The Owner changes it on Settings →
  **Прочее**. Dictionaries live at
  `packages/ui-kit/locales/{en,ru}.json`. Chat bodies, Skills,
  MCP tool descriptions, and LLM replies are not dictionaries.
  See [ADR 0037](docs/adr/0037-host-ui-i18n.md). Cluster
  timezone is a different setting.
- A Share link is a narrow public token to one object, not the Cluster.
  Share links and guests are later.
