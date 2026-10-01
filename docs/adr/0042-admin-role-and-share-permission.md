# ADR 0042: Admin role and share permission

- Status: accepted
- Date: 2026-10-01
- Amended: 2026-10-01 — Admin day-to-day / Owner keys and
  destroy is the ops split in
  [ADR 0043](0043-target-personas.md).

Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). One Owner per
Cluster stays [ADR 0010](0010-owner-auth-session.md). Household
Members stay [ADR 0012](0012-household-members.md). Threads and
Bot visibility stay [ADR 0024](0024-threads-and-bot-visibility.md).
Case stays [ADR 0041](0041-case-lite-on-thread.md). Packs stay
[ADR 0039](0039-pack-vs-bot-portable-recipe.md). This record does
not change [SPEC](../SPEC.md) "This Host" runtime, the Store, or
Host code.

Nick locked the decisions below on 2026-10-01.

## Decision

v1 roles are **Owner**, **Admin**, and **Member**. The Cluster
keeps exactly one Owner. An Admin is not a second Owner.

### Store

`members.role` is `admin` | `member`. A new Member row is
`member`. The Owner is not a `members` row. The Owner stays the
[ADR 0010](0010-owner-auth-session.md) session on `owners`. There
is no separate roles table.

The implementation PR adds `members.role` through the usual
six-edit Store path. This record does not.

### What Admin may open

An Admin may open:

| Surface | What they may do |
| --- | --- |
| Dashboard | Read Overview (`/dashboard`) and use Dashboard chrome |
| Providers / LLM | Open `/dashboard/providers` and use that LLM Settings surface |
| Members | List Members and create an Invite |

An Admin may not:

- Destroy the Cluster
- Transfer Owner
- Wipe the Store
- Promote or demote another Admin

Account Settings (`/dashboard/settings`) and Cluster settings
writes (timezone, Cluster http allowlist) stay Owner.
[ADR 0038](0038-dashboard-chrome.md) chrome stays. A Member with
role `member` still does not open Dashboard.

### Promote and demote

Only the Owner sets `members.role`. An Admin cannot appoint
another Admin.

### Share Bots

The Owner and an Admin may grant or revoke on any Bot, to any
Member. A Member may grant or revoke only a Bot they created
(the creator rights
[ADR 0024](0024-threads-and-bot-visibility.md) already ships).
A Member does not grant someone else's shared Bot. A grantee
who is not the creator, the Owner, or an Admin cannot re-share.

Owner always-see on every Bot stays Owner. Admin is not a
silent participant on every bot-thread. Delete of a Bot they
did not create stays Owner (plus the creator). The
implementation PR may list Cluster Bots so an Admin can grant
them.

### Create Bots and Pack Apply

An Admin creates Bots the way the Owner does: a personal Bot,
then share for the Collective. An Admin may Apply a Pack the
same way the Owner does
([ADR 0039](0039-pack-vs-bot-portable-recipe.md)).

### Case and Rooms

Case `PATCH` and roster add stay any person Participant
([ADR 0041](0041-case-lite-on-thread.md),
[ADR 0024](0024-threads-and-bot-visibility.md)). Admin does not
gate Thread ops.

### UI (later implementation)

Document intent only. This PR does not ship UI.

On the Members list (`/dashboard/members`):

- The Owner sees make Admin and remove Admin.
- An Admin sees a role chip only.

Household → Collective UI copy is not this record. That rename
is a later copy PR.

### Host gates (implementation PR)

Owner-only today is `requireOwnerSession` / `withOwnerStore`.
When this record is implemented, Providers, Members list /
Invite, and Dashboard Overview accept the Owner or an Admin.
Promote and demote stay `requireOwnerSession`. Bot list and
Chat stay `requireHostSession` / `withHostStore`. Do not add a
second auth error type. Keep `OwnerAuthError` / `StoreError`
mapping.

## Context

[ADR 0040](0040-collective-host-direction.md) named the three
v1 roles and left the share permission, Store shape, and which
Owner-only surfaces an Admin opens to this record. Putting
Admin on `owners` would drop the singleton Owner guarantee
([ADR 0010](0010-owner-auth-session.md)). A roles table would
split one flag off the Member row that already exists
([ADR 0012](0012-household-members.md)).

A Member already grants a Bot they created. The missing lock
is that they must not re-share someone else's shared Bot, and
that an Admin may share any Bot for the Collective. Case and
roster already use the person-Participant gate. Waiting to
narrow those would block work that does not need an Admin.

## Consequences

- Docs only. No Store migration, route, Host UI, or MCP surface
  change in this record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) updates **Admin**,
  **Member**, **shared Bot**, **Invite**, **Dashboard**, and
  **Collective**.
- [ADR 0040](0040-collective-host-direction.md) now points here
  for roles and the share permission.
- [ADR 0041](0041-case-lite-on-thread.md) keeps any person
  Participant. This record does not add an Admin gate.
- SPEC "In scope" lists Admin as accepted direction, not in
  this Host yet. The SPEC "This Host" Store list and Owner
  gates stay unchanged until the implementation PR. That PR
  adds `members.role`, the Owner-or-Admin gates, promote /
  demote, share checks, and the Members-list UI.
- Household → Collective Host copy stays a later PR.
- An arbitrary permission matrix, a second Owner, Admin
  appointing Admins, and hard-delete of a Member stay later
  or rejected as below.

## Alternatives

- Admin as a second Owner or an `owners` row — rejected. One
  Owner. Admin is a `members.role`.
- A `members.role` value `owner` — rejected. The Owner is not
  a `members` row.
- A separate roles table — rejected. One column on `members`.
- Admin promotes or demotes Admins — rejected. Owner only.
- A Member re-shares someone else's shared Bot — rejected.
  Creator rights only.
- Admin-only Case `PATCH` or roster add — rejected. Any person
  Participant.
- Admin destroys the Cluster, transfers Owner, or wipes the
  Store — rejected.
- Household → Collective UI copy in this PR — rejected. Later
  copy PR.
- An arbitrary permission matrix in v1 — rejected.
  [ADR 0040](0040-collective-host-direction.md): three roles
  first.
