# Dostigus MVP

Vision: [vision.md](vision.md). Direction:
[ADR 0049](adr/0049-dev-factory-direction.md). Domain:
[ADR 0050](adr/0050-dev-factory-domain-model.md). Architect and
Context: [ADR 0051](adr/0051-architect-context-and-skills.md).
Glossary terms stay [`CONTEXT.md`](../CONTEXT.md). New nouns landed
there with those records. Docs in this repo stay English.

## Glossary

| Term | Decision |
| --- | --- |
| Platform, Cluster, Host, Store, Owner, Admin, Member, Collective, Thread, Chat, Bot, Skill, Schedule, Wake, Turn, Artifact, MCP surface, Provider, Model tier, Pack, Kit, Brand, Sheet | Unchanged |
| Kit, Brand (goose, stickers), Bot marks ([ADR 0018](adr/0018-bot-mark-flock.md)), `docs/ui.md` | Unchanged. New screens are Kit only |
| **Builder** | Redefined: a cloud coding agent the Architect starts (Cursor cloud agent or Codex). The old meaning, "writes a Module package", is retired |
| **Job** | Retired. A **Run** takes that place |
| **Orchestrator** | Redefined: the Host component that accepts triggers and starts Runs. The routing-Bot meaning is retired |
| **Case** | Stays for plain Collective chats. Project work uses a Task |
| Kitchen Module, Mailer Pack | Frozen. Code stays. No new features |
| [ADR 0005](adr/0005-self-host-first.md) | Amended: the factory is a cloud Host on de2. Self-host remains possible |
| [ADR 0040](adr/0040-collective-host-direction.md), [ADR 0043](adr/0043-target-personas.md) | Superseded as direction and audiences by [ADR 0049](adr/0049-dev-factory-direction.md) |
| New | Project, Repo link, Commands, Architect, Task, Ticket, Grill session, Decision, Spec, Run, Stage, Gate, Audit, Finding, Retro, Integration, Context, task context pack |

The model those nouns point at is
[ADR 0050](adr/0050-dev-factory-domain-model.md). This plan does not
repeat every field.

**Context** (https://github.com/hmbanan666/context) is the Architect's
long-term memory from S1 and S2. The instance is dedicated to
Dostigus, on de2, run by the Context maintainer. It is not a personal
Context. The Host connects with `NUXT_CONTEXT_URL` and
`NUXT_CONTEXT_TOKEN` (area `dostigus`, one token on the Host). The
external Architect reaches Context only through Dostigus MCP. The
Host proxies and injects `project`. The URL is configurable. These
docs do not name a host. Memory is facts and decisions tagged with
the Project, the project profile, the journal, and a task context
pack inside a budget (`budgetBytes` on Context; the factory treats
that cap as N tokens). Grill sessions, Runs, and Gates stay in the
Store. Context receives the resulting decision and a `note` document
keyed `grill-<id>`. The draft of this plan said "not in the MVP".
That is reversed.

## Where it runs

- **Host** on de2 through Dokploy, `dostigus.kosarev.space`. One
  Cluster, Owner Nick, several Projects inside it. Multi-tenant is
  later.
- **Orchestrator** inside the Host: a ticker in the shape of the
  Schedule ticker, a queue of Runs in the Store, polling of Builder
  status and of GitHub (pull request, checks).
- **Builders:** the Cursor cloud agents API (create an agent on a repo
  and a branch with a brief, read status, take the pull request) and
  Codex on de2 (a worker, the same Run contract). One runner interface:
  `start`, `status`, `cancel`. S3 is Cursor only. Codex is the second
  runner in S4.
- **GitHub** stays the git host: branches, pull requests, CI. Issues
  are unused. Access is a GitHub App or a project token on an
  Integration.
- **Release:** the Dokploy API deploys the Project's app after Release
  and the merge.
- **Skills** live in this repo under [`skills/`](../skills/) (vendored,
  MIT, with attribution) and are installed on the Architect as Pack
  `dostigus.architect`.

## Skills in the flow

Vendored in S0 from mattpocock/skills at
`abeeaf95660ba9e8b7c753eb38f441ca707a8823`. Map:
[`skills/README.md`](../skills/README.md).

| Step | Skill | In S0 |
| --- | --- | --- |
| Grill | `grilling` (alias `grill-me`), `grill-with-docs` | yes |
| Domain model | `domain-modeling`. `codebase-design` is named, not vendored yet | `domain-modeling` only |
| Prototype | `prototype` | yes |
| Spec and cut | `to-spec`, `to-tickets` (tracker = Dostigus Tickets on the Task), `wayfinder` for an epic | `to-spec` and `to-tickets`. `wayfinder` later |
| Implement | `implement`, `tdd`, `diagnosing-bugs`. `implement-spec` later | yes, except `implement-spec` |
| Review and pull request | `code-review`. `pr` later | `code-review` only |
| Retro | `retro` | not vendored yet. The Retro record is in [ADR 0050](adr/0050-dev-factory-domain-model.md) |
| Questions outside a session | `to-questionnaire` (a base for a Grill that starts from an Audit) | later |
| Factory language | `software-factory` (upstream in progress; reference only) | no |

Adaptation: the issue tracker in these skills is the Dostigus MCP
surface. `to-tickets` says so in the file. The other files are
upstream bytes. The overlay in `skills/README.md` tells the Architect
that `GLOSSARY.md` means the Repo link glossary path, and on this
Platform that file stays [`CONTEXT.md`](../CONTEXT.md).

## Architect tools

**External** (first, Grok Bot): `/mcp` with a Project bearer.
**Built-in:** a Bot on the Host, LLM through Providers, the same tools
in-process ([ADR 0011](adr/0011-chat-mcp-tool-loop.md)). One set:

- Project: `dostigus_projects_list`, `dostigus_projects_get`,
  `dostigus_projects_update`, `dostigus_repos_link`,
  `dostigus_commands_set`
- Tasks: `dostigus_tasks_list`, `dostigus_tasks_get`,
  `dostigus_tasks_create`, `dostigus_tasks_update`,
  `dostigus_tasks_transition`
- Tickets: `dostigus_tickets_create`, `dostigus_tickets_update`,
  `dostigus_tickets_list`
- Grill: `dostigus_grills_open`, `dostigus_grills_add_round`,
  `dostigus_grills_get` (with answers), `dostigus_grills_close`
  (outcome)
- Knowledge links: `dostigus_decisions_record`, `dostigus_specs_record`
- Gates: `dostigus_gates_request`, `dostigus_gates_get`
- Runs: `dostigus_runs_start`, `dostigus_runs_get`,
  `dostigus_runs_list`, `dostigus_runs_cancel`
- Audit and Retro: `dostigus_audits_start`, `dostigus_findings_put`,
  `dostigus_retros_put`
- HQ: `dostigus_integrations_list`, `dostigus_integrations_call`
- Release: `dostigus_releases_start`
- Already shipped: `dostigus_messages_create` / `list`,
  `dostigus_artifacts_put`, `dostigus_skills_*`,
  `dostigus_schedules_*`, `dostigus_turns_*`

Context proxy: `dostigus_context_search`,
`dostigus_context_remember`, `dostigus_context_read`,
`dostigus_context_timeline`. The Host adds area `dostigus`, the
bearer from `NUXT_CONTEXT_TOKEN`, and `project` from the Project.
The Architect does not call Context itself. A Gate cannot be passed
through MCP. `gates` only requests. A person decides in the Host.
Approving a proposed fact or decision is a separate Owner click. It
sends `metadata.status: approved`. It does not pass a Gate.

## Slices

Each slice is one or more pull requests. A slice is done when the
criterion holds on a real Project, not when the code has merged.

**S0. Docs reset.** [ADR 0049](adr/0049-dev-factory-direction.md)
through [ADR 0051](adr/0051-architect-context-and-skills.md).
[`CONTEXT.md`](../CONTEXT.md), [`docs/SPEC.md`](SPEC.md), and
[`AGENTS.md`](../AGENTS.md) follow the direction (the blanket ban on
an agent runtime is lifted for these slices; a second agent framework
stays out). Skills under `skills/` with `LICENSE` and `NOTICE.md`.
Context is in the domain model from this slice, as memory used in S1
and S2.
Done: the pull request is merged, `pnpm check` is green, and
[`CONTEXT.md`](../CONTEXT.md) has no fight between Builder, Job, and
Orchestrator. Job is absent.

**S1. Project, board, external Architect, Context binding.** Tables
for Project, Repo link, Commands, Task, Ticket. A Project screen on
the Host, Kit only: a board by status, a Task card with attachments,
Chat with the Architect (bot-thread). MCP tools for the Project,
Tasks, and Tickets. A Project token. The Host has `NUXT_CONTEXT_URL`
and `NUXT_CONTEXT_TOKEN`. The first `remember` creates the Context
project (`--create-projects`) and the Host stores
`contextProjectId`. The external Architect loads a task context pack
through the proxy.
Done: Nick creates the Dostigus Project and three real Tasks on it.
Grok Bot, through MCP, reads them, cuts Tickets, and moves statuses.
From that day Dostigus gets no new GitHub issues. The same Bot reads
a task context pack for the Project through the Host before it cuts
Tickets. It has no Context token of its own.

**S2. Grill, and decisions in Context.** Grill session and questions.
A Sheet of rounds: options on Kit chips, the recommended answer
marked, one control that accepts every recommendation, free text for
another answer. A Chat line when new questions are waiting. Decision
and Spec are links to a pull request. On close with outcome
`proceed`, the Host writes the resulting decision to Context
(`metadata.kind: decision`, proposed immediately, no distill
processor) and a `note` document keyed `grill-<id>`. The Grill
session stays in the Store. The Owner's approve click in the Host
sets `metadata.status: approved` (`--may-approve` on the area token).
Done: one real Dostigus Task goes through at least two rounds in the
UI and produces a merged ADR. Another closes as "not needed". A later
session loads a task context pack through the Host and cites the
merged decision without the old Chat thread.

**S3. Runs through Cursor cloud agents, and Gates.** A runner adapter
for Cursor, the Orchestrator ticker, Gates Approve and Release, a
Task feed (Runs, the pull request, check status from GitHub).
Done: a Ticket from S2 is done by a Cursor agent that Dostigus
started after Approve. The pull request merges after Release. The
Task card shows the whole history.

**S4. The full pipeline.** Stages `checks`, `review` (its own Run on
skill `code-review`), `visual` (preview screenshots as Artifacts on
the Task), the 3-attempt cap, Codex on de2 as the second Builder,
release through Dokploy.
Done: a `feature` Task walks every stage on its own. At least one red
check returns to the Builder and is fixed without Nick. Release
deploys `dostigus.kosarev.space`.

**S5. Inherit, and the Project as HQ.** Connect Inherit: repo,
commands, deploy, one Integration that reads data (metrics or a
database through MCP, read only).
Done: one Inherit Task goes from create to production through
Dostigus. The Architect answers a business question about Inherit's
data and cites the source.

**S6. Audit and Retro.** A Schedule on the Architect runs a weekly
Audit of docs against code. Findings become a Grill for the owner.
A Retro follows each closed Task.
Done: an Audit finds at least one real mismatch, the owner answers
the Grill, and the fix merges. Retros of three Tasks produce at least
one merged improvement (a check, `AGENTS.md`, or a skill).

**S7. Built-in Architect.** The Architect is a Bot on the Host through
Providers, skills from Pack `dostigus.architect`, the same tools
in-process, the same Context project.
Done: one Task on a test Project walks S1–S4 with the built-in
Architect and without Grok Bot.

**MVP done:** for two weeks, all work on Dostigus and Inherit goes
only through Dostigus. No issues filed by hand. Every merged feature
has a Task, a Grill or an explicit skip, Gates, and a Retro.

## Records

Accepted with the direction:

- [ADR 0049](adr/0049-dev-factory-direction.md) — dev factory
  (supersedes the 0040 direction and the 0043 audiences; amends 0005)
- [ADR 0050](adr/0050-dev-factory-domain-model.md) — domain model,
  including Context
- [ADR 0051](adr/0051-architect-context-and-skills.md) — Architect,
  Context from S1/S2, vendored skills

Further titles from the first draft of this plan are proposed, not
written. The index lists them:
[`docs/adr/README.md`](adr/README.md).

## Locked choices

These were open in the draft. The direction accepts them, with one
reversal.

1. **Grill on every Task?** Required for `feature` and `epic`. Short
   for `bug`, and it must include a reproduction. For `quick` the
   Architect may skip, with a written reason, and the business sees a
   "no Grill" flag.
2. **One cloud Cluster on de2, many Projects, no multi-tenant in the
   MVP?** Yes. One Owner (Nick). Other people later, as Members, through
   Invites.
3. **Where does knowledge live?** ADRs, Specs, and the glossary in the
   repo, through pull requests, so agents can read them without
   Dostigus. Tasks, Tickets, Grills, Runs, and Gates in the Store.
   Architect memory in Context, not in the Store.
4. **Architect memory.** A Context instance dedicated to Dostigus,
   from S1 and S2. The Host holds `NUXT_CONTEXT_URL` and one area
   token. The Architect uses the Host proxy. The draft recommended
   waiting, and an earlier note in this plan pointed at a personal
   Context. Both are rejected.
5. **Codex in the first pipeline?** S3 is Cursor cloud agents only.
   Codex on de2 is the second adapter in S4, behind the same Run
   interface.
