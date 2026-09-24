# ADR 0023: Household Member Invites

- Status: accepted
- Date: 2026-09-23

Manual Add Member from [ADR 0012](0012-household-members.md) stays.
This ADR adds an **Invite**: a one-shot link the Owner copies and sends
by hand. SMTP, QR, and username Invites are out of this slice.

## Decision

The Owner creates an Invite on **Members** by entering an email. The Host
stores a hash of a random token, never the raw token. The response
includes the full Invite URL once. A later list does not include it.
Creating again for the same email revokes the outstanding token. The
Owner can revoke a pending Invite, or rotate it (a new token and URL,
the previous one revoked).

The token is one-shot. TTL is 7 days from creation. Expired, used,
revoked, and unknown tokens all show one opaque “link invalid” page with
a link to `/login`. That page does not say whether the email exists.

The Invite URL origin comes from the Owner’s create (or rotate) request:
`https://` plus the first `X-Forwarded-Host` value, or the `Host` header
when that is absent. A loopback host (`localhost`, `127.0.0.1`, `::1`)
uses the request scheme so `nuxt dev` copy-paste stays `http`. There is
no Settings field for a public URL.

An email that already belongs to the Owner, an active Member, or a
disabled Member is **409**. No Invite row is written. Re-inviting a
disabled Member is out of scope. The login stays reserved
([ADR 0012](0012-household-members.md)).

Accept is `GET /invite/<raw-token>` while logged out. A Host session
(Owner or Member) does not accept: the page tells them to sign out and
open the link again, and the accept API refuses that session. The form
shows the reserved email read-only, a display name, and a password with
confirm. Password rules are `parseOwnerPassword`, the same check as
Owner onboarding and manual Add Member.

On success the Host creates a Member (display name, that email, password
hash, `disabledAt` null), marks the Invite used, starts a Member session,
and lands in the Host. A Member may open the Bot list and Chat.
**Members** and Settings stay with the Owner
([ADR 0012](0012-household-members.md)). Bot visibility after accept is
[ADR 0024](0024-threads-and-bot-visibility.md) (amended 2026-09-24).
An Invite creates a Member. It does not grant Bots. "All current
Members" is a one-shot batch grant to Members who exist now. A later
Invite does not receive those Bots. An Invite is not a Share link.
This slice does not add grants.

Manual Add Member stays beside Invite. Adding a Member for an email
revokes any outstanding Invite for that email.

## Context

[ADR 0012](0012-household-members.md) shipped Members the Owner types in
by hand: display name, login, and password. A Household still needs a
way to hand someone a link without SMTP and without the Owner choosing
their password.

A Share link is a narrow public token to one object, not a Household
account. An Invite creates a Member. The words stay distinct
([CONTEXT.md](../../CONTEXT.md)).

The raw token must not sit in the Store. A hash is enough to recognize
the link and cheap to throw away on revoke or rotate.

## Consequences

- Store migration `0008_member_invites`: table `invites` (`id`, unique
  `token_hash`, `email`, `expires_at`, `created_by` Owner id, `created_at`,
  nullable `used_at`, nullable `revoked_at`).
- Owner routes: `POST /api/members/invites`, `GET /api/members/invites`,
  `POST /api/members/invites/:id/revoke`,
  `POST /api/members/invites/:id/rotate`. A Member receives 403.
- Public routes, no Host session: `GET /api/invites/:token` (email when
  the token is still valid) and `POST /api/invites/:token` (accept).
  Logged-out middleware allows `/invite/…`.
- The pending list shows email and expiry for Invites that are not used
  and not revoked, including ones past their expiry, so the Owner can
  revoke or rotate them.
- Out of this slice: SMTP, QR, username Invite, re-invite of a disabled
  Member, OAuth, passkeys, email verify, password reset, a Member
  creating Invites, changing email after accept, team or org CRM, and
  Bot visibility or Threads
  ([ADR 0024](0024-threads-and-bot-visibility.md)). An Invite still does
  not grant Bots.

## Alternatives

- Store the raw token — rejected. A Store copy is a second live link.
- Email the link from the Host — rejected for this slice. No SMTP. The
  Owner copies the URL.
- A Settings field for the public origin — rejected for this slice. The
  create request already carries `Host` / `X-Forwarded-Host`.
- Reuse a disabled Member row on accept — rejected. That re-invite is a
  later decision. Collision is 409.
- Accept while another session is signed in — rejected. The new Member
  would be easy to attach to the wrong cookie.
