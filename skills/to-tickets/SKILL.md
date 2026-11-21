---
name: to-tickets
description: Break a plan, spec, or the current conversation into tracer-bullet Tickets on the parent Dostigus Task, each declaring its blocking edges. Dostigus adaptation of mattpocock/skills to-tickets. Does not open GitHub issues.
disable-model-invocation: true
---

> **Dostigus adaptation.** Upstream is https://github.com/mattpocock/skills at `abeeaf95660ba9e8b7c753eb38f441ca707a8823` (2026-11-19), MIT, see [`../LICENSE`](../LICENSE) and [`../NOTICE.md`](../NOTICE.md). Upstream step 5 publishes to GitHub, Linear, or `.scratch/<feature>/issues/`, and tells the agent to run `/setup-matt-pocock-skills` when no tracker is configured. **Do not do that on Dostigus.** Publish **Tickets** on the parent **Task** through the MCP surface (`dostigus_tickets_create`, `dostigus_tickets_update`). Blocking edges are Ticket `blockedBy`. The business-visible unit stays the Task. There is no GitHub issue, no triage label, and no `.scratch` issue file. The rest of this skill (vertical slices, the quiz, the templates) is upstream.

# To Tickets

Break a plan, spec, or conversation into a set of **Tickets** on the parent Task: tracer-bullet vertical slices, each declaring the Tickets that **block** it.

The tracker is Dostigus. Do not run `/setup-matt-pocock-skills`. Do not open a GitHub issue.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the Tickets on the parent Task

Publish the approved breakdown as Dostigus **Tickets** on the parent **Task**. One Ticket per slice, in dependency order (blockers first), so each `blockedBy` can name Tickets that already exist.

- Call `dostigus_tickets_create` (and `dostigus_tickets_update` when an edge changes). `blockedBy` lists the blocking Ticket ids, or is empty when the Ticket can start immediately.
- The Ticket brief is the upstream "What to build" plus acceptance criteria. It is not a GitHub issue body.
- Status is ready for a Run. That is not a GitHub label.
- Do not write `.scratch/**/issues/`. Do not open or edit a GitHub issue, a Linear issue, or any other tracker.
- Do not close or rewrite the parent Task. Tickets hang off it.

Work the **frontier**: any Ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Upstream, for the record, published the same slices to local Markdown files or to GitHub / Linear and applied a `ready-for-agent` label. That publish path is not used here.

The Ticket brief uses the upstream shape. Parent is the Task id, not a GitHub issue. `blockedBy` is the edge list. Status ready for a Run replaces the upstream `ready-for-agent` label.

<ticket-brief>

## Parent

The parent Task id.

## What to build

The end-to-end behaviour this Ticket makes work, from the user's perspective, not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- Each blocking Ticket id, or "None (can start immediately)".

</ticket-brief>

Upstream also had a local-file template (`# <NN>: <Ticket title>`, status `ready-for-agent`) and an issue template whose parent was a tracker issue. Do not write those files and do not open that issue.

Avoid specific file paths or code snippets: they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.
