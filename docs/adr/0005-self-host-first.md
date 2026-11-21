# ADR 0005: Self-host first

- Status: accepted
- Date: 2026-09-21
- Amended: 2026-11-21 — The dev factory runs as a cloud Host on de2
  (`dostigus.kosarev.space`, Dokploy). Compose below stays a possible
  Cluster. It is not the factory default. See
  [ADR 0049](0049-dev-factory-direction.md). Multi-tenant SaaS, billing,
  and a hosted identity stay out.

## Decision

The factory's run is the cloud Host on de2
([ADR 0049](0049-dev-factory-direction.md)). Self-host remains possible:
`docker compose up` against `docker/compose.yml`. The original default
was self-host, with managed hosting later. That default is amended.
Day-1 Cluster store is Drizzle + SQLite (Postgres later is fine).
Household users and marketplace are not day-1. Public share is narrow
object links, not a hosted multi-tenant cloud.

## Context

Dostigus began as an agent OS you run. Cloud-first, for that shape,
would invert the trust model (keys, notes, Bot data). Compose is the
smallest honest “run this at home” surface. The factory in
[ADR 0049](0049-dev-factory-direction.md) is a different default: one
cloud Host Nick operates, still this image and this Store, not a
multi-tenant service. Compose stays for a Cluster that is not that
factory.

## Consequences

- `docker/compose.yml` boots the Host on port 3000 and mounts named volume
  `cluster-data` at `/var/lib/dostigus` for the Store (`DATABASE_URL=file:...`).
  Artifact bytes live on that same volume at
  `/var/lib/dostigus/artifacts/<uuid>`
  ([ADR 0034](0034-artifacts.md)).
- Day-1 image is `ghcr.io/dostigus/dostigus` (see
  [ADR 0007](0007-platform-image-tags.md)).
- Do not assume SaaS auth, billing, or a central Bot registry in platform code.
  The Cluster Owner is a local Store row plus a Host cookie session
  ([ADR 0010](0010-owner-auth-session.md)), not a hosted identity.
- SQLite is the day-1 store; keep the schema portable enough for Postgres later.
- Household Members on one Host are [ADR 0012](0012-household-members.md).
  Share links and guests stay later.

## Alternatives

- Managed-only, with no compose path — rejected. Compose stays.
- Kubernetes-first — rejected for day-1; compose is enough.
- Keeping self-host as the factory default after
  [ADR 0049](0049-dev-factory-direction.md) — rejected. The factory
  runs on de2. Compose remains possible.
