# Dostigus — Domain Context

Self-host agent OS: portable bot packages + host UI sheets. This file
names the domain concepts. Keep these terms stable. Do not invent synonyms in
code, docs, or UI copy.

> Scope lives in [`docs/SPEC.md`](docs/SPEC.md). Decisions live in
> [`docs/adr/`](docs/adr/). Agent rules: [`AGENTS.md`](AGENTS.md).

## Language

**Cluster**:
One self-hosted instance. Holds bot manifests, module packages, the data store,
and media/notes. A Cluster is not a git remote.
_Avoid_: tenant, workspace, site, instance (unqualified).

**Bot**:
A portable package inside a Cluster: Storage → MCP surface → agent skills/persona.
UI modules talk to the same MCP surface. A chat Bot is not the cloud agent that
writes modules.
_Avoid_: app, assistant, skill (a skill is a file inside a Module package).

**Module package**:
A unit a Bot can carry: schema/migrations, MCP contract, UI kit bindings, and
`SKILL.md`. Day-1 modules are declarative (SQL + templated MCP), not arbitrary
sandbox code.
_Avoid_: plugin, extension, addon.

**Host shell**:
The single host app. Messenger chat + inline cards + Sheets from the shared
design kit. One host — no per-bot domains or per-bot SPAs.
_Avoid_: mini-app, dashboard, admin (unqualified).

**Sheet**:
A host overlay (drawer or modal) opened from chat or a card. Sheets are host UI
kit surfaces bound to an MCP contract, not a separate site.
_Avoid_: page, iframe, dialog (use Sheet; modal is a Sheet kind).

**MCP contract**:
The only Bot ↔ store (and UI ↔ store) interface. Tools, types, and permissions
ship with the Module package. UI modules do not bypass MCP to touch storage.
_Avoid_: API, REST, RPC (unqualified).

**LLM gateway**:
The Cluster’s model router. User-supplied keys (OpenRouter / Anthropic / OpenAI
/ Ollama). Tiers: `cheap` | `strong` | `code`. Pin mid/`strong` for MCP Bots;
free/random is toy only.
_Avoid_: provider, model picker (the gateway owns tiers).

**Household**:
Later multi-user sharing of a Cluster. Not day-1. Public share is narrow object
links, not Household.
_Avoid_: team, org, family (until Household ships).

## Relationships

- Git is only for the platform monorepo. Bots are not separate git repos.
- A Cluster contains many Bots; a Bot contains Module packages.
- Host shell talks to Bots through MCP contracts and renders Sheets from the
  shared UI kit.
- LLM gateway sits in front of every Bot call; the chat Bot does not write
  Module packages.
- Export/import moves Bot packages between Clusters.
