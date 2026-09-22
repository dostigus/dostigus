# Host UI tokens

Dark theme default. Font is **Nunito** (headings and body) via `@nuxt/fonts`.
These are Dostigus Host tokens: deep charcoal canvas (`#121212`), Sheet chrome
`#212121`, black Chat pane and content cards, firm coral-orange accent
(`#F25630`), white and muted gray text.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#121212` | Sidebar / app chrome canvas |
| `--bg-chat` | `#000000` | Chat pane background |
| `--surface` | `#262626` | Elevated strips, inner wells, composer chrome |
| `--sheet` | `#212121` | Sliding Sheet chrome (`KitSheet` / `KitDialog`) |
| `--card` | `#000000` | Content cards / page panels on `--bg` |
| `--text` | `#FFFFFF` | Primary copy |
| `--text-muted` | `#A4A4A4` | Secondary copy |
| `--accent` | `#F25630` | Primary actions, `+` create, focus |
| `--line` | `#333333` | Quiet borders (slightly lighter than `--surface`) |
| `--radius-card` | `1.75rem` (~28px) | Large card / Sheet corners |
| `--radius-bubble` | `1.25rem` (~20px) | Soft Chat message bubbles |
| `--radius` | `0.75rem` (~12px) | Buttons, inputs, inner chips |

Day-1 coral `#FF5C35` and cream text are retired; accent is `#F25630`. Canvas
stays deep charcoal `#121212`. Sheet shells use `--sheet` (`#212121`), not
Chat black. See `apps/web/app/assets/css/main.css`.

Shape: large card radii (`--radius-card`), soft messenger bubbles
(`--radius-bubble`), tighter control radii (`--radius`), pill Chat composer
(`border-radius: 9999px`), circular icon buttons, generous padding. The Kit
reads these Host variables. Nunito is inherited from the Host.

`--bot-accent-01`…`16` are a separate Bot avatar palette — not the Host
`--accent`. See below.

## Bot accent palette

Sixteen accents for Bot avatars (and other UI accents that need this set).
Named CSS tokens in the Kit and Host (`--bot-accent-01` …
`--bot-accent-16`), ordered by hue (color-wheel). Manifest `avatarColor`
stores the hex and resolves by value, not by token index. See
[ADR 0016](adr/0016-bot-avatar-tokens.md) and
[ADR 0017](adr/0017-goose-mark-avatar.md). The appearance editor centers
the last incomplete swatch row.

| Token | Hex |
|-------|-----|
| `--bot-accent-01` | `#E47134` |
| `--bot-accent-02` | `#B2774F` |
| `--bot-accent-03` | `#9B8F7E` |
| `--bot-accent-04` | `#D5AC1B` |
| `--bot-accent-05` | `#A0A24F` |
| `--bot-accent-06` | `#73B125` |
| `--bot-accent-07` | `#0AAC7B` |
| `--bot-accent-08` | `#529098` |
| `--bot-accent-09` | `#28A2D6` |
| `--bot-accent-10` | `#1F7AE5` |
| `--bot-accent-11` | `#8190AE` |
| `--bot-accent-12` | `#8354E6` |
| `--bot-accent-13` | `#B656D7` |
| `--bot-accent-14` | `#DC4ACD` |
| `--bot-accent-15` | `#DD547E` |
| `--bot-accent-16` | `#DE3957` |

## Bot Goose marks

Kit `KitBotAvatar` draws eight goose-character silhouettes with named
parts (`body`, `beak`, `eye-l`, `eye-r`): `round`, `tall`, `squat`,
`lean`, `plump`, `chick`, `honk`, `peek`. Body fill is the Manifest
accent; the beak is derived (darker / warmer). States: `none` | `idle` |
`think` | `reply` | `work` — this Host uses `idle` (light breathe) on
sidebar and Chat header. Defaults are `round` and `#1F7AE5`
(`--bot-accent-10`). The Host Bot settings Sheet edits shape and color
for the Owner.

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
(`KitSheet` with `edge="end"`): appearance (**Bot** tab: Goose mark grid
and hue-ordered color swatches with a centered last row, plus **Reset**),
name, Model tier, and delete for the
Owner. Members see the chosen avatar and may read those fields. Bubbles
have no author label. The composer stays on screen. A `+` on the left is
reserved for attachments and stays disabled. A send arrow in a circle
appears when the draft has text.

Settings is the `/settings` page. Members is the `/members` page. Neither
opens as a Sheet over Chat. Bot settings are the right Sheet above.

Narrow screens (under `52rem`) hide the sidebar behind a Bots control.
The icon rail is a wide-screen behavior.

A sent line appears in the timeline immediately. The Bot then shows
**Replying…** until the stored reply replaces it. Chat does not cover the
Host with a spinner.
