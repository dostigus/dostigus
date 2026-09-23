# ADR 0022: Chat assistant Markdown body

- Status: accepted
- Date: 2026-09-23

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

A link uses only the `http:` or `https:` scheme. It opens in a new tab with
`rel="noopener noreferrer"`. `javascript:` and every other scheme stay text
and are not clickable. `www.` hosts and email addresses are not autolinked.

Outside a fence, a single newline soft-joins and a blank line starts a
paragraph. Inside a fence, newlines stay literal.

Raw HTML, tables, images (`![]()`), headings (`#`), task-list checkboxes,
blockquotes, and strikethrough do not become UI. Allowed parts of the same
line still render. The disallowed markup stays visible text. Raw HTML is
escaped, not executed.

Bubbles stay unlabeled
([ADR 0015](0015-host-desktop-shell.md)).

## Context

The timeline interpolated `{{ message.content }}` on every role, so an
assistant line showed the markers (`**bold**`, backticks) instead of
formatted text. Nick’s grill on 2026-09-23 locked the subset above.

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
  `code`, `pre`, `ul`, `ol`, `li`, `a`, `br`). Anything else falls back to
  an escaped paragraph.
- No CDN widget. No syntax highlighting and no copy control on code.
- The sidebar preview and Host search keep the stored string. They do not
  render Markdown.
- No change to the message route, the MCP surface, or the LLM prompt.
- Interactive Kit Cards, buttons, and statuses inside a bubble are a later
  ADR. The content column stays `string`.

## Alternatives

- Render Markdown for every role — rejected. A user line that contains
  markers stays literal.
- Store `parts[]` or a rich message schema — rejected for this change.
- Syntax highlighting or a copy control on fenced code — rejected for v1.
- Load a Markdown widget from a CDN — rejected. The Kit renders the body.
