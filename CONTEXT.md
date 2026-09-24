# Dostigus — Domain Context

Self-host agent OS: portable bot packages + host UI sheets. This file
names the domain concepts. Keep these terms stable. Do not invent synonyms in
code, docs, or UI copy.

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
Host for Bot list and Chat.
_Avoid_: user, guest, account (unqualified), invitee.

**Host**:
The single client app (web/PWA first): Chat + Cards + Sheets. **Host shell**
is a synonym — prefer Host.
_Avoid_: Host shell (prefer Host), mini-app, dashboard, admin (unqualified),
per-bot SPA.

**Chat**:
The lines a person reads and writes on a Thread in the Host.
_Avoid_: messenger, inbox (unqualified).

**Wake**:
A visible system Chat line the Host writes on a bot-thread when a
Schedule fires. The line carries the wake text the Bot supplied. The
Host then runs the same Bot turn as a user message. Not an Activity
row.
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
ops meta (outcome, phase times, tool names). It is not a Chat line and
not an Activity row.
_Avoid_: trace, span, log (unqualified), transcript.

**Turn journal**:
The Store table and MCP surface tools an ops agent uses to read Turns
on a live Host (`dostigus_turns_list`, `dostigus_turns_get`). Not an
Owner Sheet. Not part of the Chat LLM allowlist. See
[ADR 0029](docs/adr/0029-turn-journal.md).
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
other Card kinds stay later.
_Avoid_: widget, embed, attachment (unqualified).

**Chat Card**:
A Kit Card the Host injects in the thread after a successful Schedule
change. Stored as one assistant message part (`kind: card`) so reload
keeps it. Not a system line and not a closet control. Pause and
Изменить open a Sheet for that Schedule. Delete confirms in the Sheet.
The model does not emit the part. Day-1 does not inject a Card after
Apply.
_Avoid_: widget, toast, system line, embed.

**Sheet**:
Modal/drawer app slice from the Kit, not a separate site.
_Avoid_: page, iframe, dialog (use Sheet; modal is a Sheet kind).

**Kit**:
Shared design system / building blocks the Host renders. Bots do not ship
custom CSS apps.
_Avoid_: theme, CSS app, per-bot design system.

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
Policy and instructions a Bot follows. Not executable UI and not a
Module package. A Skill id is letters, digits, `_`, or `-`. A dotted
id is not a Skill id. `parseSkillId` in
`packages/shared/src/skill.ts` checks that charset. A Skill is one
`instructions` string. There is no locale column. Skills live in
`bots.skills_json` as `{ id, instructions }`. The Manifest lists that
Bot's Skills. Self-settings may list, upsert, and delete that text on
the Bot ([ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md)). On
Bot create the Host may upsert a fixed set of meta Skills (constructor
how-to). Those instructions are Russian markdown in that same string.
The creator or the Owner may edit or delete them. An existing id is
not overwritten on boot. See
[ADR 0030](docs/adr/0030-chat-cards-module-catalog.md). A Skill does
not say when the Host wakes the Bot.
_Avoid_: prompt (unqualified), tool, Module package, stock package.

**Schedule**:
A Cluster Store row on the Host that says when the Host wakes a Bot.
Not a Manifest field and not a Skill. A Skill says what; a Schedule
says when. Many Schedules may belong to one person and one Bot, on
that person's bot-thread (`botId`, `personId`). The Bot supplies the
cadence (`daily` or `weekly`), the local `HH:MM`, optional weekdays
when weekly, and the wake text. The Host owns the next fire instant.
_Avoid_: cron, crontab, alarm, reminder, Skill, Manifest field.

**Self-settings**:
A person's request in Chat that the Bot change its own name, label,
description, Skills, or Schedules. The Bot writes the Store through
the MCP surface. A reply that claims the change without a successful
tool result is not the write. The Host injects one short instruction
on every Bot turn. That instruction is not a Manifest field. The
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
Cluster config mapping Model tiers to providers.
_Avoid_: provider, model picker (the gateway owns tiers).

**Cluster timezone**:
The one IANA timezone for the Cluster, stored as
`cluster_settings.timezone`. A Schedule keeps a local wall clock; the
Host converts that clock for the next fire. The default is the
`DOSTIGUS_TZ` env when set, otherwise `UTC`. The Owner sets it. A
Member may read it.
_Avoid_: user timezone, per-Bot timezone, locale, offset.

**Model tier**:
`cheap` | `strong` | `code` (and `toy` for unreliable free). MCP Bots pin
strong/mid.
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
  message, and a group do not get that fire. See
  [ADR 0027](docs/adr/0027-bot-schedules.md).
- When a person asks a Bot to change its name, label, description,
  Skills, or Schedules, that is Self-settings. The Bot calls MCP
  surface tools and does not claim success without a successful tool
  result. The creator and the Owner may change the Manifest fields and
  the Skills from Chat, including a Member who created the Bot. A
  grantee cannot. Schedule writes stay
  [ADR 0027](docs/adr/0027-bot-schedules.md). See
  [ADR 0028](docs/adr/0028-bot-self-settings-via-chat.md).
  A missing capability uses Skills upsert, Schedule tools, and Bot
  self-settings already in Chat. On Bot create the Host may upsert
  meta Skills that teach those tools. They are plain Skills. This
  monorepo does not ship a stock Module package
  ([ADR 0030](docs/adr/0030-chat-cards-module-catalog.md)).
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
  system lines have no parts. Bot-threads, `dm`, `group`, and `room` are in the Host.
  Grant rows are in the Host
  ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md)).
- LLM gateway maps Model tiers to providers for every Bot call.
- A Share link is a narrow public token to one object, not the Cluster.
  Share links and guests are later.
