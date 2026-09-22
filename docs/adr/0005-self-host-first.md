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

- `docker/compose.yml` boots the Host on port 3000 and mounts named volume
  `cluster-data` at `/var/lib/dostigus` for the Store (`DATABASE_URL=file:...`).
- Day-1 image is `ghcr.io/dostigus/dostigus` (see
  [ADR 0007](0007-platform-image-tags.md)).
- Do not assume SaaS auth, billing, or a central Bot registry in platform code.
  The Cluster Owner is a local Store row plus a Host cookie session
  ([ADR 0010](0010-owner-auth-session.md)), not a hosted identity.
- SQLite is the day-1 store; keep the schema portable enough for Postgres later.
- Household Members on one Host are [ADR 0012](0012-household-members.md).
  Share links and guests stay later.

## Alternatives

- Managed-only — rejected as the default.
- Kubernetes-first — rejected for day-1; compose is enough.
