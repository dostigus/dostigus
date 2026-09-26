# ADR 0015: Host desktop shell

- Status: accepted
- Date: 2026-09-22

Amended 2026-09-23: the sidebar search field is a loupe that opens a
centered search Sheet (Bots, Chat lines, and Host settings). The `+` stays
a quiet icon button beside it and still opens the Bot picker. Chat no
longer keeps a full-width header bar. A translucent pill (avatar and name)
overlays the thread; hover shows an arrow; the pill opens the same right
Bot Sheet. A top inset keeps the first line clear of the pill.

Amended 2026-09-23: on the icon rail the loupe and `+` stack above the
user mark (loupe, `+`, user), and each Bot hit target is a square. The
expanded sidebar keeps the loupe and `+` at the top, beside each other.
The search Sheet is a bare field — a loupe and the placeholder Поиск —
with no title and no close control. Escape, the overlay, and a chosen
row dismiss it. The Chat pill’s rest inset is a little wider on both
sides.

Amended 2026-09-24: the sidebar `+` opens one menu. Find or create a
Bot, a direct message, and «Создать групповой чат» live there. That
item is the only group create entry. People alone store a `group`. At
least one Bot stores a `room`. The Owner starts Add Member (Invite or a
password) from that menu as well as from Members. The rail is loupe,
`+`, then the user. There is no third create control on that rail. The
picker lists Household people and Bots the current person can already
open. Creating the chat does not grant a Bot. See
[ADR 0024](0024-threads-and-bot-visibility.md).

Amended 2026-09-26: the user-menu **Members** item opens
`/dashboard/members` inside Dashboard
([ADR 0038](0038-dashboard-chrome.md)). Old `/members` bookmarks
404.

The sidebar `+` opens that menu. Find or create a Bot is one item and
still opens the picker. See
[ADR 0019](0019-bot-picker-and-chat-purpose.md).

## Decision

The wide-screen Host keeps the messenger shell from
[ADR 0014](0014-host-messenger-shell.md) and follows Nick’s Grok Bot
layout grammar. Dostigus tokens stay the ones in
[`docs/ui.md`](../ui.md): `#121212`, `#F25630`, Nunito, and the Kit on
Reka UI. This is that structure, with Dostigus copy and Brand.

- The sidebar is resizable by dragging its edge. Width is remembered in
  the browser. Dragging below the minimum collapses it to an icon rail
  (avatars, create, and the user button). A control on the edge expands
  it again. Below `52rem` the sidebar stays a drawer with a reopen
  control, as in ADR 0014. The rail is a wide-screen behavior.
- Each Bot row shows an avatar (Manifest shape and color; see
  [ADR 0016](0016-bot-avatar-tokens.md)), the name, and a one-line
  preview of the latest Chat line. Unread stays out of this shell.
- The top of the expanded sidebar is a loupe and a `+`, both quiet icon
  buttons with no accent fill. On the icon rail those two controls leave
  the top and stack above the user mark: loupe, `+`, then the user. Each
  Bot hit target on that rail is a square. The loupe opens a centered
  search Sheet (`KitDialog`) with no title and no close control: a field
  with a loupe and the placeholder Поиск, then the loaded Bot list, Chat
  lines in the Store, and Host settings that person can open (Settings
  and Members for the Owner, and the open Bot’s Sheet). Escape, the
  overlay, and choosing a row dismiss it. Choosing a row navigates or
  opens that Sheet. It does not create a Bot and it does not add a route.
  The `+` opens the Bot picker.
- The bottom of the expanded sidebar is a user button (initials and name).
  Its menu opens Settings (`/dashboard/settings`), Members
  (`/dashboard/members`, Owner only), and Sign out. Those links leave
  the sidebar chrome. Settings and Members are Dashboard pages
  ([ADR 0038](0038-dashboard-chrome.md)).
- Chat has no full-width header bar. A centered pill overlays the thread:
  the Bot avatar and name. The thread scrolls under the translucent pill.
  A top inset, about the pill height, keeps the first line clear when the
  thread is at the top. At rest the pill is the mark and the name, with
  the same inset on both sides, a little wider than a tight crop. Hover
  fades an arrow in and the pill grows wider to fit it. The pill opens a right
  `KitSheet` (`edge="end"`). What that Sheet holds now is
  [ADR 0020](0020-bot-closet.md): name, optional label, description, and
  a modal for the Bot mark. Model tier stays on Host Settings. Delete is
  not on this Sheet. Edits stay with the Owner. A Member can open the
  Sheet and read those fields. Skills and Module packages stay out.
  Appearance detail is in ADR 0016 and ADR 0020.
- Chat bubbles stay unlabeled. Assistant lines use `KitMarkdown`
  ([ADR 0022](0022-chat-assistant-markdown.md)) and may show Kit parts
  under that body ([ADR 0025](0025-chat-bubble-parts.md)). User and
  system lines stay plain text. The line still stores `personId` and the
  author's name ([ADR 0012](0012-household-members.md)). Optimistic send
  keeps the same timing: the user line shows at once, then the activity row
  from [ADR 0021](0021-chat-activity-status.md) while a configured reply is
  in flight (the flock mark when no key is set), then the stored reply. A green live
  dot marks that Bot on the Chat pill and the matching sidebar row for
  the busy window.
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
- A full Manifest editor in the right Sheet — rejected. This shell kept
  name, Model tier, and delete. [ADR 0020](0020-bot-closet.md) later
  drops Model tier and delete from that Sheet.
- Author labels on bubbles — rejected for this shell. The name stays
  stored on the line.
- A second overlay library for the right panel — rejected. `KitSheet`
  grows an edge.
