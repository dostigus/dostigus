# ADR 0001: Platform git vs in-cluster bot packages

- Status: accepted
- Date: 2026-09-21
- Amended: 2026-09-26 — Export / import of a portable recipe is a
  **Pack** (share / Marketplace / git). Host → Host migrate is a
  **Bot backup**. Pack ≠ Bot ≠ Module package. See
  [ADR 0039](0039-pack-vs-bot-portable-recipe.md).

## Decision

Git is only for the Dostigus platform monorepo. User Bots are not separate git
repos. A Cluster holds bot manifests, Module packages (schema/migrations, MCP
contract, UI kit bindings, `SKILL.md`), the data store, and media/notes.
Clusters export/import those objects, not as remotes.

A shareable recipe is a **Pack**. A Host → Host migrate artifact is a
**Bot backup**. Neither is a Module package. [ADR 0039](0039-pack-vs-bot-portable-recipe.md)
owns that split.

## Context

A git-repo-per-bot model (or a git submodule farm) would make every household
install a VCS workspace. The product is a self-host agent OS: the Cluster is
the unit of data. A Bot is the runtime identity inside it. A Pack is the
portable recipe you share. A Module package is the heavier declarative unit.

## Consequences

- This repository stays the platform. Do not add `bots/*` git checkouts.
- Persistence and packaging live in the Cluster Store (`packages/db`).
- Sharing a recipe is Export Pack / Pack Apply; migrate is Export Bot
  backup. Public share stays narrow object links.
- Contributors edit platform code here; they do not treat a user’s Bot as a PR.

## Alternatives

- One git repo per Bot — rejected; couples users to git and to this org.
- Bots as npm packages on a registry — later maybe; not the Cluster source of truth.
