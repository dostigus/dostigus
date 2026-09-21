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
Primary account that controls the Cluster.
_Avoid_: admin, user (unqualified).

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
Bot definition: persona, Skills, bound Module packages, Model tier.
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
surface as the runtime term. Day-1 platform tools: `bots.list`, `bots.get`,
`bots.create`, `bots.update`, `bots.delete`, `messages.list`,
`messages.create`.
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
Optional shared membership with scoped access (later).
_Avoid_: team, org, family (until Household ships).

**Share link**:
Narrow public token to one object, not the whole Cluster.
_Avoid_: public share, invite (unqualified).

## Relationships

- Platform ≠ Cluster. Git is only for the Platform. A Cluster is not a git repo.
- A Cluster has an Owner, a Store, Bots, and Module packages.
- A Bot has a Manifest and bound Module packages. A Bot is not a Module package.
- Builder writes Module packages via Job → Apply. Distinct from any Platform
  git agent. The chat Bot does not write Module packages.
- Host talks to Bots through the MCP surface and renders Cards and Sheets from
  the Kit.
- LLM gateway maps Model tiers to providers for every Bot call.
- Household is later scoped membership. A Share link is a narrow public token
  to one object, not the Cluster.
