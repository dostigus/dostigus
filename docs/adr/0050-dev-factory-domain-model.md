# ADR 0050: Dev factory domain model

- Status: accepted
- Date: 2026-11-21

Direction is [ADR 0049](0049-dev-factory-direction.md). The Architect,
Context, and vendored skills are
[ADR 0051](0051-architect-context-and-skills.md). Case on a Collective
chat stays [ADR 0041](0041-case-lite-on-thread.md). Artifacts stay
[ADR 0034](0034-artifacts.md). Schedules stay
[ADR 0027](0027-bot-schedules.md). Provider key storage is the pattern
for Integration secrets
([ADR 0036](0036-llm-providers-tier-resolve-escalate.md)).

This record names the model. It does not migrate the Store and it does
not add MCP tools. Those land in the slices in
[`docs/mvp.md`](../mvp.md).

## Decision

**Knowledge lives in git. Work lives in the Store. The Architect's
long-term memory lives in Context.**

The linked repo holds ADRs, Specs, and the glossary. Agents read them
from git without the Host. The Store holds the Project, the board, Grill
sessions, Runs, Gates, Audits, Retros, and links to those files. Context
([hmbanan666/context](https://github.com/hmbanan666/context)) holds
facts and decisions for the Project, the project profile, the journal,
and the task context pack. The instance is dedicated to Dostigus. The
Host reaches it through `NUXT_CONTEXT_URL` and `NUXT_CONTEXT_TOKEN`
([ADR 0051](0051-architect-context-and-skills.md)). The Store does not
copy that corpus. It stores the Context project id. Grill sessions,
Runs, and Gates stay Store rows. Context receives the resulting
decision and a `note` document keyed `grill-<id>`.

**Job** is not a term. A unit of business work is a **Task**. A technical
slice of a Task is a **Ticket**. One execution of one Stage is a **Run**.

### Project

`id`, `slug`, `name`, `ownerId`, `architectBotId`, `architectMode`
(`builtin` | `external`), `previewUrl`, `status`, `contextProjectId`.

A Cluster has many Projects. A Project is not a Cluster and not a git
repo. The Architect's Bot mark and avatar come from the Kit.

### Repo link

`projectId`, `provider` (`github`), `fullName`, `defaultBranch`,
`docsLayout` (paths for ADRs, Specs, and the glossary).

One Task touches one repo. GitHub remains the git host. The factory does
not open GitHub issues.

### Commands

On a Repo link: `setup`, `lint`, `test`, `check`, `run`, `preview`.

Builders receive them in the brief. The `checks` Stage runs the same
commands.

### Task

What the business sees. `projectId`, `title`, `body`, attachments
(Artifacts), `mode` (`quick` | `bug` | `feature` | `epic`), `status`,
`createdBy`, `grillPolicy`.

Business statuses: `new` → `grilling` → `awaiting_approval` → `in_work`
→ `awaiting_acceptance` → `released` | `dropped`.

Technical stages live on Runs, not on this status.

### Ticket

A technical slice from `to-tickets`. The business does not see it.
`taskId`, `title`, `brief`, `blockedBy[]`, `builderHint`, `status`.

`to-tickets` writes these rows. It does not open GitHub issues
([`skills/to-tickets/SKILL.md`](../../skills/to-tickets/SKILL.md)).

### Grill session

`projectId`, and either `taskId` or `auditId`, `status` (`open` |
`done`), `outcome` (`proceed` | `drop` | `split` | `needs_research`).

A session is rounds of **Grill questions**: `sessionId`, `round`,
`title`, `body`, `options[]` (`id`, `label`, `consequence`),
`recommendedOptionId`, `recommendationWhy`, `answer` (`optionId` or free
text), `answeredBy`, `answeredAt`.

A round is the whole current frontier. Wording a question so that "yes"
accepts the recommendation matches skill `grilling`. The Host shows
options as Kit chips, marks the recommended option, and can accept every
recommendation in one action. Free text is allowed.

`drop` is "task not needed". That outcome is normal. The Task status
becomes `dropped`.

### Decision and Spec

A **Decision** is a Store link to an ADR in the repo: `projectId`,
`number`, `title`, `path`, `prRef`, optional `taskId`, optional
`grillSessionId`.

A **Spec** is a Store link to a spec file in the repo: `taskId`, `path`,
`prRef`. It is not [`docs/SPEC.md`](../SPEC.md), which is this
Platform's contract.

### Run, Stage, Gate

A **Run** is one Stage, one runner, one attempt. `ticketId` or `taskId`,
`stage`, `runner` (`cursor` | `codex` | `architect`), `model`,
`externalId`, `branch`, `prUrl`, `status` (`queued` | `running` |
`passed` | `failed` | `cancelled`), `attempt`, `startedAt`,
`finishedAt`, `summary`.

**Stages**, in the order a mode uses them: `plan`, `implement`,
`checks`, `review`, `visual`, `release`, `retro`.

| Mode | Grill | Stages after Approve |
| --- | --- | --- |
| `quick` | The Architect may skip it, writes why, and the business sees a "no Grill" flag | `implement`, `checks`, `review` |
| `bug` | Short. A reproduction is required | `implement` (failing test first), `checks`, `review` |
| `feature` | Required | `plan`, `implement`, `checks`, `review`, `visual` |
| `epic` | Required. The outcome is several Tickets with edges | Each Ticket follows `feature` |

A red `checks` or `review` returns the Ticket to `implement`. The cap is
3 attempts. After that the Task returns to the Architect, who chooses
Grill, split, or drop.

A **Gate** is a person's decision: `taskId`, `kind` (`approve` |
`release`), `status`, `decidedBy`, `note`. The next Stage does not start
without the Gate that guards it. Approve guards work after the brief.
Release guards merge and deploy. The MCP surface may request a Gate and
read it. It cannot pass a Gate. A person does that in the Host.

### Audit and Retro

An **Audit** is a scheduled run: `projectId`, `scope` (`docs` | `adr` |
`spec` | `code`), `scheduleId`, `runId`. It produces **Findings**:
`auditId`, `severity`, `claim`, `evidence` (`path`, `line`), `proposal`.

A Finding becomes a Grill question, a Ticket, or is closed.

A **Retro** follows a Task: `taskId`, `observations[]`, `proposals[]`.
A proposal's category is the upstream retro vocabulary: `navigation`,
`checks`, `standards`, `agents_md`, `tools`, `access`. An accepted
proposal becomes a Ticket. Skill `retro` is not in the S0 vendor. The
record is. The skill file can follow later.

### Integration

A connection from the Project to something outside the Host: `projectId`,
`kind` (`mcp` | `http` | `dokploy` | `github`), `name`, `url`,
`secretRef`, `scopes`, `readOnly`.

Secret values stay in the Store, the same way a Provider `apiKey` does.
Callers see names, not values.

Context is not an Integration row. One Host process, one area token,
one URL in env. Every Project on that Cluster uses that instance. The
Project row holds `contextProjectId` only
([ADR 0051](0051-architect-context-and-skills.md)).

### Context memory (not a Store table)

Context stores immutable sources. Facts and decisions are tagged with
the project id. The project profile is a document, `doc.type: profile`,
written through `remember`. Context's tidy writes the weekly
**journal** when it has one. The distill processor may stay off. A
**task context pack** is one `search` with `mode: "pack"` for that
project and a Task query.

Context sizes the pack with `budgetBytes` (512–65536, default 8192). The
factory treats that cap as the N-token budget for the Task. The pack
keeps the profile to about a fifth of the budget, then decisions and
facts ranked for the query (proposed rows stay labelled), then at most
two matching journals and two uncited sources. The Architect loads a
pack at the start of a Grill session and at the start of a Run, through
the Host proxy. Dostigus does not re-host those rows.

Closing a Grill session that proceeds writes the resulting decision
(`metadata.kind: decision`, status proposed until the Owner approves
it in the Host) and a `note` document keyed `grill-<id>`. The Grill
session itself stays in the Store. Slice S2 is done only when a later
session can cite that decision from a pack without rereading the Chat
thread.

## Context

[ADR 0049](0049-dev-factory-direction.md) names the factory and leaves
the nouns to this record. The Russian MVP draft treated Context as a
later Integration. Nick changed that: Context is the Architect's memory
from S1 and S2, on an instance dedicated to Dostigus. It is not a
personal Context and not a per-Project Integration. This record is
that change, together with
[ADR 0051](0051-architect-context-and-skills.md).

Case already exists on Collective chats. Reusing Case for the board
would make a chat status into a tracker. The board is Tasks.

Job meant "run a Builder to emit a Module package". The factory has no
that step. Run is the execution record. Module package Apply stays
later and is not what a Builder does.

## Consequences

- Docs only. Tables, routes, and tools arrive in S1–S6, not here.
- Glossary entries for these nouns are in
  [`CONTEXT.md`](../../CONTEXT.md). Code and UI copy use them and no
  synonyms.
- A Task attachment is an Artifact. There is still no
  `dostigus_artifacts_get`.
- Human Gates stay out of the MCP write path.
- GitHub issues are not a shadow board. A Ticket that exists only on
  GitHub does not exist for the factory.
- [`docs/SPEC.md`](../SPEC.md) "This Host" does not gain these tables
  until the slice that ships them.

## Alternatives

- Store the ADRs and Specs only in the Store — rejected. Agents must
  read them from the repo when Dostigus is down.
- Store distilled facts in the Store and skip Context — rejected for
  the MVP. Context is the memory from S1.
- One word for Task and Ticket — rejected. The business sees Tasks.
  Tickets are the technical cut.
- Keep Job as an alias of Run — rejected. Job is retired.
- Put Project work on a Case — rejected. Case stays on Collective
  chats.
- Let the Architect pass Approve and Release through MCP — rejected.
- Unlimited implement retries — rejected. The cap is 3, then the
  Architect decides.
- Use a personal Context, or store its URL on the Project — rejected.
  One dedicated instance. The URL is `NUXT_CONTEXT_URL`.
- Give the Architect the Context token — rejected. The Host holds
  the area token and injects `project`.
