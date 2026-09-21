# ADR 0001: Platform git vs in-cluster bot packages

- Status: accepted
- Date: 2026-09-21

## Decision

Git is only for the Dostigus platform monorepo. User Bots are not separate git
repos. A Cluster holds bot manifests, Module packages (schema/migrations, MCP
contract, UI kit bindings, `SKILL.md`), the data store, and media/notes.
Clusters export/import Bot packages as objects, not as remotes.

## Context

A git-repo-per-bot model (or a git submodule farm) would make every household
install a VCS workspace. The product is a self-host agent OS: the Cluster is
the unit of data, and a Bot is a portable package inside it.

## Consequences

- This repository stays the platform. Do not add `bots/*` git checkouts.
- Persistence and packaging live in the Cluster Store (`packages/db`).
- Sharing is export/import of packages; public share is narrow object links.
- Contributors edit platform code here; they do not treat a user’s Bot as a PR.

## Alternatives

- One git repo per Bot — rejected; couples users to git and to this org.
- Bots as npm packages on a registry — later maybe; not the Cluster source of truth.
