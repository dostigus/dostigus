# ADR 0010: Owner auth and Host session

- Status: accepted
- Date: 2026-09-21

## Decision

A Cluster has exactly one **Owner** on day-1. The Host authenticates that
Owner with `nuxt-auth-utils`: scrypt `hashPassword` / `verifyPassword`, a
sealed cookie session (`setUserSession`, `requireUserSession`,
`useUserSession`), and `NUXT_SESSION_PASSWORD` (≥32 characters) in
production. Fresh Store → `/onboarding` (create the Owner). Later visits →
`/login`. Logged-out clients cannot open Bot list, Chat, Settings, or
mutating Host APIs. Logout clears the session.

The MCP surface at `/mcp` stays Bearer-gated (`NUXT_AGENT_TOKEN` /
`DOSTIGUS_MCP_TOKEN`). It does **not** use the Host Owner session.

## Context

[ADR 0005](0005-self-host-first.md) keeps the Cluster self-hosted. The Host
was open on the LAN until an Owner existed. Household (multi-user) is still
later. Cursor / IDE MCP clients are not the Host browser and already have a
token ([ADR 0009](0009-mcp-toolkit-endpoint.md)). Mixing those would either
expose the cookie session to MCP clients or lock `/mcp` behind a cookie
those clients do not send.

## Consequences

- Store table `owners`: `id`, unique `email` and/or `username`,
  `passwordHash`, `createdAt`, plus a `singleton` unique so only one row
  can exist. Register is allowed only when `count = 0`; `count ≥ 1`
  disables register and leaves login.
- Host middleware sends anonymous visitors to `/onboarding` or `/login`.
  `/api/bots*` and `/api/settings/*` call `requireUserSession` (401 without
  a session). `/health` stays public. `/mcp` stays token-gated and soft
  (no 401).
- Do not implement OAuth, passkeys, email verify, password reset, or
  Household invites in this ADR.

## Alternatives

- Household multi-user now — rejected; one Owner is the day-1 Cluster.
- Gate `/mcp` on the Host cookie — rejected; MCP clients are not the Host.
- Reuse `NUXT_AGENT_TOKEN` as the Owner password — rejected; different
  actors and different failure modes (soft MCP auth vs 401 Host APIs).
