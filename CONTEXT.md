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
Message timeline with a Bot.
_Avoid_: thread, messenger, inbox (unqualified).

**Card**:
Inline structured UI in the Chat (button, table, status).
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
avatar shape, and avatar color (Bot accent palette).
_Avoid_: config, profile (unqualified).

**Module package**:
Versioned unit: schema/migration, MCP tools, Kit UI bindings, Skill diffs.
Lives in the Cluster Store. Not a Bot.
_Avoid_: plugin, extension, addon, Bot.

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
The Owner and the Members on one Cluster.
_Avoid_: team, org, family.

**Share link**:
Narrow public token to one object, not the whole Cluster.
_Avoid_: public share, invite (unqualified).

## Relationships

- Platform ≠ Cluster. Git is only for the Platform. A Cluster is not a git repo.
- A Cluster has one Owner, a Store, Bots, Module packages, and its Household.
- A Member signs in on the same Host. Bot list and Chat are shared. Creating
  or deleting a Bot, Members, and the LLM gateway stay with the Owner.
- A Host user message stores the Owner id or Member id, and the Host
  keeps that author's name on the line. Chat bubbles stay unlabeled.
  Turning off a Member's sign-in keeps the name.
- A Bot has a Manifest and bound Module packages. A Bot is not a Module package.
- Builder writes Module packages via Job → Apply. Distinct from any Platform
  git agent. The chat Bot does not write Module packages.
- Host talks to Bots through the MCP surface and renders Cards and Sheets from
  the Kit. The Sheet shell and Brand stickers live in the Kit.
- LLM gateway maps Model tiers to providers for every Bot call.
- A Share link is a narrow public token to one object, not the Cluster.
  Share links and guests are later.
