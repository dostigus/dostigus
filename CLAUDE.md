# Dostigus — Project Conventions

## Monorepo Structure

- `apps/web-app` — Nuxt 4 fullstack app (frontend + Nitro server)
- `packages/database` — Drizzle ORM schema, migrations, database utilities
- pnpm workspaces with catalog-based dependency management
- Namespace: `@dostigus/*`

## Tech Stack

- **Runtime:** Node.js >= 24.14.0, ESM only (`"type": "module"`)
- **Framework:** Nuxt 4 + Vue 3 Composition API + `<script setup>`
- **UI:** Nuxt UI v4 + Tailwind CSS v4
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** nuxt-auth-utils
- **i18n:** @nuxtjs/i18n (ru/en, default: ru, strategy: prefix_except_default)
- **Linting:** ESLint with @antfu/eslint-config
- **Testing:** Vitest (unit), Playwright (e2e)

## Conventions

- Vue SFCs: `<template>` first, then `<script setup>`, then `<style>`
- Brace style: 1tbs, always use curly braces
- Arrow parens: always
- IDs: CUID2 via `@paralleldrive/cuid2`
- Database columns: snake_case, TypeScript: camelCase
- Commits: conventional commits (commitlint enforced)
- Feature flags: `DOSTIGUS_CLOUD=true` for cloud-only features

## Commands

- `pnpm --filter @dostigus/web-app dev` — start dev server
- `pnpm --filter @dostigus/database db:generate` — generate migrations
- `pnpm --filter @dostigus/database db:push` — push schema to DB
- `pnpm --filter @dostigus/database db:studio` — open Drizzle Studio
- `pnpm run lint:fix` — lint and fix
- `pnpm run typecheck` — type check all packages
- `pnpm run test` — run unit tests
- `docker compose up -d` — start dev PostgreSQL
