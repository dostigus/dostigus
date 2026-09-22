# ADR 0016: Bot avatar tokens

- Status: accepted
- Date: 2026-09-22

## Decision

Each Bot Manifest stores an avatar as `avatarShape` and `avatarColor`. The
Host renders that mark in the sidebar Bot rows and the Chat header. The
Owner edits shape and color in the existing right Bot settings Sheet
([ADR 0015](0015-host-desktop-shell.md)). Members see the avatars and may
open the Sheet to read them; only the Owner mutates appearance, same as
name and Model tier.

### Palette

Sixteen Bot accent hexes are named design tokens
(`--bot-accent-01` … `--bot-accent-16`). They live in the Kit and
[`docs/ui.md`](../ui.md). Host chrome still uses the coral-orange Host
tokens from [ADR 0013](0013-kit-reka-ui-and-brand.md). Bot avatars and UI
accents that need this palette consume the tokens — not hardcoded swatches
only in one component. `avatarColor` must be one of those hexes.

### Shapes

Eight silhouettes ship in the Kit: `circle`, `bean`, `squircle`,
`capsule`, `triangle`, `hex`, `cloud`, `teardrop`. Each mark has two
simple eyes. Defaults are `circle` and `--bot-accent-01` (`#1F7AE5`).
**Reset** in the editor restores those defaults.

### Editor

The right Bot Sheet keeps name, Model tier, and delete for the Owner. It
adds a **Bot** tab with the shape grid and color swatches (structure from
Nick’s reference; English copy; Dostigus tokens). **Generate** and
**Upload** stay out of scope — do not stub them as tabs. **Reset** is the
other control on that row.

## Context

ADR 0015 drew initials avatars from the Bot name. Nick’s next grill asked
for persistent shape-and-color tokens on the Manifest, a Kit palette, and
an appearance editor in the existing Bot Sheet — without AI generate,
image upload, or custom hex outside the palette.

## Consequences

- Store adds `avatar_shape` and `avatar_color` on `bots` (Manifest fields).
  Create uses the defaults. Update accepts optional shape and color;
  invalid values are rejected.
- Kit exports `KitBotAvatar` and the accent CSS variables. Host sidebar
  and Chat header pass Manifest shape and color into that mark.
- MCP `dostigus_bots_create` / `dostigus_bots_update` accept the same
  optional fields as the Host PATCH.
- Out of this change: AI generate, image upload, custom hex, unread
  badges, file attach. Superseded silhouette language and palette order
  are in [ADR 0017](0017-goose-mark-avatar.md).

## Alternatives

- Initials-only avatars — rejected. Nick wants silhouettes plus palette.
- Storing a freeform image URL — rejected for this change. Upload is out
  of scope.
- A separate appearance Sheet — rejected. The right Bot Sheet already
  owns Bot settings.
- Allowing any CSS color — rejected. Color must be a palette token hex.
