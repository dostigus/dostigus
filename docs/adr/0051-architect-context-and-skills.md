# ADR 0051: Architect, Context, and vendored skills

- Status: accepted
- Date: 2026-11-21

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

Release: `dostigus_releases_start`.

Already on the MCP surface, and still available: `dostigus_messages_create`
/ `dostigus_messages_list`, `dostigus_artifacts_put`, `dostigus_skills_*`,
`dostigus_schedules_*`, `dostigus_turns_*`.

### Memory is Context, from S1

The Architect's long-term memory is **Context**
([hmbanan666/context](https://github.com/hmbanan666/context),
`context.kosarev.space`). It is not "the Chat thread plus the repo,
until later".

Context's tools are its own: `search`, `remember`, `read`, `timeline`.
Dostigus does not rename them. The Architect calls Context with a token
bound to the Project (`--project` on that service). `search` with
`mode: "pack"` returns one **task context pack** inside the byte budget
described in [ADR 0050](0050-dev-factory-domain-model.md). `remember`
writes a note, a fact, or a decision tagged with that project.
`read` loads a profile, a journal, or a document by id.

From **S1**: creating the Dostigus Project records `contextProjectId`
and the Context URL on the `kind=context` Integration. The external
Architect can fetch a task context pack for that id before it cuts
Tickets. The profile is readable.

From **S2**: a Grill session that proceeds is written to Context with
the project id. An ADR that merges may be stored as a Context document.
A later session loads a pack and can cite the earlier decision without
the old Chat thread.

The built-in Architect (S7) uses the same Context project. If it cannot
hold the credential itself, the Host stores that secret like a Provider
key and calls Context in-process. S1 does not require that proxy. The
external Architect already can.

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
fits a budget. Context already does those three, on
`context.kosarev.space`, with a project id on each distilled fact and
decision. The MVP draft said to add it later as an ordinary
Integration. That waits too long: S1 and S2 are when the Architect
starts to accumulate decisions. Those decisions have to be recoverable
on the next Task.

`.cursor/skills/` is for agents editing this monorepo (Host and Kit
taste). Architect skills do not go there. They would load into every
Platform editing session.

## Consequences

- Docs and vendored skill files only. No MCP handler, no Project token
  issuer, and no Pack zip in this record.
- S1 done includes a Context project id on the Dostigus Project and a
  pack the external Architect can read.
- S2 done includes a Grill outcome stored in Context and read back
  from a later pack.
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
- Copy Context rows into the Store — rejected. The Store keeps the
  project id and the Integration link.
- Fetch skills from GitHub at run time — rejected. They are vendored.
- Install the vendored skills into `.cursor/skills/` — rejected. That
  directory is for Platform editing.
- Leave `to-tickets` publishing GitHub issues — rejected. The board
  is Tasks and Tickets.
- Let the Project token pass a Gate — rejected.
