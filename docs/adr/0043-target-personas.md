# ADR 0043: Target personas

- Status: accepted
- Date: 2026-10-01
- Amended: 2026-10-01 — Case inbox + follow-up Wakes are
  [ADR 0044](0044-case-inbox-and-follow-up-wakes.md).
  This record still names the audiences and the
  should-next nodes.

Collective Host direction stays
[ADR 0040](0040-collective-host-direction.md). Case stays
[ADR 0041](0041-case-lite-on-thread.md). Admin and the share
permission stay
[ADR 0042](0042-admin-role-and-share-permission.md). One Owner
per Cluster stays [ADR 0010](0010-owner-auth-session.md).
Household Members stay [ADR 0012](0012-household-members.md).
Threads stay [ADR 0024](0024-threads-and-bot-visibility.md).
This record names who the Host is for. It does not change
[SPEC](../SPEC.md) "This Host" runtime, the Store, or Host
code. It does not implement a Case inbox, follow-up Wakes,
an Admin Cluster Bot list, Member onboarding polish, or an
external MCP client.

Nick locked the decisions below on 2026-10-01.

## Decision

The Host has **two primary audiences**. Both are primary.
Product work **leads with type 2**. Type 1 is the same
Collective with one person, not a second product.

These are Host audiences. They are not a Manifest field
and not the Bot "persona" line in
[`CONTEXT.md`](../../CONTEXT.md).

### Side by side

| | **Owner-operator** (type 1) | **Team** (type 2) |
| --- | --- | --- |
| Size | Collective N=1 | 2–15 people on one Cluster |
| Job | Solo with Bots | Run work in Chat with Bots |
| Shape | Degenerate Collective | Messenger + Bots. CRM-shaped work, not a sales CRM |
| Product lead | Same Host; not the lead story | Leads the roadmap |
| People | The Owner is the only person | Thread / room Participants only. Library later. No People or CRM cards |
| Ops | The Owner is also the operator | Admin day-to-day; Owner keys and destroy only |
| 90-day success | Still a Collective of one until they add Members | Counts when an external Collective has ≥3 Members |

### Owner-operator (type 1)

**Who.** One person runs the Cluster. They create Bots, Chat
on bot-threads, and may never add a Member.

**Job.** Use Bots on a self-host Host without other Members.

**Cluster.** A Collective of N=1. Same roles, same Store,
same Host. Not a "smart home family" story and not a
different SKU.

**What they already have.** Create Bot, Chat, Skills,
Schedules, Pack Apply, Providers. Dashboard stays with the
Owner ([ADR 0038](0038-dashboard-chrome.md)).

**What we do not optimize for them first.** Surfaces that
only pay off at N>1 wait behind the Team fit, except when
they also help the Owner-operator (a Bot, a Schedule, a
Pack).

**Success.** They can run the Cluster alone. Adding a
Member later does not require a new product.

### Team (type 2)

**Who.** 2–15 people on one Cluster: an Owner, often an
Admin, and Members. A startup or a small shop, not a
sales floor.

**Job.** Run work in Chat with Bots. Shared Threads
(`group`, `room`) carry the work. A Case holds status,
label, and next action
([ADR 0041](0041-case-lite-on-thread.md)). Bots join as
Participants.

**Shape.** Messenger + personal and shared Bots. The work
looks like a desk (open loops, follow-ups) and is **not**
a sales CRM. No pipeline. No deal cards. A sales pipeline
stays outside Dostigus
([ADR 0040](0040-collective-host-direction.md)).

**People.** For now, a person on this Cluster is a
Participant on a Thread or a room. A Library of people,
and People or CRM cards, stay later. Out of v1 with
Library / Pages
([ADR 0040](0040-collective-host-direction.md)).

**Ops.** An Admin runs day-to-day (Members, Invites,
Providers, sharing Bots). The Owner keeps keys and
destroy. That split is
[ADR 0042](0042-admin-role-and-share-permission.md).

**Success.** The desk runs in Chat: open Cases, follow-ups,
Bots in the room. The 90-day bar below is this audience.

### Member (type 3)

A Member with role `member` is **secondary**. The Host
serves them (Bot list, Chat, a Bot they created). The
roadmap is not optimized for this audience. Do not
reorder work to make a Member-only surface first.

### Ninety-day success

At least one **external** Collective (not the author's own
Cluster) with at least three Members.

### Next nodes (docs only)

To fit type 2, the next **must-have** is a **Case inbox**
plus **follow-up Wakes**. [ADR 0041](0041-case-lite-on-thread.md)
keeps Case on-thread in this Host; that inbox and those
Wakes are later and get their own ADR. This record does
not implement them.

**Should next:** an Admin Cluster Bot list, and Member
onboarding. [ADR 0042](0042-admin-role-and-share-permission.md)
already allows an Admin to grant any Bot; a Cluster Bot
list is how they find those Bots.

**After the first external Collective:** one external MCP
connection (one MCP). Not before. The Host has no
external MCP client today
([ADR 0040](0040-collective-host-direction.md)).

### Anti-fit

Do not aim the product at:

- A sales CRM or a pipeline
- Multi-tenant SaaS
- "Smart home family" as the main story

A family can still be a Collective
([ADR 0040](0040-collective-host-direction.md)). It is
not the lead story.

### Cadence

Every two weeks: one type-2 end-to-end scenario, and the
question "who are we feeding?" If the answer is not the
Team (or the Owner-operator as Collective N=1), drop or
defer the work.

## Context

[ADR 0040](0040-collective-host-direction.md) named the
Collective Host (messenger + Bots + MCP) and left "who
exactly" open: a family, a startup, and a small
enterprise were all a Collective. [ADR 0041](0041-case-lite-on-thread.md)
put a thin Case on a Thread and deferred the inbox.
[ADR 0042](0042-admin-role-and-share-permission.md) split
Owner and Admin.

Without named audiences, Rooms gaps, Case, and Admin can
drift toward a sales CRM, a consumer family story, or a
Member-only social Host. Nick locked two primary
audiences on 2026-10-01: the Owner-operator and the Team
of 2–15. Product leads with the Team. Type 1 stays a
Collective of one, so we do not fork the Host.

The Team job is to run work in Chat with Bots. That is
why the next node is a Case inbox and follow-up Wakes,
not deal cards and not a Library of people. Ops already
match: Admin day-to-day, Owner keys and destroy.

A 90-day bar of one external Collective with three
Members keeps the lead on type 2. One MCP waits until
that Collective exists, so the first connection is
pulled by a real desk, not a demo.

## Consequences

- Docs only. No Store migration, route, Host UI, or MCP
  surface change in this record.
- Glossary: [`CONTEXT.md`](../../CONTEXT.md) adds
  **Owner-operator** and **Team**, and updates
  **Collective** and **Member**.
- [ADR 0040](0040-collective-host-direction.md),
  [ADR 0041](0041-case-lite-on-thread.md), and
  [ADR 0042](0042-admin-role-and-share-permission.md)
  stay the direction, Case, and roles records. This
  record points at them. It does not replace them.
- SPEC "In scope" names the two audiences. SPEC "This
  Host" gets one sentence. A Case inbox, follow-up
  Wakes, an Admin Cluster Bot list, Member onboarding
  polish, People / CRM cards, and an external MCP
  client stay out of this Host until their own ADRs
  and implementation PRs.
- Product cadence is every two weeks: one Team
  end-to-end scenario and "who are we feeding?"
- Library / Pages, a sales pipeline, light theme, and
  SaaS multi-tenant cloud stay out of v1
  ([ADR 0040](0040-collective-host-direction.md)).

## Alternatives

- Lead with the Owner-operator — rejected. Type 1 is
  Collective N=1. Product leads with type 2.
- Treat type 1 as a different product or Host — rejected.
- Optimize the roadmap for Member (type 3) — rejected.
  Served, not lead.
- People / CRM cards or a Library of people now — rejected.
  Participants on a Thread or room only. Library stays
  later ([ADR 0040](0040-collective-host-direction.md)).
- A sales CRM, pipeline, or deal cards — rejected.
  [ADR 0040](0040-collective-host-direction.md) and
  [ADR 0041](0041-case-lite-on-thread.md): Case is thin;
  Bots reach that class of system through MCP or an API.
- Case inbox and follow-up Wakes in this record — rejected.
  Docs only. [ADR 0041](0041-case-lite-on-thread.md) v1
  stays on-thread.
- One MCP before the first external Collective — rejected.
- Multi-tenant SaaS as the path — rejected.
  [ADR 0005](0005-self-host-first.md) stays.
- "Smart home family" as the main story — rejected.
  Positioning is not family-only
  ([ADR 0040](0040-collective-host-direction.md)).
- Monthly or ad-hoc audience review — rejected. Every
  two weeks.
