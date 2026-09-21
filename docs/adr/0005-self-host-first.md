# ADR 0005: Self-host first

- Status: accepted
- Date: 2026-09-21

## Decision

The default product path is self-host: `docker compose up` against
`docker/compose.yml`. Optional managed hosting may come later. Day-1 Cluster
store is Drizzle + SQLite (Postgres later is fine). Household users and
marketplace are not day-1. Public share is narrow object links, not a hosted
multi-tenant cloud.

## Context

Dostigus is an agent OS you run. Cloud-first would invert the trust model
(keys, notes, Bot data). Compose is the smallest honest “run this at home”
surface.

## Consequences

- `docker/compose.yml` stays in-tree as the self-host intent, even while it is
  a stub.
- Do not assume SaaS auth, billing, or a central Bot registry in platform code.
- SQLite is the day-1 store; keep the schema portable enough for Postgres later.
- Household remains a glossary term only until a later ADR.

## Alternatives

- Managed-only — rejected as the default.
- Kubernetes-first — rejected for day-1; compose is enough.
