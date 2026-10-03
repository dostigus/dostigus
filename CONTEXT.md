# Dostigus — Domain Context

Self-host agent OS: portable Packs + Host UI Sheets. This file
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
One user’s (or Collective’s) running instance: Store, Bots, Module packages,
data. Not a git repo.
_Avoid_: tenant, workspace, site, instance (unqualified).

**Owner**:
Primary account that controls the Cluster. Exactly one Owner per Cluster.
_Avoid_: Admin (a separate role), user (unqualified).

**Owner-operator**:
The type-1 primary audience: one person on a Cluster with
Bots. A Collective of N=1, not a different product. See
[ADR 0043](docs/adr/0043-target-personas.md).
_Avoid_: solo user (unqualified), treating Owner-operator as a
second Host or SKU.

**Admin**:
A Household Member with `members.role` `admin`
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
Not a second Owner; the Cluster keeps one Owner
([ADR 0010](docs/adr/0010-owner-auth-session.md)). An Admin may
create Bots, Apply a Pack, and grant any Bot. An Admin opens
Dashboard read, Providers / LLM, and Members invite/list. An
Admin does not destroy the Cluster, transfer Owner, wipe the
Store, or appoint other Admins. Only the Owner promotes or
demotes an Admin. Cluster settings and Settings stay Owner.
_Avoid_: Owner, superuser, moderator.

**Member**:
A Household account on this Cluster, under the single Owner. Signs in on the
Host for Bot list and Chat. The product role **Member** is
`members.role` `member`. An Admin is still a Member row
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
**Member.locale** is this Member's Host UI
Locale ([ADR 0037](docs/adr/0037-host-ui-i18n.md)).
A Member with role `member` is a secondary audience:
served (Bot list and Chat), not the roadmap lead
([ADR 0043](docs/adr/0043-target-personas.md)).
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
_Avoid_: Host shell (prefer Host), mini-app, admin (unqualified),
per-bot SPA. Dashboard is separate chrome (Owner, and an Admin on
some pages per
[ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)),
not a synonym for Host.

**Dashboard**:
Owner Host chrome under `/dashboard` and `/dashboard/...`. Own
layout: left grouped nav + scrolling content, no Host Bot list
([ADR 0038](docs/adr/0038-dashboard-chrome.md)). Day-1 pages:
Overview (`/dashboard`), Cluster settings (`/dashboard/cluster`),
Providers (`/dashboard/providers`), Members
(`/dashboard/members`), and Settings
(`/dashboard/settings`). There are no `/settings` or
`/members` page routes. Not visible to a Member with role
`member`. An Admin reads Overview and opens Providers and
Members, not Cluster settings or Settings
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
_Avoid_: admin panel, treating Dashboard as the Host messenger
shell, treating Settings as the whole chrome.

**Settings**:
The Owner account page at `/dashboard/settings` inside
Dashboard. The Host user-menu **Settings** item opens that
page. Cluster leftover (timezone, http allowlist, Locale
switcher) is **Cluster settings**, not this page. Cluster
settings are only about the Cluster itself. Future security
limits that apply to one Bot or one Pack go on the Bot
(Closet / Bot binding), not on Cluster settings. Do not add
a Cluster-level allowlist for a single Pack. Mailer mailbox
host is the Closet bind
([ADR 0048](docs/adr/0048-mailer-product.md)). Cluster http
allowlist stays Host HTTP get
([ADR 0031](docs/adr/0031-host-http-get.md)). Not the Bot
closet. Not Member-visible.
_Avoid_: admin panel, Preferences (unqualified), treating
Settings as a `/settings` chrome after
[ADR 0038](docs/adr/0038-dashboard-chrome.md), Cluster mail
allowlist, Cluster-level allowlists for one Pack.

**Locale**:
Host UI language for chrome strings. Day-1 codes `en` and `ru`.
Default `en`. Host URLs have no `/en` or `/ru` prefix
([ADR 0037](docs/adr/0037-host-ui-i18n.md)). The marketing
site (dostigus.ru) is a different surface: unprefixed paths
are RU, EN is `/en/...`
([ADR 0046](docs/adr/0046-site-i18n-url-prefix.md)). Not Cluster
timezone. Not the language of Chat bodies, Skills, MCP tool
descriptions, or LLM replies. Product glossary terms in this
file stay Latin script in every Locale; translate only the
surrounding chrome words. See
[ADR 0037](docs/adr/0037-host-ui-i18n.md).
_Avoid_: language (unqualified), i18n (as a product noun),
treating timezone as Locale, treating dostigus.ru `/en`
URLs as Host Locale, translating Bot / Pack / Host / Cluster /
Skill / Schedule / Provider / Policy / Artifact / Member /
Household / Case / Marketplace / Catalog Store /
Mailer Pack / Bot mail binding.

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
A visible system Chat line the Host writes when it starts a Bot
turn on its own. A personal Schedule fires a Wake on that
person's bot-thread; the line is the Schedule display name
([ADR 0027](docs/adr/0027-bot-schedules.md)). A Case follow-up
fires a Wake on the `group` or `room` Thread that carries the
Case; the line is the Case label (fallback Thread title, then
«Case») ([ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md)).
It is not the wake prompt. The Host sends `wakeText` to the LLM
on that turn only. The Host then runs a Bot turn. The Skill
catalog matches a user turn. Wake tools are narrower than user
slim, and there is no keyword expand
([ADR 0032](docs/adr/0032-chat-llm-context-assembly.md)). The stored
line is `system`. Later history sends that name as `role: system`.
Not an Activity row.
_Avoid_: notification, push, ping, user line, prompt dump.

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
A `group` or a `room` may carry a Case
([ADR 0041](docs/adr/0041-case-lite-on-thread.md)). A Case follow-up
Wake lands on that same Thread
([ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md)). A
`dm` and a bot-thread do not carry a Case.
Host chrome says chat / чат, not Thread
([ADR 0037](docs/adr/0037-host-ui-i18n.md)).
_Avoid_: channel, conversation (unqualified), Thread as a RU
UI loanword.

**Participant**:
A person or a Bot on a Thread. A person is the Owner or a Member.
_Avoid_: user, attendee.

**Case**:
A thin layer on one `group` or `room` Thread: status (`open` |
`done`), a free-string **label** (max 40), and a **next action**
(max 120). Optional one-shot **follow-up** (`followUpAt` in the
Cluster timezone, plus `followUpBotId` of a Bot Participant).
Not a ticket tracker. No assignee, due date, SLA, or priority.
No Case until the first write; an untouched Thread has
`case: null`. `done` does not archive the Thread; it clears
follow-up. Store columns live on `threads`. On-thread UI stays
[ADR 0041](docs/adr/0041-case-lite-on-thread.md). A Case inbox
is a filter chip on the messenger Threads list (open Cases the
signed-in person is on), not a second inbox or a `/cases` page.
Follow-up fires a Wake on that Thread
([ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md)).
On-thread fields are in this Host. Inbox filter and follow-up
are not.
_Avoid_: Ticket, Issue, Case-lite (as a UI noun; that is the
wedge name), treating a Case as a second Thread, treating Case
inbox as a separate product.

**Card**:
Inline structured UI in the Chat (button, table, status). Day-1 renders
a button and a status as Kit parts on an assistant bubble
([ADR 0025](docs/adr/0025-chat-bubble-parts.md)). A **Chat Card** is the
Host-injected Card for a Schedule change
([ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)). A table and
other Card kinds stay later. An Artifact on a message is not a Card.
The Kit page surface `KitPanel` (Dashboard sections on `--card`) is not
a Card; Cards render through `KitChatParts`.
_Avoid_: widget, embed, attachment (unqualified; that word is the
Artifact join, not a Card), `KitPanel` for Chat UI.

**Chat Card**:
A Card the Host injects in the thread after a successful Schedule
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
Modal/drawer app slice from the Kit, not a separate site. A Pack
may ship Sheet UI as HTML under `ui/<id>/`, opened in the Sheet
shell as a sandboxed iframe mini-app
([ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md)). That
iframe is a host for Pack HTML, not a synonym for Sheet.
_Avoid_: page, dialog (use Sheet; modal is a Sheet kind), treating
iframe as the Sheet, author Vue / Kit in a Pack.

**Kit**:
Shared design system / building blocks the Host renders. Bots do not ship
custom CSS apps. Locale dictionaries the Host uses live with the Kit
([ADR 0037](docs/adr/0037-host-ui-i18n.md)). Form and surface
primitives (`KitPanel`, `KitField`, `KitInput`, `KitTextarea`,
`KitSelect`, `KitToggle`, `KitChip`, `KitListRow`) are Kit parts Host
pages assemble from ([ADR 0013](docs/adr/0013-kit-reka-ui-and-brand.md)).
_Avoid_: theme, CSS app, per-bot design system.

**Locale dictionary**:
Central nested JSON for Host chrome and Kit strings the Host
uses: `packages/ui-kit/locales/{en,ru}.json`. Host
`apps/web/i18n/locales` is a symlink to that directory. English is the
key and type source. A new language is copy `en.json` →
`xx.json` and translate. See
[ADR 0037](docs/adr/0037-host-ui-i18n.md).
_Avoid_: a second Host-only tree on day-1, editing a copy under
`apps/web/i18n/locales`, one file per page, translating Chat
bodies or MCP tool descriptions here.

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
tokens. Modal is a Sheet kind. Pack HTML under `ui/<id>/` opens
here as a sandboxed iframe
([ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md)).
_Avoid_: dialog library, modal component.

**Bot**:
Runtime identity on a Cluster: id, display name, avatar /
appearance, Threads / Chat history, live memory, bound secrets /
API keys / MCP sessions, enabled Schedules, computer / sandbox
assignment. Talks to the user. A Bot is **not** a Pack and **not**
a Module package.
_Avoid_: app, assistant, Pack, Module package (a Bot may Apply a
Pack and bind Module packages; it is neither).

**Pack**:
Portable recipe for a Bot, not a live Bot. Soul / instructions,
Skill docs (`SKILL.md`-class / skills files), Schedule templates
(import paused), integration stubs (slug + reason + required env
*names*, never values), optional `ui/` HTML mini-apps, optional
`suggestedAppearance` (only when creating a new Bot), optional
human README. Public id is `author.slug` plus semver `version`. The Bot-part
slug is RU→lat transliteration then slugify; a named Bot does
not fall back to `pack`. Export omits Host seed Skills. A
successful Export stamps the installed Pack snapshot and the
Bot ref. No Chat, no secrets, no host paths. Canonical tree is
`pack.json` + `skills/` (+ optional `schedules/`, `ui/<id>/`,
README); share is a zip of that tree. **Pack ≠ Bot ≠ Module
package.** Day-1 marketplace / OSS share ships Packs. The
public catalog is **Marketplace**
([ADR 0045](docs/adr/0045-pack-catalog-on-marketing-site.md)).
Listing source of truth is the **Catalog Store**
on `dostigus/cloud` / dostigus.ru
([ADR 0047](docs/adr/0047-marketplace-catalog-store.md)).
See [ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md).
_Avoid_: Bot, Module package, plugin, extension, bot package
(unqualified), treating a zip as a live Bot.

**Mailer Pack**:
Bot Pack id `dostigus.mailer`: soul, Skills, paused
Schedule templates, and IMAP/SMTP integration stubs
(env **names** only). Apply creates a new Bot. Not
`dostigus.mail` (paste-only triage). Secrets never in
the Pack zip or the catalog mirror. See
[ADR 0048](docs/adr/0048-mailer-product.md).
_Avoid_: treating Mailer as `dostigus.mail`, Module
package, putting credentials in the Pack.

**Bot mail binding**:
Cluster Store row that binds one IMAP/SMTP mailbox to
one Bot. The Owner or an Admin writes it in Closet
after Apply. One mailbox per Bot. The mailbox server
is the host and port on that bind. Credentials stay on
the Cluster. The Host always blocks loopback, private,
and link-local destinations. There is no Cluster mail
allowlist. See
[ADR 0048](docs/adr/0048-mailer-product.md).
_Avoid_: Chat self-settings bind, Member self-bind,
secrets in the Pack zip or catalog mirror, Cluster
mail allowlist, treating mail hosts as Cluster
settings.

**Marketplace**:
Public catalog on the marketing site
(https://dostigus.ru/marketplace)
([ADR 0045](docs/adr/0045-pack-catalog-on-marketing-site.md)).
That site lives in GitHub repo `dostigus/cloud`. Listing
source of truth is the **Catalog Store** on that same
site / dostigus.ru
([ADR 0047](docs/adr/0047-marketplace-catalog-store.md)).
The site owns publish, mirrors, and the public read API.
Packs are the first catalog kind; Module packages and
integrations are later kinds on the same Marketplace, not a
separate Packs brand. `/packs` and `/packs/:slug` 301 to
Marketplace. Each Pack page has SEO and a CTA that
deep-links into the Host (`applyPack=` cloud mirror zip URL
→ `PackApplySheet` preview). Copy-URL is the fallback when
the Host is unreachable or the origin is not that Host.
The Host does not pull this catalog. Host v1 Closet is an
out-link to https://dostigus.ru/marketplace (RU; not
locale-aware). Public pages share one path set in RU
(unprefixed) and EN (`/en/...`); first visit is RU
([ADR 0046](docs/adr/0046-site-i18n-url-prefix.md)).
`/en/packs` 301s like `/packs`. Pro stays out of the public
field
([ADR 0040](docs/adr/0040-collective-host-direction.md)).
Not an in-product Host marketplace. Not Apply-from-index.
_Avoid_: Pack catalog (as a public brand), treating
Marketplace as a Host-pulled catalog or Apply-from-index,
treating `/packs` as the live path, advertising Pro on the
public site, treating static `content/packs` as the
forever publish path, treating Catalog Store as Platform
Host or a Member Cluster, treating the catalog as a
Host-pulled API, treating a Pack page as a Module package,
a second Module Marketplace brand, locale-aware Host
out-links.

**Catalog Store**:
Source of truth for published Marketplace Pack listings
(title, short and long copy i18n, screenshots and assets
we host, version, author string, publish status, mirror
zip pointer). Lives with Marketplace on the marketing
site / dostigus.ru (`dostigus/cloud`)
([ADR 0047](docs/adr/0047-marketplace-catalog-store.md)).
Not the Cluster Store. Not Platform Host. After Nick
approves a listing, **cloud** hosts an immutable
`{id}-{version}.zip` (hybrid mirror). Author origin
(https git or a zip URL) is for develop and submit only.
Member Apply uses that cloud mirror URL. Listing
screenshots live in our object storage, not inside the
Pack zip. Listing ≠ binary. Publish v1 is Nick only
(not Cluster Admin). A Publisher role and a Submit
portal are later. Kitchen, Mail, and Reader migrate from
`dostigus/cloud` static trees onto this Store. Public
read is under dostigus.ru (for example
`GET /api/catalog/packs`, or the path the site
documents). Host [#189](https://github.com/dostigus/dostigus/pull/189)
`@dostigus/catalog` on Platform Host is removed.
Do not expand Host catalog.
_Avoid_: Cluster Store, treating listings as Cluster
Artifacts, Catalog Store on Platform Host or a Member
Cluster, Host-pulled catalog index, auto-publish,
auto-update, secrets in the Pack zip.

**Bot visibility**:
Who may see a Bot. A personal Bot plus explicit grants
([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md), amended
2026-09-24). A new Bot is personal to its creator. The creator can see
it. The Owner always can, including a Member-created Bot with no grant.
Anyone else needs a grant: one row, `bot_id` and `person_id`. "All
current Members" grants Members who can sign in now. A later Invite does not
receive those Bots. The Owner may grant or revoke on any Bot. The
creator may grant or revoke on their own Bot. A grantee cannot
re-share unless they are also the Owner, an Admin, or the creator.
An Admin may grant or revoke on any Bot without seeing it; a Member
grants only a Bot they created and does not grant someone else's
shared Bot
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
Revoke drops list and open. That person's bot-thread rows
stay. The Host stores `bot_grants`. Migration `0013_bot_grants` copied
former `shared` Bots into one grant per Member row that existed then,
including a disabled Member, and dropped `visibility`. Module data
stays in the Cluster Store. A **shared Bot** is a Bot that someone
other than its creator may open through a grant. The Owner or an
Admin shares. A Member shares only a Bot they created
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
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
that person's bot-thread (`botId`, `personId`). Personal Schedule
fire stays bot-thread-only. A Case follow-up is a sibling Wake
path on the Case Thread, not a Schedule row
([ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md)).
The Bot supplies the cadence (`daily` or `weekly`), the local
`HH:MM`, optional weekdays when weekly, an optional display name,
and the wake text. Empty name: the Host list falls back to
truncated wake text. The Host owns the next fire instant. Closet
Параметры shows a «Расписания» block for this person's rows on
this Bot ([ADR 0027](docs/adr/0027-bot-schedules.md)).
_Avoid_: cron, crontab, alarm, reminder, Skill, Manifest field,
Routines, stuffing Case follow-up into a personal Schedule.

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
Appearance lives on the Bot. A Pack may carry optional
`suggestedAppearance` used only when Apply creates a new Bot
([ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md)).
_Avoid_: config, profile (unqualified), treating a Pack as the
Manifest.

**Module package**:
Versioned unit: schema/migration, MCP tools, Kit UI bindings, Skill diffs.
Lives in the Cluster Store. Not a Bot. Not a Pack. This monorepo
does not ship a stock Module package. **Pack ≠ Module package.**
_Avoid_: plugin, extension, addon, Bot, Pack.

**Module catalog**:
Not a day-1 artifact in this monorepo. There is no
`packages/modules/<id>/` seed and no Host-bundled Apply of platform
packages. Module packages are a later Marketplace catalog
kind, not a separate public brand, and stay later than Pack
Apply
([ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md),
[ADR 0045](docs/adr/0045-pack-catalog-on-marketing-site.md),
[ADR 0047](docs/adr/0047-marketplace-catalog-store.md)).
See [ADR 0030](docs/adr/0030-chat-cards-module-catalog.md).
_Avoid_: stock seed, registry, plugin gallery, treating
Marketplace as a Host product surface, treating a Pack page
as a Module catalog.

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
packages. An installed Pack is an immutable snapshot `id@version`
in `installed_packs`; the Bot holds `installed_pack_id`
([ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md)).
Not the **Catalog Store** (Marketplace listings on
`dostigus/cloud` / dostigus.ru,
[ADR 0047](docs/adr/0047-marketplace-catalog-store.md)).
_Avoid_: database (unqualified), repo, treating Cluster
Store as the Marketplace listing source.

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
Two distinct writes. **Pack Apply** installs a Pack onto an
existing Bot or creates a new Bot from a local file, a public
`.zip` URL, or an https git remote (preview / plan, then confirm).
The Pack owns Skills (except Host seed Skills) and Schedules that
carry that snapshot's provenance. Owner-created and unlabeled
grandfather Schedules stay. See
[ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md).
The Host does not Apply from a live Marketplace index.
The public Marketplace is an out-link
(https://dostigus.ru/marketplace,
[ADR 0045](docs/adr/0045-pack-catalog-on-marketing-site.md)).
Deep-link Apply (`applyPack=` cloud mirror zip URL →
`PackApplySheet` preview) is
[ADR 0047](docs/adr/0047-marketplace-catalog-store.md).
Copy-URL is the fallback. Preview / plan still runs
before write.
**Module package Apply** installs a Module package into the live
Cluster (after staging review). Day-1 does not Apply a stock
Module package from this repo and does not bundle platform
packages into the Host image. A Builder Job that Applies a
Module package, and Module packages as a Marketplace kind,
stay later.
See [ADR 0030](docs/adr/0030-chat-cards-module-catalog.md).
_Avoid_: deploy, merge, ship (unqualified), Host-bundled Apply,
treating Pack Apply as Module package Apply, Apply-from-index.

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
exist on one Cluster. The API key lives on that instance
(`providers[].apiKey`) and is the only Store copy
([ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)).
After an OpenRouter key is saved, the Host may proxy that
instance’s live catalog for Settings (`kind=openrouter` day-1
of the [ADR 0036](docs/adr/0036-llm-providers-tier-resolve-escalate.md)
Settings amend).
_Avoid_: vendor, engine, catalog (unqualified), treating a
Provider as the whole LLM gateway, a second Cluster-level key
field beside the Provider.

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
not set it. This is a Cluster setting because Host HTTP get is
Cluster-wide, not a Pack. Feature-specific outbound limits for one
Bot or one Pack go on the Bot
([ADR 0048](docs/adr/0048-mailer-product.md)). See
[ADR 0031](docs/adr/0031-host-http-get.md).
_Avoid_: URL allowlist (unqualified), CORS, proxy list, Cluster mail
allowlist, treating a Pack host list as Cluster settings.

**mail allowlist** (rejected):
Do not use. Nick rejected a Cluster-level host:port
mail allowlist on 2026-10-03 (empty = deny all, Owner
Dashboard form). The mailbox server is the Closet
**Bot mail binding**. SSRF blocks stay. Feature-specific
outbound limits that apply to one Bot or one Pack go
on the Bot, not on Cluster settings. See
[ADR 0048](docs/adr/0048-mailer-product.md).
_Avoid_: Cluster mail allowlist, treating mail hosts
as Cluster settings, reusing Cluster http allowlist
for IMAP/SMTP.

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
The Store, route, and code name for the accounts of the Collective
(`members`, Household helpers,
[ADR 0012](docs/adr/0012-household-members.md)). One Cluster is one
Household. Host UI copy and positioning say Collective, not
Household.
_Avoid_: Household in Host UI copy (say Collective); team, org,
family (positioning words; use Collective). The **Team**
persona is an audience, not a synonym for Collective
([ADR 0043](docs/adr/0043-target-personas.md)).

**Collective**:
The 1…N people on one Cluster: a family, a startup, or a small
enterprise. The product direction is the **Collective Host**: a
messenger, personal and shared Bots, and MCP to external systems
([ADR 0040](docs/adr/0040-collective-host-direction.md)). Primary
audiences are the **Owner-operator** (Collective N=1) and the
**Team** of 2–15; product leads with Team
([ADR 0043](docs/adr/0043-target-personas.md)). Host UI
copy says Collective («коллектив» in RU). Its accounts are the
Household in Store and code. v1 roles are Owner, Admin, and
Member
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
_Avoid_: CRM, tenant, org, workspace, team (as the product noun;
the Team persona in
[ADR 0043](docs/adr/0043-target-personas.md) is an audience,
not a synonym for Collective).

**Team**:
The type-2 primary audience: 2–15 people on one Cluster who
run work in Chat with Bots. Messenger + Bots. CRM-shaped
work, not a sales CRM. Product leads with this audience.
Collective stays the product noun. See
[ADR 0043](docs/adr/0043-target-personas.md).
_Avoid_: treating Team as a synonym for Collective, sales
team, org, treating Team as Host UI copy (say Collective).

**Invite**:
A one-shot link the Owner creates so someone can become a Member. The Store
keeps a hash of the token, the reserved email, and an expiry. The raw token
is shown once, on the Invite URL the Owner copies. Accepting it creates a
Member. An Admin may also create an Invite; the Store records the
Cluster Owner on it
([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
Not a Share link. An Invite does not grant Bots. A later Invite
does not receive grants made earlier.
_Avoid_: Share link, guest link, magic link (unqualified), invitee.

**Share link**:
Narrow public token to one object, not the whole Cluster.
_Avoid_: public share, invite (unqualified).

## Relationships

- Platform ≠ Cluster. Git is only for the Platform. A Cluster is not a git repo.
- A Cluster has one Owner, a Store, Bots, Module packages, installed
  Pack snapshots, and its Household. One Cluster is one Household.
  **Pack ≠ Bot ≠ Module package.**
- A Member signs in on the same Host. Bot visibility decides which Bots
  they see ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md),
  amended 2026-09-24). A Bot is personal to its creator;
  the Owner always sees the full list; other people need a grant. The
  creator and the Owner may edit the Manifest and delete the Bot. A
  grantee chats on their own bot-thread. Members and the LLM gateway
  stay with the Owner, except that an Admin may open Members and
  Providers
  ([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)). Finding a
  Bot stays the picker. One bot-thread
  per person. The Host stores `bot_grants`. `dm`, `group`, and `room` are
  in the Host. A room does not grant access.
- The Owner adds a Member by hand, or creates an Invite for an email and
  copies the link. Accepting an Invite creates a Member and signs them in.
  Sending that link by SMTP is later. An Invite is not a Share link and
  does not grant Bots. An Admin may also create an Invite
  ([ADR 0042](docs/adr/0042-admin-role-and-share-permission.md)).
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
  [ADR 0024](docs/adr/0024-threads-and-bot-visibility.md). A Case sits
  on a `group` or a `room` only
  ([ADR 0041](docs/adr/0041-case-lite-on-thread.md)). On-thread fields
  are in this Host. A Case inbox filter and follow-up Wakes are
  [ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md) and
  are not in this Host yet.
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
  bot-thread with that Bot, then runs the Bot turn. A personal
  Schedule does not fire on a room, a direct message, or a group.
  Closet Параметры lists this person's Schedules on this Bot. See
  [ADR 0027](docs/adr/0027-bot-schedules.md). A Case follow-up
  may write a Wake on the Case Thread
  ([ADR 0044](docs/adr/0044-case-inbox-and-follow-up-wakes.md));
  that path is not in this Host yet. That turn uses the same
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
- A Bot has a Manifest and bound Module packages. A Bot is not a Module package
  and not a Pack. A Bot may hold a ref to one installed Pack version
  (`id@version`).
- A Pack is a portable recipe. Pack Apply writes Skills (not Host
  seed Skills), paused Schedule templates stamped with the snapshot
  id, stubs, and optional `ui/` onto one primary Bot (or creates
  that Bot). Update replaces only provenance-stamped Schedules from
  the previous snapshot. Module package Apply is a different later
  write. See
  [ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md).
- The Kitchen Module is Cluster Store data, MCP tools, and a Kit Sheet.
  It is the seed of a Module package. It is not a Meal port, not a Bot,
  and not a Pack.
- Builder writes Module packages via Job → Module package Apply.
  Distinct from any Platform git agent. The chat Bot does not write
  Module packages. This monorepo ships no stock Module packages and no
  Weather seed. Module packages as a Marketplace kind are
  later. Day-1 marketplace / OSS share for Packs is
  [ADR 0039](docs/adr/0039-pack-vs-bot-portable-recipe.md). The
  public Marketplace is on the marketing site
  (https://dostigus.ru/marketplace,
  [ADR 0045](docs/adr/0045-pack-catalog-on-marketing-site.md));
  listings live in the Catalog Store on
  `dostigus/cloud` / dostigus.ru
  ([ADR 0047](docs/adr/0047-marketplace-catalog-store.md));
  this Host links out and does not pull a catalog. See
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
  `packages/ui-kit/locales/{en,ru}.json` (Host
  `apps/web/i18n/locales` is a symlink to that pair). Chat bodies, Skills,
  MCP tool descriptions, and LLM replies are not dictionaries.
  See [ADR 0037](docs/adr/0037-host-ui-i18n.md). Host URLs
  stay `no_prefix`. Marketing site public URLs are
  [ADR 0046](docs/adr/0046-site-i18n-url-prefix.md). Cluster
  timezone is a different setting.
- A Share link is a narrow public token to one object, not the Cluster.
  Share links and guests are later.
