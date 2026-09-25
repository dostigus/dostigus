# ADR 0022: Chat assistant Markdown body

- Status: accepted
- Date: 2026-09-23
- Amended: 2026-09-24 — Artifact image preview via Kit / session GET is
  [ADR 0034](0034-artifacts.md). Raw `<img>` and Markdown images
  (`![]()`) stay forbidden.
- Amended: 2026-09-25 — GFM tables join the assistant Markdown
  allowlist. Valid GFM only (header row + `|---` separator). A lone or
  malformed `|` stays plain text. A wide table scrolls horizontally in
  the bubble; cell text may wrap. Raw HTML, images, and headings stay
  forbidden.

## Decision

Assistant Chat bubbles render `messages.content` as a safe Markdown subset
through the Kit component `KitMarkdown`. User and system bubbles stay plain
text (`white-space: pre-wrap`, the stored string). The Store column stays a
string. This change does not add `parts[]`, buttons, status chips, or
interactive Cards.

Allowed:

- **bold** and *italic*
- inline `code`
- fenced code blocks: a monospace block, no syntax highlighting. A language
  tag on the fence is ignored
- lists (`-` and numbered)
- links `[text](url)` and bare `http://` / `https://` autolinks
- GFM tables: a header row plus a `|---` separator. The Kit renders a
  real table, not a stacked list

A link uses only the `http:` or `https:` scheme. It opens in a new tab with
`rel="noopener noreferrer"`. `javascript:` and every other scheme stay text
and are not clickable. `www.` hosts and email addresses are not autolinked.

A table is valid GFM only. Without the header + separator pair, a lone or
malformed `|` stays visible plain text. There is no pipe-to-list
heuristic. A wide table scrolls horizontally inside the bubble. Cell
text may wrap. A GFM table in `content` is Markdown, not a Card table
([ADR 0025](0025-chat-bubble-parts.md)).

Outside a fence, a single newline soft-joins and a blank line starts a
paragraph. Inside a fence, newlines stay literal.

Raw HTML, images (`![]()`), headings (`#`), task-list checkboxes,
blockquotes, and strikethrough do not become UI. Allowed parts of the same
line still render. The disallowed markup stays visible text. Raw HTML is
escaped, not executed. An Artifact image preview in the bubble (session
GET, Kit) is [ADR 0034](0034-artifacts.md). That is not Markdown `![]()`
and not a raw `<img>` in `content`.

Bubbles stay unlabeled
([ADR 0015](0015-host-desktop-shell.md)).

## Context

The timeline interpolated `{{ message.content }}` on every role, so an
assistant line showed the markers (`**bold**`, backticks) instead of
formatted text. Nick’s grill on 2026-09-23 locked bold, italic, code,
lists, and http(s) links. Tables stayed off the allowlist.

Nick’s grill on 2026-09-25 moved GFM tables onto the allowlist after
assistant bubbles showed raw pipes for the same syntax other Chat UIs
render as a table.

Chat, Cards, and Sheets come from the Kit
([ADR 0002](0002-host-ui-kit-and-sheets.md)). The messenger shell and
unlabeled bubbles are
[ADR 0014](0014-host-messenger-shell.md) and
[ADR 0015](0015-host-desktop-shell.md). The message route still returns one
finished assistant line
([ADR 0011](0011-chat-mcp-tool-loop.md)).

## Consequences

- `KitMarkdown` lives in the Kit. Host Chat uses it when the role is
  `assistant`. User and system lines keep the plain paragraph.
- `renderChatMarkdown` emits allowlisted tags only (`p`, `strong`, `em`,
  `code`, `pre`, `ul`, `ol`, `li`, `a`, `br`, `table`, `thead`, `tbody`,
  `tr`, `th`, `td`). Anything else falls back to an escaped paragraph.
- A valid GFM table is a real table in the bubble. Overflow is
  horizontal scroll; cell text may wrap.
- No CDN widget. No syntax highlighting and no copy control on code.
- The sidebar preview and Host search keep the stored string. They do not
  render Markdown.
- No change to the message route, the MCP surface, or the LLM prompt.
- Interactive Kit parts on an assistant line are
  [ADR 0025](0025-chat-bubble-parts.md). The content column stays the
  Markdown string. Buttons are not Markdown.
- Artifact thumbs and file chips are
  [ADR 0034](0034-artifacts.md). They are not Markdown images and not
  `parts_json`.

## Alternatives

- Render Markdown for every role — rejected. A user line that contains
  markers stays literal.
- Store `parts[]` or a rich message schema — rejected for this change.
- Syntax highlighting or a copy control on fenced code — rejected for v1.
- Load a Markdown widget from a CDN — rejected. The Kit renders the body.
- Soft-degrade a table to a stacked list — rejected. Valid GFM is a real
  table.
- Heuristic parse of lone or malformed `|` — rejected. That markup stays
  plain text.
- Nested block elements inside cells beyond the current inline subset,
  alignment markers, and Bot system-prompt teaching — out of this amend.
