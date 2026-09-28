# ADR 0013: Kit on Reka UI, Sheet shell, and Brand

- Status: accepted
- Date: 2026-09-22
- Amended: 2026-09-28 — the Kit grows past the Sheet shell, Brand,
  flock, and Markdown into form and surface primitives: `KitPanel`,
  `KitField`, `KitInput`, `KitTextarea`, `KitSelect` (Reka Select),
  `KitToggle` (Reka Switch), `KitChip`, and `KitListRow`. Host screens
  assemble from them instead of page-scoped control CSS. Proof is
  Dashboard → Cluster settings and the Schedule Sheet «Активно»
  switch. See “Form and surface primitives (amend)” below.

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

### Form and surface primitives (amend)

Amended 2026-09-28. The Kit is no longer only the Sheet shell, Brand,
Bot marks, and Markdown. New Host UI assembles from Kit primitives.
Page-scoped CSS for a control the Kit already has is a regression.

Day-1 set, all exported from `@dostigus/ui-kit` and listed in
`uiKitComponents`:

| Component | Primitive | Role |
|-----------|-----------|------|
| `KitPanel` | native | Surface panel on `--card` with `--radius-card`. Optional title (`h2`/`h3`, names the landmark), description, body, and an `actions` footer. `as="form"` keeps submit on the panel. |
| `KitField` | native | Label above the control, helper and error below. Wires `for`, `aria-describedby`, `aria-invalid`, and `required` into the Kit control inside it. |
| `KitInput` | native `input` | Single-line field. Native attributes (`name`, `placeholder`, `autocomplete`) pass through. |
| `KitTextarea` | native `textarea` | Multi-line field, same look as `KitInput`. |
| `KitSelect` | Reka `Select` | Trigger styled as a field, portaled popover of options with a check on the chosen one. |
| `KitToggle` | Reka `Switch` | Switch with an optional clickable label on the same row. On is `--accent`. |
| `KitChip` | native | `span` status label (`neutral`, `ok`, `warn`) or a `button` choice with `selected`. |
| `KitListRow` | native | Leading slot, title, one muted subtitle line, trailing slot. `button`, `a`, or a link component make it pressable. |

Every primitive reads Host tokens from [`docs/ui.md`](../ui.md) through
CSS variables in `packages/ui-kit/src/kit.css`. Focus is a visible
`--accent` / `--accent-dim` ring, hover is a quiet `--line` or
`--text` tint, disabled is dimmed with `not-allowed`, and an invalid
field has an `--accent` edge plus inline error copy. Motion stays at
state changes only (the switch thumb); reduced motion drops it.

`KitPanel` is the page surface, not a **Card**. A Card (and a Chat
Card) stays inline Chat UI rendered by `KitChatParts`, so the panel
does not take the Card name. The Chat part classes are
`.kit-chat-card*`; `.kit-panel*` belongs to `KitPanel`.

Proof: Dashboard → Cluster settings (`/dashboard/cluster`) is built
from `KitPanel`, `KitField`, `KitSelect`, `KitInput`, `KitTextarea`,
`KitChip`, and `KitButton`. The Schedule Sheet «Активно» switch is
`KitToggle`. Routes, field names, and save flows do not change.

Host and Kit UI work loads the Dostigus overlay skill
(`.cursor/skills/dostigus-ui-taste/`) and the vendored Taste v2 skill
(`.cursor/skills/design-taste-frontend/`). Dostigus tokens, this Kit,
Reka, [ADR 0002](0002-host-ui-kit-and-sheets.md), and this record win
over Taste defaults.

## Context

[ADR 0002](0002-host-ui-kit-and-sheets.md) left the Kit barrel empty
(`uiKitComponents = {}`). Sheets need one accessible shell instead of a new
overlay on every screen. Brand art needs one home so the Host imports it
from the Kit.

Add Member was an inline form. It is the first real Sheet: same fields,
same route, presented by the Sheet shell.

### Form and surface primitives (amend)

By 2026-09-28 Dashboard pages (Cluster settings, Members, Providers)
and closet Sheets each carried their own copy of the same field CSS:
a muted label above, a `--bg` fill, a `--line` edge, `--radius`, and a
1px `--accent-dim` focus ring. Buttons, switches, and chips drifted
(`.solid` next to `KitButton`, an off-token green switch). Primitives
in the Kit give those one home, so the next Host screen is assembled,
not restyled.

## Consequences

- `reka-ui` is a dependency of the Kit and of the Host. Host screens import
  Kit components, not Reka parts.
- New Sheets use `KitSheet` or `KitDialog`. Do not add another overlay for
  the same job.
- Do not add goose poses beyond the supplied files.
- The Kit does not introduce a second color palette. It reads Host tokens.
- Out of this change: wrapping every Reka primitive, a full Host restyle,
  share/invite, and any new Household behavior.

### Form and surface primitives (amend)

- New Host forms use `KitField` with a Kit control. New panels use
  `KitPanel`. Host screens still import Kit components, not Reka parts.
- Existing pages move onto the primitives when they are next touched.
  This amend does not migrate Members, Providers, the closet fields, or
  the Host sidebar.
- Dashboard Members and Providers moved onto the primitives in
  [#155](https://github.com/dostigus/dostigus/pull/155).
- `KitMenu` (Reka `DropdownMenu`) waits for its first Host menu
  migration (user menu, `+` menu). Those sit in the Host sidebar, which
  this amend does not restyle.
- `vitest` compiles Kit SFCs with `@vitejs/plugin-vue` and renders them
  with Vue's server renderer. That test checks the Field wiring, the
  Reka roles, and the barrel.
- Out of scope: a full Host restyle, a light theme, a Storybook or Kit
  gallery page (later), Pack HTML `ui/` in the sandboxed iframe
  ([ADR 0039](0039-pack-vs-bot-portable-recipe.md)), a Sheet shell
  rewrite, and Chat messenger chrome (bubbles, composer, pill).

## Alternatives

- Restyle every Host page onto Reka — rejected. One Bot surface and the
  Add Member Sheet prove the shell.
- Copy PNGs only into `apps/web/public` — rejected. The Host would not
  import Brand through the Kit.
- A second component library — rejected. Reka is unstyled and fits the
  tokens already in the Host.
- Leave Add Member as an inline card — rejected. The Sheet shell needs a
  real Host flow, and Add Member is that flow.

### Form and surface primitives (amend)

- shadcn-vue, Material, Fluent, or Carbon as the Host foundation —
  rejected. Each brings its own palette, radii, and type, and a second
  styling system next to Host tokens.
- Tailwind utilities in the Host — rejected. The Host is Nuxt plus Kit
  CSS variables; one styling path.
- Keep page-scoped control CSS and only document the pattern —
  rejected. The copies had already drifted.
- Migrate every Host page in the same change — rejected. One Dashboard
  page and one Sheet control prove the primitives at low risk.

## Note (palette)

Host chrome left Day-1 coral `#FF5C35` (cream text). Current Host tokens live
in [`docs/ui.md`](../ui.md): canvas `#121212`, Sheet chrome `#212121`, Chat
`#000000`, content cards `#000000`, accent `#F25630`, white / `#A4A4A4` text,
`--radius-card` ≈ 28px, Chat bubbles `--radius-bubble` ≈ 20px, controls
`--radius` ≈ 12px, and a pill Chat composer. Bot accents
(`--bot-accent-01`…`16`) stay separate from Host `--accent`.
