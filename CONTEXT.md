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

**Thread**:
One conversation in the Cluster. It has participants and Chat lines.
Kinds are labels, not separate products: `dm` (person and person),
`group` (people), `bot` (one person and one Bot; a bot-thread), `room`
(people and at least one Bot). A `shared` Bot is not one Household-wide
timeline. Each person has their own bot-thread with that Bot. A `room`
is how a Bot joins a Thread with more than one person.
_Avoid_: channel, conversation (unqualified).

**Participant**:
A person or a Bot on a Thread. A person is the Owner or a Member.
_Avoid_: user, attendee.

**Card**:
Inline structured UI in the Chat (button, table, status). Day-1 renders
a button and a status as Kit parts on an assistant bubble
([ADR 0025](docs/adr/0025-chat-bubble-parts.md)). A table and other Card
kinds stay later.
_Avoid_: widget, embed, attachment (unqualified).

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
`shared` or `private` on a Bot. The Owner creates a Bot as `shared`
unless they set `private`. A Member creates only `private`. A `shared`
Bot is visible to the Household, and each person has their own
bot-thread with it. A `private` Bot is visible to the person who created
it and to the Owner. Only the Owner flips `private` to `shared`.
Visibility is who may open the Bot. Module data stays in the Cluster
Store.
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
Policy/instructions a Bot follows. Not executable UI.
_Avoid_: prompt (unqualified), tool, Module package.

**Manifest**:
Bot definition: persona, Skills, bound Module packages, Model tier,
avatar shape, avatar color (Bot accent palette), an optional label,
and an optional description.
_Avoid_: config, profile (unqualified).

**Module package**:
Versioned unit: schema/migration, MCP tools, Kit UI bindings, Skill diffs.
Lives in the Cluster Store. Not a Bot.
_Avoid_: plugin, extension, addon, Bot.

**Kitchen Module**:
Day-1 Cluster domain: pantry items (name, optional qty), one recipe
(name and ingredients text), and a cooked log whose rows sum to an XP
counter. The Host opens it as a Sheet from a Chat button part. The
tables, MCP tools, and Sheet are the seed of a Module package. There is
no Apply runtime yet, so this seed is not an installed Module package.
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
_Avoid_: deploy, merge, ship (unqualified).

**LLM gateway**:
Cluster config mapping Model tiers to providers.
_Avoid_: provider, model picker (the gateway owns tiers).

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
Member. Not a Share link. An Invite does not change Bot visibility.
_Avoid_: Share link, guest link, magic link (unqualified), invitee.

**Share link**:
Narrow public token to one object, not the whole Cluster.
_Avoid_: public share, invite (unqualified).

## Relationships

- Platform ≠ Cluster. Git is only for the Platform. A Cluster is not a git repo.
- A Cluster has one Owner, a Store, Bots, Module packages, and its Household.
  One Cluster is one Household.
- A Member signs in on the same Host. Bot visibility decides which Bots
  they see ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md)).
  Creating or deleting a `shared` Bot, Members, and the LLM gateway stay
  with the Owner. A Member may create a `private` Bot, edit its Manifest,
  and delete it. Only the Owner flips that Bot to `shared`. The Owner
  sees every `private` Bot. Finding a Bot stays the picker. The Host
  stores Bot visibility and one bot-thread per person
  ([ADR 0024](docs/adr/0024-threads-and-bot-visibility.md)).
  `dm`, `group`, and `room` are not in the Host yet.
- The Owner adds a Member by hand, or creates an Invite for an email and
  copies the link. Accepting an Invite creates a Member and signs them in.
  Sending that link by SMTP is later. An Invite is not a Share link and
  does not change Bot visibility.
- The Owner creates a Bot from that list. The name starts as **New Bot**,
  with a random flock mark, and Bot visibility starts as `shared`. What
  the Bot is for is a Chat line, not a Manifest field.
- A Host user message stores the Owner id or Member id, and the Host
  keeps that author's name on the line. Chat bubbles stay unlabeled.
  Turning off a Member's sign-in keeps the name and their `private` Bots.
  The Owner still sees those Bots.
- Chat lines belong to a Thread. A `shared` Bot has one bot-thread per
  person. A `room` is the Thread that includes a Bot and more than one
  person. `dm` and `group` are Threads among people. See
  [ADR 0024](docs/adr/0024-threads-and-bot-visibility.md).
- Module package data lives in the Cluster Store. Bot visibility does not
  give a Bot its own Store. A `private` Bot uses the same MCP surface
  under that person's permissions.
- A Bot has a Manifest and bound Module packages. A Bot is not a Module package.
- The Kitchen Module is Cluster Store data, MCP tools, and a Kit Sheet.
  It is the seed of a Module package. It is not a Meal port and not a Bot.
- Builder writes Module packages via Job → Apply. Distinct from any Platform
  git agent. The chat Bot does not write Module packages.
- Host talks to Bots through the MCP surface and renders Cards and Sheets from
  the Kit. The Sheet shell and Brand stickers live in the Kit. An assistant
  Chat line keeps Markdown in `content`
  ([ADR 0022](docs/adr/0022-chat-assistant-markdown.md)) and may carry Kit
  parts: a button that opens a Sheet, and a status
  ([ADR 0025](docs/adr/0025-chat-bubble-parts.md)). User and system lines
  have no parts. Bot-threads are in the Host. `dm`, `group`, and `room`
  stay [ADR 0024](docs/adr/0024-threads-and-bot-visibility.md) milestone 3.
- LLM gateway maps Model tiers to providers for every Bot call.
- A Share link is a narrow public token to one object, not the Cluster.
  Share links and guests are later.
