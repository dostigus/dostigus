# Project memory — Dostigus

## Before you write code

1. Read [`docs/SPEC.md`](docs/SPEC.md) and the ADRs in [`docs/adr/`](docs/adr/).
2. Use glossary terms from [`CONTEXT.md`](CONTEXT.md) only.
   **Dostigus, Platform, Cluster, Owner, Member, Host, Chat, Card, Sheet, Kit,
   Brand, Sticker, Sheet shell, Bot, Orchestrator, Builder, Skill, Manifest,
   Module package, Store, MCP surface, Job, Apply, LLM gateway, Model tier,
   Household, Share link.**
   Prefer **Host** (Host shell is a synonym). Prefer **MCP surface** (MCP
   contract is its interface definition). A Bot is not a Module package. Avoid
   bare “cloud agent” — use Builder. Do not invent synonyms. All repo docs are
   **English only**.
3. Stay inside SPEC scope. Do not implement agent runtime, Meal port, Builder
   Module-package writer, marketplace, Share link, or guests. Household
   Members on one Host are in scope
   ([ADR 0012](docs/adr/0012-household-members.md)): the Owner adds Members;
   Members use Bot list and Chat. Settings, Bot create/delete, and Members
   stay with the Owner. The Cluster has one Owner
   ([ADR 0010](docs/adr/0010-owner-auth-session.md)).

## Before every commit

From the repo root, **always** run and wait for a green:

```
pnpm check
```

That is `lint` → typecheck → vitest → build. Land a clean tree before
`git commit`. Prefer `pnpm check:full` (`lint:fix` first) if style nits fire.

- Never `--no-verify` unless the user explicitly asks.
- Docs-only commits still need a clean working tree if app code changed.

## Local preview (Host)

```
pnpm --filter @dostigus/web dev
```

Nuxt 4 on **http://localhost:3000/**. The Host is a Bot list + Chat. Press
**+** to create a Bot (default **New Bot**). **Settings** holds the Cluster
LLM gateway (base URL + key). Not a landing page. Store is SQLite
(`DATABASE_URL`, default `file:.data/cluster.sqlite` for local dev).
First visit creates the Cluster Owner; later visits sign in. The Owner opens
**Members** to add a Member (display name, email or username, password). A
Member signs in and uses Bot list and Chat. Settings stays with the Owner.
MCP surface
is `/mcp` — set `NUXT_AGENT_TOKEN` (or `DOSTIGUS_MCP_TOKEN`) to enable
HTTP tools; empty token leaves them disabled. That token is not the Owner
session (`NUXT_SESSION_PASSWORD`). Configured Chat invokes the same tool
handlers in-process (no HTTP `/mcp`; delete is not a Chat tool).

Self-host compose (Store volume + published image): see [`docs/deploy.md`](docs/deploy.md).

```
docker compose -f docker/compose.yml up --build
```

## Commits

Conventional commits (`feat:`, `docs:`, `fix:`, `chore:`). Do not force-push
`main`.
