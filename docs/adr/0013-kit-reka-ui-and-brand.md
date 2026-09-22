# ADR 0013: Kit on Reka UI, Sheet shell, and Brand

- Status: accepted
- Date: 2026-09-22

Create Bot no longer uses `KitDialog`. See
[ADR 0019](0019-bot-picker-and-chat-purpose.md).

## Decision

The Kit (`@dostigus/ui-kit`) sits on [Reka UI](https://github.com/unovue/reka-ui)
(`reka-ui` Vue primitives) and the Host tokens in [`docs/ui.md`](../ui.md):
`#121212` / `#F25630` / Nunito / card radii. Reka stays headless. Color,
radius, and type come from those tokens. The Host font stays Nunito.

A thin **Sheet shell** (`SheetShell`) wraps Reka `Dialog`. Two styled
wrappers set the Sheet kind:

- `KitSheet` — drawer (bottom Sheet)
- `KitDialog` — modal (centered Sheet)

`KitButton` is the styled action (`solid`, `ghost`, `icon`).

**Brand** files live only under `packages/ui-kit/assets/brand/`. The sixteen
PNGs are the ones supplied for this change. No extra poses.

| Role | File |
|------|------|
| Favicon source | `goose-favicon-full.png` |
| App logo | `goose-logo.png` |
| Banner | `goose-logo-banner.png` |
| Stickers | `confused`, `heart`, `notes`, `ok`, `peek`, `point`, `sleep`, `think`, `wave`, `work`, `wow` |
| Sticker variants | `head`, `logo-full` |

`GooseSticker` and `GooseLogo` are the Kit API. Paths are `/brand/...`.
Nitro serves `assets/brand` at `/brand`, so the Host does not keep a second
copy under `public/`. Favicon 32, `.ico`, and apple-touch 180 are resized
from `goose-favicon-full.png` into `assets/brand/favicon/`.

This change does not restyle the Host. It proves the Kit on:

- the Host mark (`goose-logo.png` via `GooseLogo`, including sign-in)
- the empty Bots state (`wave` sticker, `KitButton`)
- Create Bot (`KitDialog`)
- Add Member (`KitSheet` on Members)

The Members Store routes are unchanged ([ADR 0012](0012-household-members.md)).

## Context

[ADR 0002](0002-host-ui-kit-and-sheets.md) left the Kit barrel empty
(`uiKitComponents = {}`). Sheets need one accessible shell instead of a new
overlay on every screen. Brand art needs one home so the Host imports it
from the Kit.

Add Member was an inline form. It is the first real Sheet: same fields,
same route, presented by the Sheet shell.

## Consequences

- `reka-ui` is a dependency of the Kit and of the Host. Host screens import
  Kit components, not Reka parts.
- New Sheets use `KitSheet` or `KitDialog`. Do not add another overlay for
  the same job.
- Do not add goose poses beyond the supplied files.
- The Kit does not introduce a second color palette. It reads Host tokens.
- Out of this change: wrapping every Reka primitive, a full Host restyle,
  share/invite, and any new Household behavior.

## Alternatives

- Restyle every Host page onto Reka — rejected. One Bot surface and the
  Add Member Sheet prove the shell.
- Copy PNGs only into `apps/web/public` — rejected. The Host would not
  import Brand through the Kit.
- A second component library — rejected. Reka is unstyled and fits the
  tokens already in the Host.
- Leave Add Member as an inline card — rejected. The Sheet shell needs a
  real Host flow, and Add Member is that flow.

## Note (palette)

Host chrome left Day-1 coral `#FF5C35` (cream text). Current Host tokens live
in [`docs/ui.md`](../ui.md): canvas `#121212`, Sheet chrome `#212121`, Chat
`#000000`, content cards `#000000`, accent `#F25630`, white / `#A4A4A4` text,
`--radius-card` ≈ 28px, Chat bubbles `--radius-bubble` ≈ 20px, controls
`--radius` ≈ 12px, and a pill Chat composer. Bot accents
(`--bot-accent-01`…`16`) stay separate from Host `--accent`.
