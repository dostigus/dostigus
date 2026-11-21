# ADR 0052: Project token and Context proxy

- Status: accepted
- Date: 2026-11-21

Direction is [ADR 0049](0049-dev-factory-direction.md). The nouns are
[ADR 0050](0050-dev-factory-domain-model.md). The Architect and the
Context instance are
[ADR 0051](0051-architect-context-and-skills.md). Artifacts stay
[ADR 0034](0034-artifacts.md). This record is the S1 shape those
records left open: how a Project token is stored, which MCP tools it
may call, and how the Host proxies Context.

## Decision

**Slice S1 ships the Project, the board, the Project token, and the
Context proxy.** Grill sessions, Runs, and Gates stay later slices.

### Store

One migration adds `projects`, `project_tokens`, `repo_links`,
`commands`, `tasks`, `tickets`, and `task_artifacts`.

A Project row holds `contextProjectId` (nullable until the first
successful `remember`). `architectMode` is `external` or `builtin`.
S1 creates the Architect as a normal Bot and stores
`architectBotId`. Chat with that Bot is the existing bot-thread.
`builtin` does not start a second runtime.

Project `status` is `active` or `archived`.

S1 keeps one Repo link per Project (`provider` `github`). Commands
are the six strings on that link: `setup`, `lint`, `test`, `check`,
`run`, `preview`.

Task `mode` is `quick`, `bug`, `feature`, or `epic`. Task `status`
is the business list in
[ADR 0050](0050-dev-factory-domain-model.md). `grillPolicy` is
`required` (feature and epic), `short` (bug), or `skipped` (quick,
and only with a written `grillSkipReason`).

Ticket `status` is `ready`, `in_work`, `done`, or `dropped`. `ready`
is what `to-tickets` means by ready for a Run. `blockedBy` is a list
of Ticket ids on the same Task.

A Task attachment is an Artifact join (`task_artifacts`). There is
still no `dostigus_artifacts_get`. Bytes are read through the
existing Host Artifact route.

### Project token

The Owner issues a Project token on the Project screen. The Store
keeps the SHA-256 hex of the token, the same way an Invite keeps a
hash. The raw token is shown once. The Owner can revoke a token.
`NUXT_AGENT_TOKEN` (alias `DOSTIGUS_MCP_TOKEN`) stays the owner
token. It is not stored as a Project token.

On `/mcp`:

- The owner token sets the existing agent gate. It may call every
  tool it can call today, plus the factory tools, for every Project.
- A Project token does not set that gate. Existing Cluster tools
  (Bots, messages, Schedules, and the rest) stay disabled. The
  factory tools below are enabled and forced to that Project. A
  `projectId` for another Project is rejected.

`dostigus_projects_create` is owner-token and Owner-session only. It
is not in the [ADR 0051](0051-architect-context-and-skills.md) list.
S1 needs it so the Host and the owner token can create a Project. A
Project token cannot create one.

Factory tools are not in the Chat tool loop. The built-in Architect
is slice S7.

`dostigus_tasks_transition` may set any business status. The board
and the Architect both move cards. Ticket status changes go through
`dostigus_tickets_update`.

`dostigus_tasks_attach` joins an existing Artifact, or stores one
from `bytesBase64` and joins it.

### Context proxy

The Host reads `NUXT_CONTEXT_URL` and `NUXT_CONTEXT_TOKEN`. The URL
is not final and is not hardcoded. If the URL's path does not already
end in `/mcp`, the client appends `/mcp`. The client speaks MCP
streamable HTTP (initialize, then `tools/call`) and sends the area
token as `Authorization: Bearer`. The Architect never sees that token.

The proxy tools are `dostigus_context_search`,
`dostigus_context_remember`, `dostigus_context_read`, and
`dostigus_context_timeline`. The caller does not send `project`,
`scope`, or the Context bearer. The Host sets `scope` to `dostigus`
and injects `project` from `contextProjectId`.

The first successful `remember` for a Project with no
`contextProjectId` sends `project: [<slug>]` and `projectName`. That
call is what creates the Context project when the area token has
`--create-projects`. The Host then stores the slug as
`contextProjectId`. Search, read, and timeline before that id exists
return a clear error and do not create a project.

A task context pack is `dostigus_context_search` with `mode: "pack"`,
a query, and optional `budgetBytes` from 512 to 65536. Context sizes
the pack in bytes. The factory treats that cap as the N-token budget
at about 4 bytes per token. The Host does not convert the number.

`read` has no `project` argument on Context. The Host rejects a
`profile:` or `doc:` id that names a different Context project.
Other ids are passed through. The area token is cluster-wide. That
limit is upstream.

When either env var is missing, every proxy tool returns the error
`Context not configured`. The Project screen does not call Context
and does not change.

## Context

[ADR 0051](0051-architect-context-and-skills.md) names the Project
token and the four proxy tools and says the record does not implement
them. S1 cannot ship without a stored token, a scope rule that keeps
a Grok Bot inside one Project, and a client that can be tested
without a live Context host. The Context tool schemas this client
calls are the public `search`, `remember`, `read`, and `timeline`
tools on `hmbanan666/context`.

## Consequences

- S1 tables, Owner routes under `/api/projects` and `/api/tasks`,
  the Project board, the factory MCP tools, and the Context client
  land with this record.
- Grill, Decision, Spec, Run, Gate, Audit, Retro, and Integration
  tables do not.
- A Project token cannot pass a Gate, because those tools are not in
  this slice, and a later slice keeps that rule.
- Docs name no Context host.

## Alternatives

- Reuse `NUXT_AGENT_TOKEN` as the Project bearer — rejected. That
  token sees the whole Cluster.
- Put the Context token on the Architect — rejected in
  [ADR 0051](0051-architect-context-and-skills.md).
- Create the Context project when the Host creates the Project —
  rejected. The upstream flag creates a project on `remember`, and
  S1 follows that.
- Add factory tools to the Chat loop in S1 — rejected. The built-in
  Architect is S7.
- Store Task screenshots outside Artifacts — rejected. An attachment
  is an Artifact.
