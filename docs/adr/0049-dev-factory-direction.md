# ADR 0049: Dev factory direction

- Status: accepted
- Date: 2026-11-21

Supersedes the product direction in
[ADR 0040](0040-collective-host-direction.md) and the audiences in
[ADR 0043](0043-target-personas.md). Amends
[ADR 0005](0005-self-host-first.md): the factory runs as a cloud
Host on de2. Self-host compose stays possible.

One Owner per Cluster stays
[ADR 0010](0010-owner-auth-session.md). Household Members stay
[ADR 0012](0012-household-members.md). Threads and Bot visibility
stay [ADR 0024](0024-threads-and-bot-visibility.md). The Kit, Reka
UI, Brand, and Bot marks stay
[ADR 0002](0002-host-ui-kit-and-sheets.md),
[ADR 0013](0013-kit-reka-ui-and-brand.md), and
[ADR 0018](0018-bot-mark-flock.md). Packs stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md). The domain model
is [ADR 0050](0050-dev-factory-domain-model.md). The Architect is
[ADR 0051](0051-architect-context-and-skills.md).

Nick locked this direction on 2026-11-21. Narrative:
[`docs/vision.md`](../vision.md). Slices:
[`docs/mvp.md`](../mvp.md). This record sets direction only. It
does not add Store tables, routes, or MCP tools.

## Decision

**Dostigus is a cloud dev factory.** Two worlds meet on one Host.

The **business world** is what the Owner sees: Projects, a board of
Tasks, a Grill, a short brief, proofs, and two buttons, **Approve**
and **Release**. The Owner talks to one Bot. They do not see branches,
diffs, or Builders.

The **technical world** is linked repos, Commands, ADRs, Specs, the
glossary, Tickets, Builders, checks, pull requests, and deploy. One
**Architect** per Project runs it.

A **Builder** is a cloud coding agent the Architect starts: a Cursor
cloud agent or Codex. **Run** replaces Job. The **Orchestrator** is
the Host component that accepts triggers and starts Runs. It is not
a routing Bot.

**Case** stays for plain Collective chats (`group` and `room` only).
Project work is a Task, not a Case.

**Kitchen** and **Mailer** are frozen. Their code stays. No new
features.

### Who it is for

1. **Nick as Owner-operator.** First Projects: Dostigus and Inherit.
   Dostigus is, over time, written through Dostigus.
2. A **non-technical product owner** (later): a founder, a manager,
   or a client who knows a board and does not know git.
3. A **small team** (later): the business side and one or two
   technical people on one Project.

[ADR 0043](0043-target-personas.md) led with a Team of 2–15. That
lead is superseded. The Owner-operator comes first.

### Flow

1. The business creates a Task: text, screenshots, links.
2. The Architect picks a mode: `quick`, `bug`, `feature`, or `epic`.
3. **Grill.** Unless the Task is trivial, the Architect asks in
   rounds. Each question has options and one recommended answer.
   The business answers every round. **Task not needed** is a valid
   outcome.
4. The Architect writes decisions into the linked repo (ADR, Spec,
   glossary, Tickets) through a pull request.
5. **Approve.** The business reads a short brief in their language
   and presses Approve.
6. Builders run the Tickets in stages. Red checks or review send the
   Ticket back to implement. Attempts are capped.
7. **Release.** The business looks at the preview and the screenshots
   and presses Release. The Architect merges and deploys.
8. **Retro.** After the Task, the Architect records what the Builders
   hit and turns accepted proposals into Tickets that improve the
   repo (checks, `AGENTS.md`, skills).

### What is different

1. **Grill is mandatory for `feature` and `epic`.** A recommended
   answer is part of every question. Competitors start in the repo.
   A Grill may end with "do not build this".
2. **Audit while nobody is filing Tasks.** On a Schedule, the
   Architect starts an Audit that compares ADRs, Specs, and the
   glossary with the code. A gap becomes a Grill for the Owner. The
   Project does not rot in silence.
3. **One voice for the business.** Only the Architect, Tasks,
   questions, proofs, and buttons.
4. **The Project is the HQ.** Metrics, databases, deploy, and MCP
   servers attach as Integrations. The Architect can answer "how
   many people signed up" from a source it can cite.
5. **Retro is a loop.** Each Task can improve the next one.
6. **Skills live in the repo.** Vendored, no runtime fetch.
   [ADR 0051](0051-architect-context-and-skills.md).

### Where it runs

One Cluster, on de2, through Dokploy, at `dostigus.kosarev.space`.
The Owner is Nick. Several Projects live on that Cluster.
Multi-tenant SaaS, billing, and a hosted identity are not the MVP.
Other people join later as Members through Invites.

[ADR 0005](0005-self-host-first.md) made self-host the default.
That default is amended. The factory's run is this cloud Host.
`docker compose -f docker/compose.yml up` stays a possible way to
run a Cluster. It is not the factory path.

GitHub stays the git host: branches, pull requests, and CI. The
factory does not use GitHub issues. It does not host git.

### Builders

- Cursor cloud agents are the usual Builders. Grok is the default
  model. Opus 5.5 is for a hard Ticket. The Architect starts them
  at effort High.
- Codex on de2 (Astra 6.2) is for the heaviest Ticket, also at
  effort High, and is the second runner (slice S4).
- The Architect picks the Builder per Ticket. Slice S3 is Cursor
  only.

### What stays

The design system does not change. New screens are Kit primitives
on Reka UI (`KitField`, `KitInput`, `KitSelect`, `KitToggle`,
`KitPanel`, and the rest). Brand stays the goose logo and the
stickers. Bot marks stay the eight-bird flock
([ADR 0018](0018-bot-mark-flock.md)). Tokens stay
[`docs/ui.md`](../ui.md). Host Locale stays `en` / `ru`
([ADR 0037](0037-host-ui-i18n.md)).

The running Host stays: Nuxt, the SQLite Store, Owner / Admin /
Member, Invites, Threads, Chat, Skills, Schedules, Wake, the MCP
surface, the Turn journal, Artifacts, Providers, and Model tiers.
A conversation with the Architect is a bot-thread or a room. Audit
and Retro ride a Schedule on the Architect. Screenshot proofs are
Artifacts. The Architect skill set is Pack `dostigus.architect`.

### Out of scope

- A universal platform. The MVP is done when Dostigus and Inherit
  have been run only through Dostigus for two weeks.
- A desktop app or a local CLI. The product is the cloud site.
- OpenSpec, or a spec format of our own. ADRs, Specs, and Tickets
  come from the vendored skills, under the overlay in
  [`skills/README.md`](../../skills/README.md).
- Our own git host. Pull requests, branches, and CI stay on GitHub.
- Our own agent runner. Builders are Cursor cloud agents and Codex.
- CRM, billing, and multi-tenant on the MVP.
- Autopilot. Approve and Release are required.
- Deleting Kitchen or Mailer. They are frozen.
- A custom agent-runtime framework beside the Chat tool loop
  ([ADR 0011](0011-chat-mcp-tool-loop.md)).
- Meal port, in-product Marketplace, Share link, and guests.

## Context

[ADR 0040](0040-collective-host-direction.md) aimed the Host at a
Collective: messenger, personal and shared Bots, and MCP. That
shipped Threads, Case, Admin, Marketplace on the marketing site,
and Mailer. It did not give a non-technical owner a way to take a
product from a sentence to production, and it did not say when the
platform was finished.

The risk named on 13–14 November 2026 still stands: a platform with
no "done". Each MVP slice ends on a real Project (Dostigus first,
then Inherit), not on a merge. Nothing is built ahead of the slice
that is used every day. Slices and done criteria are
[`docs/mvp.md`](../mvp.md).

Ideas are taken from purpleflow (project, commands, task modes,
stages, gates, attempt cap), from mattpocock/skills (Grill, Task,
Run, and the skill files), and from Cursor cloud agents and Codex
as Builders. Linear-shaped boards are familiar. The board here does
the work through the Architect. Generators that emit a new app are
not the job. A Project keeps a living repo.

## Consequences

- Docs only in this record. No Store migration and no Host code.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md). **Builder**,
  **Orchestrator**, and **Run** replace the old Builder / Job
  meanings. **Job** is retired. **Case** is not how a Project
  tracks work. **Kitchen Module** and **Mailer Pack** are frozen.
- [ADR 0040](0040-collective-host-direction.md) and
  [ADR 0043](0043-target-personas.md) stay in the index as
  superseded history. Roles, Threads, Case-on-chat, Marketplace,
  and the Mailer code they cite remain. New product work follows
  this record.
- [ADR 0005](0005-self-host-first.md) stays the compose contract.
  It is not the factory default.
- Agent rules in [`AGENTS.md`](../../AGENTS.md) follow this
  direction. The old ban on "agent runtime" does not block the
  slices in [`docs/mvp.md`](../mvp.md). It still blocks a second
  agent framework and any slice ahead of that plan.
- Follow-up records are listed as proposed in
  [`docs/adr/README.md`](README.md). They are not accepted here.

## Alternatives

- Stay on the Collective Host direction — rejected. Nick replaced
  it on 2026-11-21.
- Keep Team 2–15 as the roadmap lead — rejected with
  [ADR 0043](0043-target-personas.md).
- Self-host as the only factory path — rejected. The factory is the
  cloud Host on de2. Compose remains available.
- Multi-tenant SaaS in the MVP — rejected.
- GitHub issues as the board — rejected. The board is Tasks in the
  Store.
- A Builder that writes Module packages — rejected. That meaning of
  Builder is retired.
- Delete Kitchen and Mailer — rejected. Freeze them.
- Skip the Grill and let Builders start from the raw Task —
  rejected. The Grill is the difference.
- Autopilot through Approve and Release — rejected.
