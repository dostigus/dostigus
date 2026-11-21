# Architect skills

Vendored instructions for the Project **Architect**. Source, license, and
the one adaptation: [`NOTICE.md`](NOTICE.md). These files are not Cursor
skills for people editing this monorepo (those stay in `.cursor/skills/`).
They ship to the Architect as Pack `dostigus.architect`
([ADR 0051](../docs/adr/0051-architect-context-and-skills.md)). This tree
is the source. The Pack zip is a later slice.

## Binding overlay

Upstream skills assume a glossary file named `GLOSSARY.md` and an issue
tracker (often GitHub). On Dostigus:

- The glossary path is the Repo link `docsLayout`. This Platform uses
  [`CONTEXT.md`](../CONTEXT.md). Do not rename it to `GLOSSARY.md`.
- A **Spec** is a markdown file in the linked repo. The Store keeps the
  path ([ADR 0050](../docs/adr/0050-dev-factory-domain-model.md)).
  `to-spec` upstream publishes to an issue tracker. Do not open a GitHub
  issue. Commit the Spec and record the path.
- `to-tickets` is adapted in-file. Tickets are Dostigus **Tickets** on the
  parent **Task**, not GitHub issues.
- Human **Gates** (Approve, Release) are not tool calls. The Architect
  requests a Gate. A person decides it in the Host.
- Before a Grill session or a Run, the Architect loads a **task context
  pack** from **Context** for that Project
  ([ADR 0051](../docs/adr/0051-architect-context-and-skills.md)).

## Run stages

Grill is not a Stage. It happens on the Task before the Approve Gate.
`checks`, `visual`, `release`, and `retro` have no skill in this vendor.
`checks` runs the Repo link **Commands**. `visual` stores screenshot
**Artifacts**. `release` is the Release Gate, then merge and deploy.
`retro` is upstream skill `retro`, not vendored yet.

| Skill | When the Architect uses it |
| --- | --- |
| `grill-me` | Alias. Calls `grilling`. |
| `grilling` | Grill session. Rounds, options, a recommended answer. |
| `grill-with-docs` | Grill session while writing ADRs and the glossary. Calls `grilling` and `domain-modeling`. |
| `domain-modeling` | Stage `plan`. Sharpen terms. Write the glossary and ADRs. |
| `to-spec` | Stage `plan`. Write the Spec into the linked repo. |
| `to-tickets` | Stage `plan`. Cut Tickets on the Task. Adapted. |
| `prototype` | Stage `plan`, when a throwaway prototype would settle a design question. |
| `implement` | Stage `implement`. |
| `tdd` | Stage `implement`. Required on mode `bug` (a failing test first). |
| `diagnosing-bugs` | Stage `implement` on mode `bug`, when the failure is not yet reproduced. |
| `code-review` | Stage `review`. A separate Run from `implement`. |
| `handoff` | Between Runs, when a fresh Builder must continue the Task. |

Not vendored in this slice, named by the MVP plan for later: `codebase-design`, `implement-spec`, `wayfinder`, `pr`, `retro`, `to-questionnaire`, `software-factory`.
