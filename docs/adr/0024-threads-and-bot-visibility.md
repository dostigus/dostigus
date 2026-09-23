# ADR 0024: Threads and Bot visibility

- Status: accepted
- Date: 2026-09-23

Household accounts stay [ADR 0012](0012-household-members.md). Invites
stay [ADR 0023](0023-household-member-invites.md). This record leaves
the running Host as it is. It settles the Thread model and Bot
visibility for the milestones below.

## Decision

### Cluster

One Cluster is one Household. There is no Org entity.

### Bot visibility

A Bot has visibility `shared` or `private`. A `shared` Bot is visible
to the Household. A `private` Bot is visible to its creator and to the
Owner.

The Owner creates Bots. The default is `shared`. The Owner has CRUD on
a shared Bot and on a Bot the Owner created, and may flip visibility
either way. A flip keeps the creator.

A Member creates only a `private` Bot. That Member may edit its
Manifest and delete it. Only the Owner flips a `private` Bot to
`shared`.

The Owner sees every Member `private` Bot in the list and may open it.
That open is the Member's bot-thread with that Bot. The `private` Bot
has that one bot-thread.

Turning off a Member's sign-in leaves their `private` Bots in place.
The Owner still sees them. Lines keep `personId` and the author's name
([ADR 0012](0012-household-members.md)).

A `private` Bot cannot join a room. The Owner flips it to `shared`
before it can sit with other people. Its only Thread until then is the
bot-thread with the person who created it.

### Thread

One Thread has participants and Chat lines. A participant is a person
(the Owner or a Member) or a Bot. Kinds are labels, not separate
products:

| Kind | Participants |
|------|----------------|
| `dm` | one person and another person |
| `group` | people |
| `bot` | one person and one Bot (a bot-thread) |
| `room` | people and at least one Bot |

Chat between people (`dm`, `group`, and a `room`) belongs to this
model. Current Host code does not build it yet.

A `shared` Bot is a Bot each person can open. It is not one
Household-wide timeline. Each person has their own bot-thread with that
Bot: participants `{that person, that Bot}`. A `room` is the Thread
that places a Bot with more than one person.

In a `room`, a Bot replies on an explicit mention or invocation. The
default stops there. A later `listen=all` mode is outside this
decision.

The Owner and Members may create a `dm`, a `group`, or a `room`.
Adding a Bot requires that every participant can see that Bot. A
`shared` Bot meets that. A `private` Bot stays off the room.

The Owner opening a `shared` Bot uses the Owner's own bot-thread with
it. In this version the Owner's open of a `shared` Bot stays on that
bot-thread. Other Members' bot-threads with the same Bot stay theirs.

### Module data

Module package data, including CRM-shaped records, lives in the Cluster
Store. Bot visibility says who may open the Bot. The same Store holds
the data either way. A `private` Bot uses the same Module packages and
the same MCP surface under that person's permissions. A per-bot private
data store is later Module policy.

### Host navigation

The target sidebar is a Threads inbox. The Bot list and the picker stay
how a person finds and creates a Bot. Until `dm` and `group` ship, the
Host may stay Bot-centric.

## Context

[ADR 0012](0012-household-members.md) put Members on one Host with one
Chat timeline per Bot. The Owner alone creates and deletes Bots in that
slice. [ADR 0023](0023-household-member-invites.md) adds a Member by
Invite. An Invite creates a Member. It is not a Share link, and it does
not flip Bot visibility.

The grill on 2026-09-23 settled a messenger-shaped Cluster: people talk
with people and with Bots, a `shared` Bot still has a separate
bot-thread per person, and a `private` Bot stays with its creator while
the Owner can see it.

Today every Chat line is a `messages` row on a Bot. A Host user line
stores `personId`. Assistant and system lines leave `personId` empty.
A Bearer `/mcp` write may also leave `personId` empty
([ADR 0012](0012-household-members.md)).

## Consequences

Docs only. The Store, the Host, and Chat routes stay as they are.
Current Host behavior remains ADR 0012 and ADR 0023.

Later implementation, in order:

1. Interactive bubble parts and a Kitchen Module demo.
2. Bot visibility and per-person bot-threads.
3. `dm`, `group`, and `room`.

Milestone 2 places existing `messages` rows onto bot-threads. Per Bot,
in timeline order (`createdAt`, then `id`):

A user row with a `personId` is the key. It is placed on the bot-thread
`{that person, that Bot}`.

One rule covers every other row on that Bot (an assistant line, a
system line, or a user line with no `personId`): place it on the
bot-thread of the nearest preceding user row on that Bot that has a
`personId`. When no such row precedes it, place it on the Owner's
bot-thread for that Bot. Each existing row is placed on one bot-thread.
The leading greeting is an assistant row with nothing before it, so
this rule puts that greeting on the Owner's bot-thread.

Outside these milestones: SMTP, guests, Share link, and any role
besides Owner and Member. No Org entity. Milestone 3 is the messenger
UI for `dm`, `group`, and `room`; this ADR does not build it.

## Alternatives

- One Household-wide timeline per `shared` Bot — rejected. Each person
  has a bot-thread. A room is the Thread with a Bot and more than one
  person.
- A Member flips `private` to `shared` — rejected. The Owner flips
  visibility.
- A `private` Bot in a room — rejected. Share it first.
- Bot visibility as a second Store — rejected. Module data stays in the
  Cluster Store.
- An Org above the Household — rejected. One Cluster is one Household.
- Separate products for `dm`, `group`, `bot`, and `room` — rejected.
  One Thread. The kind is a label.
- The Owner opens another Member's bot-thread on a `shared` Bot —
  rejected for this version. The Owner uses their own bot-thread.
- A Bot replies to every room line — rejected as the default. Reply on
  mention or invocation. `listen=all` is later.
