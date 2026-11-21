# ADR 0051: Architect, Context, and vendored skills

- Status: accepted
- Date: 2026-11-21
- Amended: 2026-11-21 — Nick: Architect memory is a Context
  instance dedicated to Dostigus, on de2, run by the Context
  maintainer. It is not a personal Context. The Host holds one
  area token. The URL is `NUXT_CONTEXT_URL`. This record does not
  name a host.

Direction is [ADR 0049](0049-dev-factory-direction.md). The domain model
is [ADR 0050](0050-dev-factory-domain-model.md). The Chat tool loop the
built-in Architect will reuse is
[ADR 0011](0011-chat-mcp-tool-loop.md). Pack shape is
[ADR 0039](0039-pack-vs-bot-portable-recipe.md). Schedules that wake an
Audit or a Retro are [ADR 0027](0027-bot-schedules.md).

This record does not implement the tools, the token, or the Pack zip.

## Decision

**One Architect per Project.** Two modes, one tool set.

- **External, first.** Any agent that speaks MCP. The first one is Grok
  Bot. It calls the Host `/mcp` with a **Project token** (a bearer scoped
  to that Project, not the Owner session). Slice S1–S6 use this mode.
- **Built-in, later (slice S7).** A Bot on the Host. The LLM comes from
  Providers. The same tools run in-process on the Chat tool loop. Skills
  come from Pack `dostigus.architect`.

The tool set is one list for both modes. Names are the contract. Handlers
land with their slice. Human Gates are not in the write set: `gates`
requests and reads. A person decides in the Host.

Project: `dostigus_projects_list`, `dostigus_projects_get`,
`dostigus_projects_update`, `dostigus_repos_link`,
`dostigus_commands_set`.

Tasks: `dostigus_tasks_list`, `dostigus_tasks_get`,
`dostigus_tasks_create`, `dostigus_tasks_update`,
`dostigus_tasks_transition`.

Tickets: `dostigus_tickets_create`, `dostigus_tickets_update`,
`dostigus_tickets_list`.

Grill: `dostigus_grills_open`, `dostigus_grills_add_round`,
`dostigus_grills_get` (includes answers), `dostigus_grills_close`
(outcome).

Knowledge links: `dostigus_decisions_record`, `dostigus_specs_record`
(path and pull request in the repo).

Gates: `dostigus_gates_request`, `dostigus_gates_get`.

Runs: `dostigus_runs_start`, `dostigus_runs_get`, `dostigus_runs_list`,
`dostigus_runs_cancel`.

Audit and Retro: `dostigus_audits_start`, `dostigus_findings_put`,
`dostigus_retros_put`.

HQ: `dostigus_integrations_list`, `dostigus_integrations_call`.

Context proxy: `dostigus_context_search`, `dostigus_context_remember`,
`dostigus_context_read`, `dostigus_context_timeline`. The Host injects
area `dostigus` and `project`. The caller does not send the Context
bearer.

Release: `dostigus_releases_start`.

Already on the MCP surface, and still available: `dostigus_messages_create`
/ `dostigus_messages_list`, `dostigus_artifacts_put`, `dostigus_skills_*`,
`dostigus_schedules_*`, `dostigus_turns_*`.

### Memory is Context, from S1

The Architect's long-term memory is **Context**
([hmbanan666/context](https://github.com/hmbanan666/context)). The
instance is dedicated to Dostigus. It runs on de2. The Context
maintainer runs it. It is not Nick's personal Context, and this
record does not name that other host.

The public URL is not final. The Host reads it from
`NUXT_CONTEXT_URL`. Docs do not hardcode a host. The credential is
`NUXT_CONTEXT_TOKEN`: one area token for area `dostigus`, held by
the Host process. It is not a per-Project secret and not a token on
the Architect.

The external Architect and the built-in Architect reach Context only
through the Dostigus MCP surface. The Host proxies
`search`, `remember`, `read`, and `timeline`. The tools on that
surface are `dostigus_context_search`, `dostigus_context_remember`,
`dostigus_context_read`, and `dostigus_context_timeline`. The caller
does not send `project`, the area, or the Context bearer. The Host
sets area `dostigus`, sends `NUXT_CONTEXT_TOKEN`, and injects
`project` from the Project row.

`search` with `mode: "pack"` returns one **task context pack** inside
the byte budget in [ADR 0050](0050-dev-factory-domain-model.md).
`read` loads a profile, a journal, or a document by id.

Grill sessions, Runs, and Gates stay in the Store. Context does not
store those rows. When a Grill session closes with `proceed`, the
Host writes two things: the resulting decision, and a `note` document
whose key is `grill-<id>` (the Grill session id). An ADR that merges
may also be stored as a Context document (`doc` type `adr`).

From **S1**: the Host has `NUXT_CONTEXT_URL` and
`NUXT_CONTEXT_TOKEN`. The first `remember` for a Project creates the
Context project (token flag `--create-projects`). The Host stores the
returned id on `contextProjectId`. The external Architect reads a
task context pack through the proxy before it cuts Tickets.

From **S2**: a later session loads a pack and can cite the earlier
decision without the old Chat thread.

The built-in Architect (S7) uses the same proxy and the same env
token. It does not hold a second Context credential.

#### Context capabilities this record relies on

These are being added upstream in Context. S1 and S2 depend on them.
The Dostigus instance may leave the distill processor off. Facts and
decisions do not wait for that processor.

- Token flag `--create-projects`. The Host creates a Context project
  on the first `remember` for a Dostigus Project.
- `remember.metadata.kind` is `decision` or `fact`. Context stores
  that row immediately as **proposed**. No distill pass is required.
- Token flag `--may-approve`. The Host may send
  `metadata.status: approved` only for the Owner's explicit approve
  click in the Host. That click approves a proposed fact or decision.
  It is not a Gate. Gates stay in the Store, and the MCP surface
  still cannot pass a Gate.
- `doc.type: profile` on `remember` writes the project profile.
- A Grill that proceeds also writes `doc` type `note`, key
  `grill-<id>`, with the session id from the Store.

### Skills

Skill files live in this repo at [`skills/`](../../skills/). They are
vendored from mattpocock/skills, MIT, at commit
`abeeaf95660ba9e8b7c753eb38f441ca707a8823`. License and the adaptation
note: [`skills/NOTICE.md`](../../skills/NOTICE.md). The stage map and
the Dostigus overlay (glossary path, no GitHub issues, Gates, Context
pack): [`skills/README.md`](../../skills/README.md).

`to-tickets` is the adapted file. It writes Tickets on the Task. The
other vendored files are unmodified. The overlay wins where an
unmodified file says `GLOSSARY.md` or "issue tracker". This Platform's
glossary is [`CONTEXT.md`](../../CONTEXT.md). A linked repo uses the
path on its Repo link `docsLayout`.

The Architect receives these skills as Pack **`dostigus.architect`**
(`author.slug`). The Pack is the usual recipe
([ADR 0039](0039-pack-vs-bot-portable-recipe.md)): `pack.json`,
`skills/`, no secrets. Publishing that zip and Applying it are later
than this record. S0 only lands the files in `skills/`. S7 Applies the
Pack onto the built-in Architect. The external Architect is instructed
to read the same files from this repo.

Updating the vendor is a later proposed record (see the ADR index
backlog). Until that record, a bump of the upstream commit is a
deliberate PR that refreshes `skills/NOTICE.md` and re-checks the
`to-tickets` adaptation.

## Context

Grok Bot already runs a Grill, writes ADRs, and starts cloud agents.
The built-in Architect does not need to exist before the factory is
useful. Shipping the built-in Bot first would delay the first real
Task on Dostigus.

Chat history is a thin memory. The repo holds the decisions that were
written down. Neither is a project profile, a journal, or a pack that
fits a budget. Context does those three, on a project id. The MVP
draft said to add it later, and the first draft of this record pointed
the Host at a personal Context. Nick rejected both on 2026-11-21.
Memory is a Context instance for Dostigus only, from S1. The
Architect never holds that credential. One area token on the Host
keeps every Project in area `dostigus`, and the Host injects which
project a call is for.

`.cursor/skills/` is for agents editing this monorepo (Host and Kit
taste). Architect skills do not go there. They would load into every
Platform editing session.

## Consequences

- Docs and vendored skill files only. No MCP handler, no Project token
  issuer, and no Pack zip in this record.
- S1 done includes `NUXT_CONTEXT_URL` and `NUXT_CONTEXT_TOKEN` on the
  Host, a `contextProjectId` created on first `remember`, and a pack
  the external Architect reads through the proxy.
- S2 done includes a Grill `proceed` that writes a proposed decision
  and a `note` document keyed `grill-<id>`, then a later pack that
  cites that decision. An Owner approve click in the Host is what
  sets `metadata.status: approved`.
- Pack `dostigus.architect` is the delivery name. The tree in
  `skills/` is the source of the Skill files inside it.
- The overlay in `skills/README.md` is binding for every vendored
  skill, including files that still say `GLOSSARY.md` or GitHub.

## Alternatives

- Built-in Architect first — rejected. External Grok Bot is first.
  Built-in is S7.
- A second tool set for the built-in Bot — rejected. One list.
- Memory is the repo and the Task thread until a later Integration —
  rejected. Context starts at S1.
- Copy Context rows into the Store — rejected. The Store keeps
  `contextProjectId`. The URL and the area token stay in Host env.
- Fetch skills from GitHub at run time — rejected. They are vendored.
- Install the vendored skills into `.cursor/skills/` — rejected. That
  directory is for Platform editing.
- Leave `to-tickets` publishing GitHub issues — rejected. The board
  is Tasks and Tickets.
- Let the Project token pass a Gate — rejected.
- Use a personal Context as Dostigus memory — rejected on
  2026-11-21. The instance is dedicated to Dostigus.
- Give the external Architect its own Context token — rejected.
  One area token stays on the Host. The Architect uses the proxy.
- Hardcode the Context host — rejected. The URL is not final.
  `NUXT_CONTEXT_URL` is the only place it lives.
