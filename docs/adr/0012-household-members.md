# ADR 0012: Household Members on the Host

- Status: accepted
- Date: 2026-09-22

## Decision

A Cluster still has exactly one **Owner** ([ADR 0010](0010-owner-auth-session.md)).
**Household** is that Owner plus zero or more **Members** on the same Host.
A Member is a Household account the Owner creates in the Host: display name,
login (email or username), and password. There is no invite link, QR code,
or email in this slice.

Members sign in with the same `nuxt-auth-utils` sealed cookie as the Owner.
Login accepts either account. Onboarding still creates only the Owner when
the Store is empty. `/mcp` stays Bearer token, not the Host session.

On the Host, a Member may open the Bot list and Chat. Bots are
Cluster-shared. The Owner alone may create or delete a Bot, open
**Members**, or change the LLM gateway in Settings. A Member has no `+`,
no delete, no Members admin, and no Settings.

Owner Chat keeps the full Chat tool surface from
[ADR 0011](0011-chat-mcp-tool-loop.md) (`dostigus_bots_list` / `get` /
`create` / `update` and `dostigus_messages_list` / `create`; delete stays
off Chat). Member Chat may call only `dostigus_messages_list` and
`dostigus_messages_create`. The in-process tool loop refuses every other
tool for a Member session, so the model cannot create or change Bots.

Every Host user message stores `personId`: the Owner id or the Member id.
Assistant and system lines do not. Chat shows the author's display name.
A Member's display name is the name the Owner entered. The Owner's shown
name is their username, otherwise their email. Turning off a Member's
sign-in keeps the row and the name. There is no hard-delete and no
anonymizing in this slice.

## Context

[ADR 0010](0010-owner-auth-session.md) deferred Household. The Host is a
messenger plus Bots, and the LLM gateway is optional, so more than one
person needs a sign-in on one Cluster before share links or guests.

`owners.singleton` is the Store guarantee that there is one Owner. Members
need a display name and a disabled-at timestamp the Owner row does not
have. A new `members` table keeps that guarantee. Putting Members in
`owners` would drop the singleton unique index and name the table wrong.
A combined people table would migrate the Owner row for the same split.

`messages.person_id` points at an Owner id or a Member id. SQLite cannot
foreign-key one column to both tables, so the Store checks the id when a
Host session writes a user message. Bearer `/mcp` has no Host session, so
those writes may leave `personId` empty. The HTTP MCP surface is unchanged.

## Consequences

- Store migration `0003_members`: table `members` (`id`, `display_name`,
  unique `email`, unique `username`, `password_hash`, `created_at`,
  `disabled_at`) and nullable `messages.person_id`.
- Login uniqueness is across the Owner and Members, including a Member
  whose sign-in is off. The login stays reserved.
- A Member with `disabled_at` set cannot sign in. The failure looks like a
  bad password. Chat still resolves their display name from the row.
- Host routes: Bot list, Bot read, and Chat accept an Owner or Member
  session. Bot create, update, and delete, `/api/members`, and
  `/api/settings/*` require the Owner (Member receives 403).
- `/api/chat/ready` returns only whether replies are live, for the Chat
  banner. It does not return the key or the Settings payload.
- Member sessions that are missing or turned off fail the next Host API
  call. The Host then sends them to sign in.
- Out of this slice: person-to-person Chat, Share link, QR guests, invites
  by email, OAuth, passkeys, email verify, password reset, federation,
  Telegram, and any role besides Owner and Member.

## Alternatives

- Role column on `owners` and drop `singleton` — rejected. It weakens the
  one-Owner invariant and stores Members under the wrong name.
- One people table that replaces `owners` — rejected for this slice. More
  migration for the same Owner / Member split.
- Hard-delete a Member — rejected. Chat would lose the author's name.
- Let Member Chat keep Bot tools and hide the buttons only — rejected. The
  tool loop would bypass the Host limits.
