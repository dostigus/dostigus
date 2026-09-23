# Host UI tokens

Dark theme default. Font is **Nunito** (headings and body) via `@nuxt/fonts`.
These are Dostigus Host tokens: deep charcoal canvas (`#121212`), Sheet chrome
`#212121`, black Chat pane and content cards, firm coral-orange accent
(`#F25630`), white and muted gray text.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#121212` | Sidebar / app chrome canvas |
| `--bg-chat` | `#000000` | Chat pane background |
| `--surface` | `#262626` | Elevated strips, inner wells, Chat bubbles |
| `--composer` | `color-mix(in srgb, var(--text) 12%, var(--surface))` | Composer fill only. A step lighter than `--surface` |
| `--sheet` | `#212121` | Sliding Sheet chrome (`KitSheet` / `KitDialog`) |
| `--card` | `#000000` | Content cards / page panels on `--bg` |
| `--text` | `#FFFFFF` | Primary copy |
| `--text-muted` | `#A4A4A4` | Secondary copy |
| `--accent` | `#F25630` | Primary actions, `+` create, focus |
| `--live` | `#3DDC84` | Green live dot on a busy Bot avatar |
| `--line` | `#333333` | Quiet borders (slightly lighter than `--surface`) |
| `--line-soft` | `color-mix(in srgb, var(--line) 55%, var(--bg))` (~`#242424`) | Sidebar \| Chat divider, rule above the user button |
| `--radius-card` | `1.75rem` (~28px) | Large card / Sheet corners |
| `--radius-bubble` | `1.25rem` (~20px) | Soft Chat message bubbles |
| `--radius` | `0.75rem` (~12px) | Buttons, inputs, inner chips |

A border on `--surface` (`#262626`) has to be lighter than that fill or it
vanishes. `--line-soft` (~`#242424`, 55% `--line` `#333333` with `--bg`
`#121212`) is darker than `--surface`, so it disappears as an edge on a
`--surface` strip. `--line` (`#333333`) stays visible there.

Day-1 coral `#FF5C35` and cream text are retired; accent is `#F25630`. Canvas
stays deep charcoal `#121212`. Sheet shells use `--sheet` (`#212121`), not
Chat black. See `apps/web/app/assets/css/main.css`.

Shape: large card radii (`--radius-card`), soft messenger bubbles
(`--radius-bubble`), tighter control radii (`--radius`), pill Chat composer
(`border-radius: 9999px`), circular icon buttons, generous padding. The Kit
reads these Host variables. Nunito is inherited from the Host.

The composer is the field itself (`--composer` fill, not global
`--surface`). Its left and right edges share the thread inset
(`1.15rem`), so the block lines up with Chat bubbles. The side margins
are the Chat canvas (`--bg-chat`); only the row paints `--composer`,
so the corners do not pick up a second fill. The field overlays the
Chat pane. That pane is one scroll. A translucent pill (avatar and name)
overlays the top the way the composer overlays the bottom, so messages
can pass behind both. The gap
under the row, including the safe area, has a `--bg-chat` background
fill, so the thread cannot show through that strip. A `--bg-chat` band
the full width of that inset covers only the bottom half of the row
(and a hair past its bottom edge), so the lower corners rest on the
Chat canvas. The top of the row has no second fill. End padding
on the thread matches the overlay, plus `--thread-end-gap` (`5rem`,
~80px), and Chat opens at the bottom so the latest line sits above the
field with that clear space under it. `--thread-top-gap` does the same
job at the top: about the pill’s height (measured from the pill, with a
fallback), so the first line is not flush under the pill when the thread
is scrolled to the top. When the thread is scrolled above
the bottom, a circular control centered on the pane, just above the
field, scrolls to the latest line. Reduced motion jumps without the
smooth scroll. A `1px` edge,
`color-mix(in srgb, var(--text) 8%, var(--composer))`, stays a step
lighter than that fill. One line keeps the full pill radius. Two or
more lines use `--radius-card` (~28px).
The corner eases (~640ms, ease-in-out) from the visible pill into that
radius, and the rim and fill share that timing. Reduced motion snaps. A
transition that starts at `9999px` stays a pill until the last moment, so
it is not a softer ease.

`--bot-accent-01`…`16` are a separate Bot avatar palette — not the Host
`--accent`. See below.

## Bot accent palette

Sixteen accents for Bot avatars (and other UI accents that need this set).
Named CSS tokens in the Kit and Host (`--bot-accent-01` …
`--bot-accent-16`), ordered by hue (color-wheel). Manifest `avatarColor`
stores the hex and resolves by value, not by token index. See
[ADR 0016](adr/0016-bot-avatar-tokens.md) and
[ADR 0018](adr/0018-bot-mark-flock.md). The appearance editor centers
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

## Bot marks — the flock

Kit `KitBotAvatar` draws one of eight birds: `goose`, `duck`, `swan`,
`chick`, `parrot`, `heron`, `puffin`, `owl`. Geometry is data in
`packages/ui-kit/src/bot-marks.ts`, built from named parts — `tail`,
`body`, `belly`, `wing`, `feet`, `crest`, `head`, `beak`, `jaw`, `eyes` —
so motion can target a piece.

All tones derive from the Manifest accent through `botMarkPalette`: the
body is the accent, the wing and tail a shade of it, eye whites and the
puffin chest a warm near-cream, and the bill and feet a warm tone held
apart from the body on every accent.

States: `none` | `idle` | `think` | `reply` | `work` | `greet` | `listen` |
`celebrate` | `error` | `sleep`. `greet` and `celebrate` play once; the
caller returns to `idle` after them.

| State | Host call site |
|-------|----------------|
| `idle` | sidebar rows, Chat pill at rest |
| `greet` | Chat open; the picked bird in the appearance editor |
| `listen` | Chat composer focused |
| `think` | reply in flight — Chat pill and the pending Chat mark |
| `reply` | Chat pill as the reply lands |
| `celebrate` | Chat pill just after the reply finishes |
| `error` | failed send |
| `sleep` | no OpenRouter key, so the Bot cannot answer |
| `work` | Kit only for now |

Under `prefers-reduced-motion` nothing animates, and the states that mean
something hold a static pose instead. Defaults are `goose` and `#1F7AE5`
(`--bot-accent-10`). See [ADR 0018](adr/0018-bot-mark-flock.md).

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
- Empty main pane: `wave` and **Create a Bot** (opens the picker)
- Empty Members: `peek`
- Add Member: `KitSheet` and an `ok` sticker

## Host layout

Wide screens keep a sidebar beside the open page. The seam between them
is `--line-soft` (closer to `--bg` than `--line`). Drag the edge to resize
it. Dragging below the minimum, or the edge control, collapses it to an
icon rail (avatars, the picker control, user button). The width and
collapsed state stay in the browser.

The top of the sidebar is a loupe and a `+`, side by side, both outlined
icon buttons with no accent fill. The `+` opens the Bot picker. The loupe
opens a centered search Sheet titled Поиск: a field, then rows with an
avatar, a name, an optional section tag, one subtitle line, and ⌘1–⌘9 on
the first Bots when the field is empty. Search covers Bot names, Chat
lines, and basic Host settings (Settings, Members, and the open Bot’s
Sheet). With no Bots, that list region centers a short muted
line. The main pane then shows the wave sticker and **Create a Bot**.
The `+` and that button replace the Chat pane with the picker: a **To:**
field across the pane, a **×** on the right of that row, then **Create
new Bot** (plain **+**, Owner only), then existing Bots (mark, name,
latest Chat line). The sidebar stays. **×** and Escape return to the pane
that was open before the picker. Choosing a Bot, creating a Bot, or a
sidebar Bot row also leaves it. The picker search does not create a Bot from the
query. A Member sees search and existing Bots only. Each sidebar row is
an avatar, the Bot name, and a one-line preview of the latest Chat line.
The bottom is a user button, under a `--line-soft` rule. Its mark is a
little smaller than a Bot row avatar and sits on a neutral `--surface`
chip. The name is regular weight and muted.
Its menu opens Settings, Members (Owner), and Sign out. Those links are
not pinned in the sidebar.

Creating a Bot names it **New Bot**, assigns a random flock mark and Bot
accent, and opens that Chat. The first line is a short hello. Until the
first user message, Chat shows a purpose Card on `--sheet`: **What should
this Bot be for?**, chips **Personal**, **Work**, **Learning**, and
**Other**, plus a free-text field. The composer can send the same kind of
line. The answer is a normal user message. The Bot replies on the usual
path (a quiet line when no OpenRouter key is set). Purpose is not stored
on the Manifest.

Chat does not keep a full-width header. A centered pill overlays the pane:
the Bot mark and name on a translucent `--sheet` fill, so the thread can
scroll under it. `--thread-top-gap` pads the thread by about the pill’s
height, so the first line is not flush under the pill when the thread is
at the top. The arrow beside the name is reserved on both sides of the
pill, hidden at rest, so the mark and the name have the same horizontal
inset. Hover or keyboard focus fades the arrow in without moving the name.
The pill opens a right Sheet
(`KitSheet` with `edge="end"`, title Параметры, × in the top-right).
A large Bot mark sits under the title. Hover shows a small rounded
pencil on the mark, which opens a modal: the flock grid, hue-ordered
color swatches with a centered last row, **Reset** («Сбросить»), and
**Save** («Сохранить»). The Sheet fields are name («Имя»), an optional
label («Метка»), and a description («Описание»). Model tier stays on
Host Settings. Delete is not on this Sheet. Members see the mark and
may read the fields. Bubbles
have no author label. The composer stays on screen, over that scroll.
Its placeholder is «Сообщение для» plus the open Bot’s display name.
A `+` on the left is
reserved for attachments and stays disabled. A send arrow in a circle
appears when the draft has text.

Settings is the `/settings` page. Members is the `/members` page. Neither
opens as a Sheet over Chat. Bot settings are the right Sheet above.

Narrow screens (under `52rem`) hide the sidebar behind a Bots control.
The icon rail is a wide-screen behavior.

A sent line appears in the timeline immediately. While that reply is in
flight, Chat shows the Bot’s own flock mark in `think` — there is no text
pill. The Chat pill mark thinks with it, then uses `reply` and a short
`celebrate` when the stored reply lands, then returns to `idle`. A small
green dot (`--live`) sits on the bottom-right of the Chat pill avatar and
the matching sidebar row while the Bot is busy: the reply in flight, the
landing `reply` and `celebrate`, and the short `error` pose. It hides for
`idle`, `sleep`, `listen`, and `greet`. `prefers-reduced-motion` still holds
the pose without animation. Chat does not cover the Host with a spinner.
