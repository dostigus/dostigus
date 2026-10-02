# ADR 0040: Collective Host product direction

- Status: accepted
- Date: 2026-10-01
- Amended: 2026-10-01 — Case-lite Store shape, API, and glossary
  term **Case** are [ADR 0041](0041-case-lite-on-thread.md);
  Admin role, share permission, and Store shape are
  [ADR 0042](0042-admin-role-and-share-permission.md);
  Owner-operator and Team audiences are
  [ADR 0043](0043-target-personas.md);
  Case inbox + follow-up Wakes are
  [ADR 0044](0044-case-inbox-and-follow-up-wakes.md);
  the public Marketplace is
  [ADR 0045](0045-pack-catalog-on-marketing-site.md)
  (`/marketplace`; `/packs` 301; Pro out of the public
  field; Packs first catalog kind);
  Catalog Store and deep-link Apply are
  [ADR 0047](0047-marketplace-catalog-store.md).

Nick locked the direction below on 2026-10-01. This record sets
direction and order only. It does not change [SPEC](../SPEC.md)
scope, the Store, or Host code. Each step below lands in its own
ADR and SPEC row. Self-host first stays
[ADR 0005](0005-self-host-first.md). One Owner per Cluster stays
[ADR 0010](0010-owner-auth-session.md). Members stay
[ADR 0012](0012-household-members.md). Threads and Bot visibility
stay [ADR 0024](0024-threads-and-bot-visibility.md). Packs stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md).

## Decision

**Collective Host** is the product direction name. A Host serves a
**Collective**: the 1…N people on one Cluster. A family, a startup,
and a small enterprise are all a Collective. Positioning is not
family-only. Product copy and ADR titles do not say CRM.

### Shape

The Collective Host is three things on one Host:

| Part | What it is | Today |
| --- | --- | --- |
| Messenger | Threads among people and Bots: `dm`, `group`, `room`, and bot-threads | [ADR 0024](0024-threads-and-bot-visibility.md) |
| Bots | Personal Bots for every person, plus shared Bots | [ADR 0024](0024-threads-and-bot-visibility.md) |
| External systems | Bots reach ticket trackers, feedback inboxes, and infra through MCP or an API | Pack integration stubs ([ADR 0039](0039-pack-vs-bot-portable-recipe.md)); Host HTTP get is GET only ([ADR 0031](0031-host-http-get.md)) |

A sales pipeline stays outside Dostigus. A Bot connects to that
system through its API or MCP server. The Host does not grow deals,
stages, or forecasts.

### Wedge order

1. **Rooms gaps.** Team chat on `group` and `room`, Artifacts on a
   Thread that is not a bot-thread, and `@` Bot mentions. An audit
   of the shipped Host lists the gaps as GitHub issues before any
   implementation.
2. **Case-lite.** A thin layer on one Thread: a status, a label,
   and a next action. It is not a ticket tracker. Store shape,
   API, and the glossary term **Case** are
   [ADR 0041](0041-case-lite-on-thread.md).
3. **Out of v1:** a library or Pages surface (the OpenAI Spaces
   class).

### Roles v1

v1 roles are **Owner**, **Admin**, and **Member**. The Cluster keeps
exactly one Owner. An Admin is not a second Owner. An Admin may
create and share Bots for the Collective. Store shape, share
permission, and which Owner-only surfaces an Admin opens are
[ADR 0042](0042-admin-role-and-share-permission.md). An arbitrary
permission matrix is later.

### Bots

- Every person on the Cluster may have personal Bots. This is
  [ADR 0024](0024-threads-and-bot-visibility.md) today.
- A **shared Bot** is a Bot that someone other than its creator may
  open through a grant. The Owner or an Admin shares a Bot. A Member
  shares only a Bot they created
  ([ADR 0042](0042-admin-role-and-share-permission.md)).
- Bots move between people and Clusters as Packs
  ([ADR 0039](0039-pack-vs-bot-portable-recipe.md)), not by copying
  a Manifest by hand.

### Integrations

MCP comes first. A vertical (support desk, feedback triage, infra
ops) is a Pack: Skills plus integration stubs that name the
external system and its required env names. Platform code does not
marry a vendor. There is no built-in Zendesk, Dokploy, or similar
integration in the Host.

### Monetization

The Host, the README, the docs, and the public site do not
advertise a Pro tier. The public Marketplace is
[ADR 0045](0045-pack-catalog-on-marketing-site.md)
(https://dostigus.ru/marketplace, Host out-link).
Catalog Store and deep-link Apply are
[ADR 0047](0047-marketplace-catalog-store.md). An
in-product Marketplace Apply-from-index is not v1. Packs stay the share
format
([ADR 0039](0039-pack-vs-bot-portable-recipe.md)). The
self-host Cluster stays the default path
([ADR 0005](0005-self-host-first.md)).

### Out of scope for v1

- Library or Pages (the OpenAI Spaces class)
- Sales pipeline
- Light theme
- SaaS multi-tenant cloud

The SPEC out-of-scope list stays in force. This record does not
pull Share link, guests, or an agent runtime into scope.
The public Marketplace is
[ADR 0045](0045-pack-catalog-on-marketing-site.md).
Catalog Store and deep-link Apply are
[ADR 0047](0047-marketplace-catalog-store.md).
Module packages are a later Marketplace kind. Pro stays
out of the public field.

## Context

[ADR 0012](0012-household-members.md) named the people on a Cluster
a Household. That reads as family-only. The same Host already ships
what a small team needs first: Threads with `group` and `room`,
`@` mention replies in a room, Artifacts, personal Bots, and grants.
Calling the direction CRM points at a sales pipeline, which
dedicated tools already do well. The value here is a messenger,
Bots, and MCP in one self-host Cluster.

The wedge order starts nearest shipped code. Rooms exist and have
gaps. Case-lite is a few fields on a Thread that already exists
([ADR 0041](0041-case-lite-on-thread.md)).
A library or Pages surface is a new product area and waits.

## Consequences

- Docs only. No Store migration, route, Host UI, or MCP surface
  change in this record.
- Roles and the share permission are
  [ADR 0042](0042-admin-role-and-share-permission.md). Until that
  implementation PR,
  [ADR 0024](0024-threads-and-bot-visibility.md) creator grant
  rights stay as they are in this Host.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) adds **Collective** and
  **Admin**, defines a shared Bot under Bot visibility, and points
  Household at Collective. Household stays the Store, route, and
  code name (`members`, Household helpers,
  [ADR 0012](0012-household-members.md),
  [ADR 0023](0023-household-member-invites.md)). This record does not
  rename them. Room stays the `room` Thread kind.
- Follow-up: a Rooms gap audit of the shipped Host files GitHub
  issues. That audit is a separate task. This PR has no
  implementation.
- Later records: a Bot connection to an external MCP server. The
  Host has no external MCP client today. Case-lite is
  [ADR 0041](0041-case-lite-on-thread.md). Admin and the share
  permission are
  [ADR 0042](0042-admin-role-and-share-permission.md).
- Later copy: the README tagline and Host strings such as
  "Household on this Host" move to Collective positioning in their
  own PR.

## Alternatives

- Call the direction CRM — rejected. It points at a sales pipeline
  and misnames the product.
- Keep Household-only positioning — rejected. A startup or a small
  enterprise is the same shape on one Cluster.
- Ship a sales pipeline in the Host — rejected. Bots connect to that
  system through its API or MCP server.
- Ship a library or Pages first — rejected for v1. It is a new
  surface. Rooms gaps are nearer shipped code.
- Built-in vendor integrations (Zendesk, Dokploy) — rejected. A
  vertical is a Pack over MCP.
- An arbitrary permission matrix in v1 — rejected. Three roles
  first.
- Exchange Bots by copying a Manifest — rejected. Packs are the
  portable recipe.
- SaaS multi-tenant cloud in v1 — rejected.
  [ADR 0005](0005-self-host-first.md) stays.
- Advertise a Pro tier now — rejected for now.
