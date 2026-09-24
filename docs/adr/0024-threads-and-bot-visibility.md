# ADR 0024: Threads and Bot visibility

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24

Household accounts stay [ADR 0012](0012-household-members.md). Invites
stay [ADR 0023](0023-household-member-invites.md). This record settles
the Thread model and who may open a Bot.

Amended 2026-09-24. The Bot visibility section below is the access
model: a personal Bot plus explicit grants. It supersedes
household-wide visibility `shared` | `private`. The grants milestone
is in the Host. `bot_grants` is the access check. Migration
`0013_bot_grants` copies each former `shared` Bot into one grant per
Member row that existed then, including a disabled Member, and skips
the creator. The Owner is not a grant row. A former `private` Bot gets
no grant rows. That migration then drops `bots.visibility`.

## Decision

### Cluster

One Cluster is one Household. There is no Org entity.

### Bot visibility

A Bot is personal to its creator. Another person sees it by an
explicit grant, or because they are the Owner. The paragraphs in this
section are what the Host does.

Every new Bot is personal to its creator. Other Members see it only
after a grant.

Who can see a Bot: the creator; the Owner always, including a
Member-created Bot they were never granted; plus explicit per-person
grants. A grant is one row, `bot_id` and `person_id`. A Bot has no
flag that stays shared with all future Members.

"All current Members" is a one-shot batch grant to Members who exist
now. A later Invite does not receive those Bots. Someone grants again.

Who may grant or revoke: the Owner, on any Bot; the creator, on their
own Bot. A grantee cannot re-share unless they are also the Owner or
the creator under those rules.

Revoke cuts list and open for that person. Store rows stay, including
that person's bot-thread messages. Same spirit as keeping data when
the old model flipped a Bot to `private`.

A Bot may be added to a room only when every person participant
already has access (creator, Owner, or a grant). Adding the Bot does
not grant access.

The creator and the Owner may edit the Manifest (name, avatar, Skills,
modules, description, and the rest of that definition). A grantee chats
on their own bot-thread, and uses Module Store under existing Module
rules. Chat does not write the Manifest from learning. The Owner Chat
tool loop may update a Bot. A grantee's Chat must not. A Member who
created the Bot receives Manifest update and Skills tools on that Bot
([ADR 0028](0028-bot-self-settings-via-chat.md)). Delete follows the
same actors as Manifest edit: the creator and the Owner. A grantee
does not delete the Bot.

The first open for a grantee is an empty bot-thread plus the normal
Host greeting. The Host does not copy the Owner's history, or anyone
else's. The Owner's first open of a Bot they did not create follows
the same rule on the Owner's own bot-thread.

A joint conversation is a `room` (people and a Bot). Personal use is
that person's own bot-thread. A person does not keep a private write
on a shared chat timeline.

Module package data stays in one Cluster Store for the Household. Bot
access does not partition that Store. A per-bot private Store is later
Module policy.

This ADR does not add a Bot fork or clone (copy Skills without memory).

Out of scope: durable memory across bot-threads; Skill proposals from
grantees; a Bot fork or clone; peeking another person's bot-thread on
a granted Bot; auto-grant when a Bot is added to a room; auto-grant to
a future Invite; roles beyond Owner and Member.

Turning off a Member's sign-in leaves their Bots in place. The Owner
still sees them. Lines keep `personId` and the author's name
([ADR 0012](0012-household-members.md)). Grant rows and bot-thread
rows stay.

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
model. The Host already builds those kinds. This amendment does not
remove them.

Each person who can open a Bot has their own bot-thread with that Bot.
Participants are `{that person, that Bot}`.
A `room` is the Thread that places a Bot with more than one person.

In a `room`, a Bot replies on an explicit mention or invocation. The
default stops there. A later `listen=all` mode is outside this
decision.

The Owner and Members may create a `dm`, a `group`, or a `room`.
Adding a Bot requires that every person participant already has
access. The add does not grant that access.

Opening a Bot uses the opener's own bot-thread. The Owner's open stays
on the Owner's bot-thread, including a Bot a Member created. Another
person's bot-thread on that Bot stays theirs.

### Module data

Module package data, including CRM-shaped records, lives in the Cluster
Store. Who may open a Bot is separate. The same Store holds the data
either way. A personal Bot uses the same Module packages and the same
MCP surface under that person's permissions. A per-bot private data
store is later Module policy.

### Host navigation

The sidebar is a Threads inbox. The Bot list and the picker stay
how a person finds and creates a Bot. `dm`, `group`, and `room` are
in the Host. A room adds a Bot only when every person participant
can already open it. The Owner's inbox lists every Bot, including a
Member-created Bot they have not opened yet. That row is their own
bot-thread. The first open writes the greeting. It does not open
another person's bot-thread.

## Context

[ADR 0012](0012-household-members.md) put Members on one Host with one
Chat timeline per Bot. The Owner alone creates and deletes Bots in that
slice. [ADR 0023](0023-household-member-invites.md) adds a Member by
Invite. An Invite creates a Member. It is not a Share link. It does
not grant Bots.

The grill on 2026-09-23 settled a messenger-shaped Cluster: people talk
with people and with Bots, and each person has their own bot-thread.
That grill used visibility `shared` | `private`. The grill on
2026-09-24 replaces that access section with a personal Bot and
explicit grants.

Before the grants milestone the Host stored that column. An
Owner-created Bot defaulted to `shared`. A Member created only
`private`. Only the Owner flipped visibility. A flip kept the creator.
A Member saw `shared` Bots and their own `private` Bot. The Owner saw
every Bot. The Owner edited a `shared` Bot and a Bot they created. A
Member edited and deleted only their own `private` Bot. The Owner's
open of a Member's `private` Bot read that Member's bot-thread. A
`private` Bot could not join a room. Per-person bot-threads, `dm`,
`group`, and `room` were already in the Host under that check. The
Store had no grant rows. That column is gone.

Today every Chat line is a `messages` row on a Bot. A Host user line
stores `personId`. Assistant and system lines leave `personId` empty.
A Bearer `/mcp` write may also leave `personId` empty
([ADR 0012](0012-household-members.md)).

## Consequences

The grants milestone is in the Host. It keeps Thread kinds, per-person
bot-threads, and mention-gated room replies. It does not add the
out-of-scope list in the Bot visibility section.

Access is the creator, the Owner, and `bot_grants` (`bot_id`,
`person_id`). A new Bot has no grant rows. The creator and the Owner
may edit the Manifest and delete the Bot. A grantee chats on their own
bot-thread. Member Chat does not include Manifest update for a
grantee. Chat self-settings
([ADR 0028](0028-bot-self-settings-via-chat.md)) requires a Member
creator's Chat to include Manifest update and Skills tools on their
own Bot. The Owner Chat tool loop may update any Bot. Grant and revoke are
`GET` and `POST /api/bots/:id/grants` and
`DELETE /api/bots/:id/grants/:personId`. The Owner may grant or revoke
on any Bot. The creator may grant or revoke on their own Bot.
`allCurrentMembers` grants Members who can sign in now. A disabled
Member is not in that batch. A later Invite does not receive those
Bots. Revoke drops list and open and keeps that person's bot-thread
rows.

Migration `0013_bot_grants` is the cutover from `bots.visibility`.
The ADR did not choose that SQL. This milestone does:

- A former `shared` Bot gets one grant per Member row that existed at
  migration, including a disabled Member, except the creator.
- A former `private` Bot gets no grant rows. The creator and the Owner
  still see it.
- The Owner is never a grant row.
- `bots.visibility` is dropped. Host routes no longer read or write it.

The Settings Sheet for the creator or the Owner lists Household
Members and can grant, revoke, or grant every Member who can sign in
now. The Owner's sidebar lists every Bot.

Interactive bubble parts ([ADR 0025](0025-chat-bubble-parts.md)) and
the Kitchen Module day-1 seed ([ADR 0026](0026-kitchen-module-day-1.md))
are in the Host. So are per-person bot-threads and `dm`, `group`, and
`room`, gated by creator, Owner, and grants.

Placement of existing `messages` rows onto bot-threads already landed
with that column. Per Bot, in timeline order (`createdAt`, then `id`):

A user row with a `personId` is the key. It is placed on the bot-thread
`{that person, that Bot}`.

One rule covers every other row on that Bot (an assistant line, a
system line, or a user line with no `personId`): place it on the
bot-thread of the nearest preceding user row on that Bot that has a
`personId`. When no such row precedes it, place it on the Owner's
bot-thread for that Bot. Each existing row is placed on one bot-thread.
The leading greeting is an assistant row with nothing before it, so
this rule puts that greeting on the Owner's bot-thread.

This amendment does not place those rows again. A grantee's first open
is a new empty bot-thread plus the normal Host greeting. The Owner's
first open of a Bot they did not create follows the same rule.

How current `shared` and `private` rows became creator access, Owner
access, and grant rows is migration `0013_bot_grants`, described above.

«Создать групповой чат» on the sidebar `+` is the only group create
entry. The picker lists Household people and Bots the current person
can open. No Bot selected stores a `group`. A Bot can be chosen only
when every selected person can already open it, and that choice stores
a `room`. The create does not write grant rows. Add Member (Invite or a
password) also starts from that menu for the Owner. A direct message
stays on the same menu. There is no separate people-only item and no
separate new-thread control on the rail.

Outside these milestones: SMTP, guests, Share link, and any role
besides Owner and Member. No Org entity. `listen=all` stays later.
Durable memory across bot-threads, Skill proposals from grantees, and
Bot fork or clone stay out.

## Alternatives

- Household-wide visibility `shared` | `private` — superseded on
  2026-09-24. A Bot is personal. Access is the creator, the Owner, and
  explicit grants. Migration `0013_bot_grants` drops the column.
- A flag shared with all future Members — rejected. "All current
  Members" is one batch grant to Members who exist now.
- A grantee re-shares the Bot — rejected. The Owner grants on any Bot.
  The creator grants on their own Bot.
- Auto-grant when a Bot joins a room — rejected. Every person
  participant must already have access.
- Auto-grant on a later Invite — rejected. An Invite creates a Member.
  It does not grant Bots.
- Copy another person's bot-thread on first open — rejected. Empty
  bot-thread plus the normal Host greeting.
- A private write on one shared chat timeline — rejected. A joint
  conversation is a `room`. Personal use is that person's bot-thread.
- The Owner opens another person's bot-thread — rejected. The Owner
  uses their own bot-thread, including on a Bot a Member created.
- One Household-wide timeline per Bot — rejected. Each person with
  access has a bot-thread. A room is the Thread with a Bot and more
  than one person.
- Bot access as a second Store — rejected. Module data stays in the
  Cluster Store.
- A Bot fork or clone — out of this ADR.
- An Org above the Household — rejected. One Cluster is one Household.
- Separate products for `dm`, `group`, `bot`, and `room` — rejected.
  One Thread. The kind is a label.
- A Bot replies to every room line — rejected as the default. Reply on
  mention or invocation. `listen=all` is later.
