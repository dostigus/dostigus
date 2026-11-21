# Dostigus: product vision

Accepted direction, 2026-11-21. The decision record is
[ADR 0049](adr/0049-dev-factory-direction.md). The domain model is
[ADR 0050](adr/0050-dev-factory-domain-model.md). The Architect is
[ADR 0051](adr/0051-architect-context-and-skills.md). Slices are
[mvp.md](mvp.md). Glossary: [`CONTEXT.md`](../CONTEXT.md).

## What this is

Dostigus is a cloud dev factory where two worlds meet.

- **Business world.** The Project owner sees Tasks, files new ones,
  attaches screenshots and references, answers questions, approves the
  plan, and accepts the result. They talk to one Bot. They do not see
  code, branches, or agents.
- **Technical world.** Repositories, ADRs, Specs, the glossary, Tickets,
  agents, checks, pull requests, deploy. One Architect runs it.

The bridge is the **Architect**: one standing Bot per Project, with that
Project's memory. The business brings a want. The Architect grills,
writes the decision, starts Builders, brings the result to acceptance,
and ships it.

## Who it is for

1. **Nick as Owner-operator.** First Projects: Dostigus itself, and
   Inherit. Over time Dostigus is written through Dostigus.
2. **A non-technical product owner** (later): a founder, a manager, or
   a client. They know a board. They do not know git.
3. **A small team** (later): the business side and one or two technical
   people on one Project.

## Main flow

1. The business creates a Task: text, screenshots, links.
2. The Architect reads the Task and picks a mode: quick fix, bug,
   feature, or epic.
3. **Grill.** When the Task is not trivial, the Architect asks in
   rounds. Each question has options and a recommended answer. The
   business goes through every round. The outcome may be "task not
   needed". That is a normal outcome.
4. The Architect records decisions: ADR, Spec, glossary, Tickets. All
   of that is committed to the repo through a pull request.
5. **Approve.** The business sees a short brief in their language and
   presses Approve.
6. Builders do the Tickets in stages: implement, checks, review, visual
   proofs as screenshots. Red checks return the work to the Builder.
   Attempts are capped.
7. **Release.** The business looks at the preview and the screenshots
   and presses Release. The Architect merges and deploys.
8. **Retro.** After the Task, the Architect reviews how the Builders
   did and what they hit, and improves the repo's environment: checks,
   `AGENTS.md`, skills.

## How this is different

1. **A Grill with recommended answers is mandatory for a feature or an
   epic.** Others start writing code. We first check that the Task is
   the right Task, and that it is needed. Most Tasks arrive wrong. The
   Grill catches that. "Task not needed" is a successful outcome.
2. **Work continues when nobody is filing Tasks.** On a Schedule the
   Architect starts auditors. They compare ADRs, Specs, and docs with
   the code and look for drift. Where a Grill was skipped, or a Builder
   decided alone, the owner gets a new Grill. The Project does not
   decay.
3. **One voice for the business.** The business does not see a crowd of
   agents. They see the Architect, Tasks, questions, proofs, and
   buttons.
4. **The Project is the HQ.** Metrics, databases, servers, deploy, and
   any MCP server attach to the Project. The Architect can answer "how
   many people signed up" or "do we already have this" and cite the
   source.
5. **Retro is a standing loop.** Each Task can make the next one
   easier.
6. **Skills are ours.** They live in the repo (vendored), with no fetch
   at runtime. We take good skills from outside and fit them to this
   glossary.

## Architect: built-in or external

- **Built-in.** A Bot on the Host. The LLM goes through Providers
  (OpenRouter and others), the same tool loop as Chat
  ([ADR 0011](adr/0011-chat-mcp-tool-loop.md)), plus the Project tools.
- **External.** Any MCP agent. The first is Grok Bot. It calls the
  Host `/mcp` with a Project token. The tools are enough to run the
  Project.

The MVP starts with the external Architect. Grok Bot already grills,
writes ADRs, and starts agents. The built-in Architect is the last
slice.

Long-term memory is **Context**
([hmbanan666/context](https://github.com/hmbanan666/context),
`context.kosarev.space`): distilled facts and decisions tagged with the
Project, a project profile, a journal, and a task context pack inside
a budget. It is in the MVP from S1 and S2
([ADR 0051](adr/0051-architect-context-and-skills.md)), not a later
add-on.

## Builders

- Cursor cloud agents do most of the work (Grok by default, Opus 5.5
  when the Ticket is hard).
- Codex on de2 (Astra 6.2) takes the heaviest Ticket.
- The Architect starts them at effort High and picks the Builder per
  Ticket.

## What we keep

- **The design system does not change.** The Kit on Reka UI, the Sheet
  shell, Brand (goose logo, stickers), Bot marks from the eight-bird
  flock ([ADR 0018](adr/0018-bot-mark-flock.md)), `docs/ui.md` tokens,
  Host Locale `en` / `ru`. New screens are built only from the Kit.
- The Host on Nuxt, the Store on SQLite, Owner / Admin / Member,
  Invites.
- Threads and Chat. The business talks to the Architect on a bot-thread
  or in a room.
- Skills, Schedules, and Wake. Audit and Retro start from a Schedule
  on the Architect.
- The MCP surface at `/mcp`, the Turn journal, Artifacts (screenshots
  and proofs), Providers and Model tiers. The Architect's skills ship
  as Pack `dostigus.architect`.

## Non-goals

- Not a universal platform. The MVP is done when Dostigus and Inherit
  have been run only through Dostigus for two weeks.
- Not a desktop app and not a local CLI. The cloud site only.
- Not OpenSpec and not a spec format of our own. ADRs, Specs, and
  Tickets come from the skills.
- Not our own git host. Pull requests, branches, and CI stay on
  GitHub. We replace issues and the board.
- Not our own agent runner. We use Cursor cloud agents and Codex.
- Not a CRM, not billing, not multi-tenant at the start.
- Not autopilot. Approve and Release are required.
- Kitchen and Mailer are frozen. They are not deleted.

## Sources

| Who | What it is | What we take | What we do instead |
| --- | --- | --- | --- |
| [purpleflow](https://github.com/PurpleSchool/purpleflow) (MIT) | Electron, local Claude / Codex, OpenSpec | A project with commands, task modes, stages and gates, an attempt cap | Cloud, a business layer, Grill, Audit, Retro, deploy |
| [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) | Skills and the language of a software factory | The core skills, Task / Run / runner / trigger, the brakes on a bad start | A product with a business UI, not a folder of files |
| Cursor cloud agents, Codex cloud, Devin, GitHub Copilot agent | Agents on an issue or a prompt | We use them as Builders | No Grill, no business world, no Project memory |
| Linear, Jira, Trello | Trackers | A familiar board and statuses | The board does the work through the Architect |
| Lovable, Bolt, v0 | App generators | A preview the business can look at | We keep a living repo for years |

## Risk

The risk from the 13–14 November discussion still stands: a platform
with no "done". Each MVP slice ends in a checkable action on a real
Project (Dostigus first, then Inherit). We do not build ahead of the
slice that is used every day.
