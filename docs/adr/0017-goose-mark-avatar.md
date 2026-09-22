# ADR 0017: Goose mark avatar + hue-ordered palette

- Status: superseded by [ADR 0018](0018-bot-mark-flock.md)
- Date: 2026-09-22

## Decision

> Superseded. The silhouette language and the shape ids below were replaced
> by the eight-bird flock in [ADR 0018](0018-bot-mark-flock.md). The
> hue-ordered palette from this ADR still stands.

Bot avatars are **Goose marks** — soft goose-character silhouettes tied to
the Dostigus Brand — not generic geometric blobs. The Kit component
`KitBotAvatar` draws named SVG parts (`body`, `beak`, `eye-l`, `eye-r`) so
idle and later Chat motion can target them. Eight body silhouettes:

`round` | `tall` | `squat` | `lean` | `plump` | `chick` | `honk` | `peek`

(`honk` is the wide / honk-wide mark; ids stay short and stable.)

Body fill is Manifest `avatarColor` (palette hex). The beak is a slight
contrast derived from that body color (darker / warmer), not a second
palette pick. Eyes stay simple and readable at sidebar size.

### Avatar states

`KitBotAvatar` accepts `state`: `none` | `idle` | `think` | `reply` |
`work`. This change ships a light **idle breathe** only. `think`,
`reply`, and `work` are API hooks (no full choreography yet). The Host
passes `idle` on sidebar rows and the Chat header.

### Palette order

The same sixteen Bot accent hexes from [ADR 0016](0016-bot-avatar-tokens.md)
remain; token indices `--bot-accent-01` … `16` are **renumbered by hue**
(color-wheel order) so similar colors sit together in the appearance
editor. Stored Manifest colors resolve **by hex value**, not by old
index — existing Bots keep their color. Default fill stays `#1F7AE5`
(now `--bot-accent-10`). The swatch grid centers the last incomplete
row.

### Legacy shapes

ADR 0016 geometric ids migrate to the nearest Goose mark on read (and
via a Store migration that rewrites rows):

| Legacy | Goose mark |
|--------|------------|
| `circle` | `round` |
| `bean` | `plump` |
| `squircle` | `squat` |
| `capsule` | `tall` |
| `triangle` | `lean` |
| `hex` | `chick` |
| `cloud` | `honk` |
| `teardrop` | `peek` |

Defaults are `round` and `#1F7AE5`. **Reset** restores those.

## Context

ADR 0016 shipped shape-and-color tokens with eyed geometry. Nick asked
for hue-ordered swatches, a centered incomplete palette row, and an
original Goose mark language (animation-ready parts) instead of Grok-like
blobs — with only a thin idle motion in this change.

## Consequences

- Shared package exports the new shape ids, legacy map, hue-ordered
  accent tokens, avatar states, and beak derivation.
- Kit `KitBotAvatar` redraws Goose marks with part classes and idle
  breathe; Host list/header pass `state="idle"`.
- Appearance editor shows the new silhouettes and sorted, centered
  swatches.
- Store migration rewrites legacy shape names; schema default becomes
  `round`. Invalid API shapes stay rejected; reads still migrate.

## Alternatives

- Keep geometric silhouettes — rejected. Brand asks for Goose marks.
- Full think/reply/work choreography now — deferred; API only.
- Reorder swatches in the UI without renumbering CSS tokens — rejected.
  Token order should match the editor wheel.
- Custom hex or a second beak palette — rejected; beak derives from body.
