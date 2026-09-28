---
name: dostigus-ui-taste
description: Dostigus Host and Kit UI overlay on Taste v2 (design-taste-frontend). Load before any Host page, Kit component, Sheet, or Dashboard UI change. States where Dostigus tokens, the Kit, Reka UI, and ADR 0002 / ADR 0013 override Taste defaults, and which Taste parts apply to Host product UI.
---

# Dostigus UI taste overlay

Load this file first, then Taste v2 at
[`.cursor/skills/design-taste-frontend/SKILL.md`](../design-taste-frontend/SKILL.md).
Taste is the anti-slop checklist. Dostigus is the design system.

Host source of truth, in precedence order:

1. [`docs/ui.md`](../../../docs/ui.md) tokens: `--bg` `#121212`,
   `--sheet` `#212121`, `--card` / `--bg-chat` `#000000`, `--accent`
   `#F25630`, `--text` / `--text-muted`, `--line`, `--radius-card`,
   `--radius-bubble`, `--radius`. Font is Nunito.
2. The Kit in `packages/ui-kit` (`kit.css`, `KitButton`, `KitPanel`,
   `KitField`, `KitInput`, `KitTextarea`, `KitSelect`, `KitToggle`,
   `KitChip`, `KitListRow`, the Sheet shell, Brand, Bot marks).
3. Reka UI under the Kit. Host screens import Kit components, not Reka
   parts.
4. [ADR 0002](../../../docs/adr/0002-host-ui-kit-and-sheets.md) and
   [ADR 0013](../../../docs/adr/0013-kit-reka-ui-and-brand.md), plus the
   shell records they link (0014, 0015, 0038).
5. Taste v2, only where it does not conflict with 1 to 4.

Terms come from [`CONTEXT.md`](../../../CONTEXT.md). `KitPanel` is the
page surface; a **Card** is inline Chat UI (`KitChatParts`).

## Design Read (every UI change)

Taste §0.B. State this line before code, then proceed:

> Reading this as: Dostigus Host product UI for household Owners,
> charcoal messenger language, leaning toward existing Kit + Reka +
> docs/ui.md tokens (Taste anti-slop only).

Dials (Taste §1): `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 3`,
`VISUAL_DENSITY: 5`.

## Never

- shadcn / shadcn-vue, Material, Fluent, Carbon, Polaris, Radix Themes,
  or any other kit as the Host foundation (Taste §2.A, Appendix A).
- Tailwind, Next, React, Motion, or GSAP. The Host is Nuxt 4 plus Kit
  CSS variables.
- A light theme or a `prefers-color-scheme` switch. The Host is
  charcoal only.
- A new font, a second accent, or a new palette. Bot accents
  (`--bot-accent-*`) are for Bot marks only.
- Page-scoped CSS for a control the Kit already has. Extend the Kit.
- Restyling Chat messenger chrome (bubbles, composer, pill, sidebar)
  unless the task names it.

## Where Dostigus overrides Taste

| Taste rule | Dostigus rule |
|------------|---------------|
| §8.B / §9.A no pure `#000000` or `#ffffff` | `--card`, `--bg-chat` are `#000000` and `--text` is `#ffffff` by `docs/ui.md`. Keep them. |
| §6.C / §8 design both modes | Charcoal only. |
| §4.1 font picks | Nunito. |
| §9.E icon library, no hand-rolled SVG | Bot marks are Kit data ([ADR 0018](../../../docs/adr/0018-bot-mark-flock.md)); Brand art is `packages/ui-kit/assets/brand/` only. Draw small glyphs (chevron, check) in CSS or reuse Host SVGs. Do not add an icon package without an ADR. |
| §1 baseline dials `8 / 6 / 4` | `4 / 3 / 5`. |
| §13 dashboards are out of scope | The Host is product UI. Apply only the subset below. Skip hero, marquee, bento, logo wall, and landing-page rules. |
| §9.G em-dash ban | Applies to visible Host copy (Locale dictionary values) you add or touch. Repo docs are not UI copy. |

## Taste parts that apply

- **§11 Redesign audit, mode "Redesign - Preserve".** Before touching a
  screen, list its tokens, radii, spacing, the patterns to keep, and the
  drift to retire (off-token colors, copied control CSS, `.solid` next
  to `KitButton`). §11.F holds: do not silently change routes, form
  field `name`s or order, nav labels, or Brand.
- **Color lock (§4.2).** One accent, `--accent`. Status green is
  `--live`. No other hues in chrome.
- **Shape lock (§4.4), documented mixed system.** Panels and Sheets
  `--radius-card`; Chat bubbles `--radius-bubble`; fields, selects,
  buttons, rows, options `--radius`; chips, `sm` buttons, switches,
  icon buttons, and the composer are pills.
- **Theme lock (§4.11).** One charcoal theme on every surface.
- **States (§4.5).** Hover, `:focus-visible`, disabled, pending copy
  («Saving…»), empty, and inline error for every control.
- **Forms (§4.6).** `KitField`: label above, helper and error below. No
  placeholder as the label.
- **AI tells (§9).** No glows, gradient text, eyebrow labels, decorative
  dots, generic names, filler verbs, or em-dashes in UI copy.
- **Motion (§6.A, §6.B).** State changes only, `transform` / `opacity`,
  and a `prefers-reduced-motion` override.

## Kit first

1. Look in `packages/ui-kit/src/index.ts` for the control.
2. If it is missing, add it to the Kit: SFC under `src/components/`,
   styles in `kit.css` on Host variables, export from `index.ts`, a
   `uiKitComponents` entry, and a render test in
   `packages/ui-kit/tests/unit/`. Then use it from the Host.
3. Record a new primitive in ADR 0013 and `docs/ui.md`.

## Pre-flight (adapted Taste §14)

- [ ] Design Read line stated; dials `4 / 3 / 5`.
- [ ] §11 audit done; routes, field names, and nav labels unchanged.
- [ ] Only Host tokens; one accent; charcoal only.
- [ ] Radii follow the shape rule above.
- [ ] Every control has hover, focus-visible, disabled, and error states.
- [ ] Labels above fields; helper and error below; contrast passes WCAG AA
      on `--card`, `--sheet`, and `--bg`.
- [ ] No page-scoped copy of a Kit control's CSS.
- [ ] No em-dash in Locale dictionary values you touched.
- [ ] Reduced motion honored.
- [ ] `CI=1 pnpm check` green; screenshot with `pnpm shoot:preview` when
      a named state covers the screen.

## Upstream Taste v2

Vendored from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)
(`skills/taste-skill/SKILL.md`, [tasteskill.dev](https://www.tasteskill.dev/)).
Do not edit it; put Dostigus rules here. ESLint ignores that directory.
To update, run from the repo root, then move the result:

```
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend --agent cursor --copy -y
rm -rf .cursor/skills/design-taste-frontend
mv .agents/skills/design-taste-frontend .cursor/skills/
rmdir .agents/skills .agents && rm skills-lock.json
```

The CLI writes to `.agents/skills/` even with `--agent cursor`.
