# ADR 0015: Host desktop shell

- Status: accepted
- Date: 2026-09-22

## Decision

The wide-screen Host keeps the messenger shell from
[ADR 0014](0014-host-messenger-shell.md) and follows Nick’s Grok Bot
layout grammar. Dostigus tokens stay the ones in
[`docs/ui.md`](../ui.md): `#121212`, `#FF5C35`, Nunito, and the Kit on
Reka UI. This is that structure, with Dostigus copy and Brand.

- The sidebar is resizable by dragging its edge. Width is remembered in
  the browser. Dragging below the minimum collapses it to an icon rail
  (avatars, create, and the user button). A control on the edge expands
  it again. Below `52rem` the sidebar stays a drawer with a reopen
  control, as in ADR 0014. The rail is a wide-screen behavior.
- Each Bot row shows an avatar (Manifest shape and color; see
  [ADR 0016](0016-bot-avatar-tokens.md)), the name, and a one-line
  preview of the latest Chat line. Unread stays out of this shell.
- The top of the sidebar is a client-side search field and, for the
  Owner, a small `+` that creates a Bot. Search filters the list already
  loaded. It does not add a route.
- The bottom of the sidebar is a user button (initials and name). Its
  menu opens Settings (`/settings`), Members (`/members`, Owner only),
  and Sign out. Those links leave the sidebar chrome. Settings stays a
  page. Members stays a page.
- Chat has a narrow header. The Bot avatar and name open a right
  `KitSheet` (`edge="end"`): appearance, rename, Model tier from the
  Manifest, and delete. Delete and edits stay with the Owner. A Member
  can open the Sheet and read those fields. Skills and Module packages
  stay out of this Sheet. Appearance detail is in ADR 0016.
- Chat bubbles stay unlabeled. The line still stores `personId` and the
  author's name ([ADR 0012](0012-household-members.md)). Optimistic send
  is unchanged: the user line shows at once, then **Replying…**, then
  the stored reply.
- The composer has a `+` for attachments that stays disabled in this
  change. When the draft has text, a send control appears: an arrow in
  a circle.

Kit stays on Reka UI ([ADR 0013](0013-kit-reka-ui-and-brand.md)). The
right Bot Sheet is `KitSheet`, the same shell as Add Member.

## Context

ADR 0014 put a sidebar beside Chat, with Settings and Members as quiet
links, and made send optimistic. Nick’s next grill asked for the list
grammar from his Grok Bot reference: resize and collapse, avatar plus
name plus preview, search, a user button, a short header that opens Bot
settings, unlabeled bubbles, and a composer whose send control is an
arrow.

## Consequences

- `listBots` includes `lastMessage` (content preview and time) so the
  sidebar can show the latest Chat line without loading every Chat.
  List order stays newest Bot first.
- `KitSheet` accepts `edge="end"` for a right drawer. Add Member stays
  a bottom Sheet.
- Out of this change: file upload, an unread model, token streaming,
  marketplace, and a full Manifest editor.

## Alternatives

- Unread badges in this change — rejected. There is no unread model yet.
- Server search — rejected. The loaded Bot list is enough to filter in
  the Host.
- A full Manifest editor in the right Sheet — rejected. Name, Model
  tier, and delete are the Bot settings for this shell.
- Author labels on bubbles — rejected for this shell. The name stays
  stored on the line.
- A second overlay library for the right panel — rejected. `KitSheet`
  grows an edge.
