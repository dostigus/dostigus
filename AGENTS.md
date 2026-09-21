# Project memory — Dostigus

## Before you write code

1. Read [`docs/SPEC.md`](docs/SPEC.md) and the ADRs in [`docs/adr/`](docs/adr/).
2. Use glossary terms from [`CONTEXT.md`](CONTEXT.md) only.
   **Cluster, Bot, Module package, Host shell, Sheet, MCP contract, LLM gateway,
   Household.** Do not invent synonyms. All repo docs are **English only** —
   no mixed-language glossary or Russian product names.
3. Stay inside SPEC scope. Do not implement agent runtime, Meal port,
   cloud-agent module writer, marketplace, or Household/auth in this phase.

## Before every commit

From the repo root, **always** run and wait for a green:

```
pnpm check
```

That is `lint` → typecheck → vitest → build. Land a clean tree before
`git commit`. Prefer `pnpm check:full` (`lint:fix` first) if style nits fire.

- Never `--no-verify` unless the user explicitly asks.
- Docs-only commits still need a clean working tree if app code changed.

## Local preview (Host shell)

```
pnpm --filter @dostigus/web dev
```

Nuxt 4 on **http://localhost:3000/**. The page is a Host shell stub: chat empty
state + Sheet empty state. Not a landing page.

## Commits

Conventional commits (`feat:`, `docs:`, `fix:`, `chore:`). Do not force-push
`main`.
