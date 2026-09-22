# Host UI tokens

Dark theme default. Font is **Nunito** (headings and body) via `@nuxt/fonts`.
These are Dostigus Host tokens: charcoal canvas, coral-orange accent, soft
white and muted gray text, soft UI.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#121212` | Host canvas |
| `--surface` | `#1c1c1c` | Elevated cards, header, composer |
| `--text` | `#f4f1ec` | Primary copy (soft white) |
| `--text-muted` | `#9a958c` | Secondary copy |
| `--accent` | `#ff5c35` | Primary buttons, `+` create |
| `--line` | `#2a2a2a` | Quiet borders |

Shape: large radii (`--radius`), pill primary buttons, circular icon buttons,
generous padding. See `apps/web/app/assets/css/main.css`.

The Kit reads these variables. It does not define a second palette. Nunito
is inherited from the Host.

## Sheet shell

Reka UI `Dialog` is the primitive. The Kit wrappers are:

| Component | Sheet kind | Role |
|-----------|------------|------|
| `SheetShell` | `sheet` or `modal` | Frame: overlay, title, description, Close, body |
| `KitSheet` | drawer | Bottom Sheet, or a right-edge Sheet (`edge="end"`) |
| `KitDialog` | modal | Centered Sheet |
| `KitButton` | — | `solid`, `ghost`, or `icon` |

See [ADR 0013](adr/0013-kit-reka-ui-and-brand.md).

## Brand

Source of truth: `packages/ui-kit/assets/brand/`. The Host serves that
directory at `/brand/`. `GooseLogo` and `GooseSticker` are the Kit API.

| Use | File |
|-----|------|
| App logo | `goose/goose-logo.png` |
| Banner | `goose/goose-logo-banner.png` |
| Favicon source | `goose/goose-favicon-full.png` |
| Favicon 32, `.ico`, apple-touch 180 | `favicon/` (resized from the favicon source) |
| Stickers | `confused`, `heart`, `notes`, `ok`, `peek`, `point`, `sleep`, `think`, `wave`, `work`, `wow` |
| Sticker variants | `head`, `logo-full` |

Do not add poses.

Where the Host uses them today:

- Host mark: goose logo (sign-in)
- Empty Bots: `wave` and **Create a Bot**
- Create Bot: `KitDialog` and an `ok` sticker
- Empty Members: `peek`
- Add Member: `KitSheet` and an `ok` sticker

## Host layout

Wide screens keep a sidebar beside the open page. Drag the edge to resize
it. Dragging below the minimum, or the edge control, collapses it to an
icon rail (avatars, create, user button). The width and collapsed state
stay in the browser.

The top of the sidebar is search and, for the Owner, a small `+`. Search
filters the loaded Bot list. Each row is an avatar, the Bot name, and a
one-line preview of the latest Chat line. The bottom is a user button.
Its menu opens Settings, Members (Owner), and Sign out. Those links are
not pinned in the sidebar.

Chat has a narrow header. The Bot avatar and name open a right Sheet
(`KitSheet` with `edge="end"`): name, Model tier, and delete for the
Owner. Bubbles have no author label. The composer stays on screen. A `+`
on the left is reserved for attachments and stays disabled. A send arrow
in a circle appears when the draft has text.

Settings is the `/settings` page. Members is the `/members` page. Neither
opens as a Sheet over Chat. Bot settings are the right Sheet above.

Narrow screens (under `52rem`) hide the sidebar behind a Bots control.
The icon rail is a wide-screen behavior.

A sent line appears in the timeline immediately. The Bot then shows
**Replying…** until the stored reply replaces it. Chat does not cover the
Host with a spinner.
