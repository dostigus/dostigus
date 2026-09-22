# ADR 0018: Bot marks — an eight-bird flock with named parts

- Status: accepted
- Date: 2026-09-22

## Decision

A Bot avatar is a **Bot mark**: one bird from the Dostigus flock, painted in
the Manifest accent. Kit `KitBotAvatar` draws it. This replaces the goose
silhouettes of [ADR 0017](0017-goose-mark-avatar.md), which were eight
variations of one shape and read as the same blob in a sidebar row.

### The flock

Eight birds, one per shape id, picked so that ten Bots stay apart by
outline before color helps:

| Shape | Silhouette cue |
|-------|----------------|
| `goose` | S-neck, round body, blunt bill — the house bird and the default |
| `duck` | low and wide, short neck, broad flat bill |
| `swan` | a tall neck curve, small head, knob at the bill |
| `chick` | fluff ball, no neck, two down wisps |
| `parrot` | three-spike crest, hooked bill, long tail |
| `heron` | slim, long dagger bill, plume swept off the head |
| `puffin` | upright and stocky, pale chest, deep wedge bill |
| `owl` | face-on, ear tufts, two big eyes |

Geometry lives in `packages/ui-kit/src/bot-marks.ts` as data — discs,
ellipses, round-capped tubes and paths on one 64×64 grid — not as a pile of
hand-tuned path strings inside the component. Fine outline detail is
deliberately absent: it turns to mush at a 32px sidebar row.

### Named parts

Every mark is built from the same parts so motion, and later Chat
choreography, can target a piece rather than the whole avatar:

`tail` · `body` (torso and neck) · `belly` · `wing` · `feet` · `crest` ·
`head` (`skull`) · `beak` · `jaw` · `eyes` (`sclera`, `pupil`, `glint`)

Each mark also carries the user-space points its head, jaw and wing turn
around. SVG `transform-origin` resolves against the view-box, so those
pivots are set per part instead of relying on a default origin.

### Motion

`state` stays `none` | `idle` | `think` | `reply` | `work`, and all four
moving states now ship:

- `idle` — a slow breath, a small head settle, a rare blink.
- `think` — bill up, a long sway.
- `reply` — the jaw talks, the head bobs with it, the wing flicks.
- `work` — a steady flap.

Motion is CSS on the part groups and stops under
`prefers-reduced-motion: reduce`. The Host sidebar and the Chat header pass
`idle`; the Chat header passes `think` while a reply is in flight and
`reply` for a moment after it lands.

### Tones

`botMarkPalette(hex)` derives every tone from the one stored accent:
`body` (the accent), `shade` (wing and tail), `light` (eye whites and the
puffin chest), `beak` (bill and feet) and `ink` (pupils). A saturated warm
accent would swallow a coral bill, so those get a deep brick bill and the
rest get the bright brand coral. Eye whites keep the pupils readable on all
sixteen accents, which two dark dots on a dark body would not.

### Shape ids

Stored ids from both earlier generations migrate on read and in the Store
(migration `0006_flock_shapes`):

| ADR 0016 | ADR 0017 | Now |
|----------|----------|-----|
| `circle` | `round` | `goose` |
| `capsule` | `tall` | `swan` |
| `squircle` | `squat` | `duck` |
| `triangle` | `lean` | `heron` |
| `bean` | `plump` | `puffin` |
| `hex` | `chick` | `chick` |
| `cloud` | `honk` | `parrot` |
| `teardrop` | `peek` | `owl` |

Defaults are `goose` and `#1F7AE5` (`--bot-accent-10`); **Reset** restores
them. The palette and its hue order from ADR 0017 are unchanged.

## Context

ADR 0017 shipped goose marks with an idle breathe. In review they were
rejected: eight goose profiles differ by a few units of body height, so a
sidebar of Bots read as one repeated blob, and the flat bodies with
triangle beaks looked unfinished. The brief was a memorable cast, clear
silhouettes at ~32–40px, parts that motion can address, and real motion if
the quality holds.

## Consequences

- Shared exports the flock ids, their labels, the legacy map covering both
  older generations, and `botMarkPalette`. `beakColorFromBody` is gone.
- Kit exports `BOT_MARKS`, `MARK_VIEWBOX` and `renderPiece` next to
  `KitBotAvatar`, so the geometry is testable without mounting Vue.
- The appearance editor grid shows the eight birds, names them for screen
  readers, and breathes the selected one.
- The Store default shape becomes `goose`; migration `0006_flock_shapes`
  rewrites stored rows. Invalid API shapes stay rejected; reads migrate.
- MCP `dostigus_bots_create` / `dostigus_bots_update` accept the new ids
  (the enum comes from the shared list).

## Alternatives

- Keep the goose marks and only repaint them — rejected. The problem was
  silhouette sameness, not color.
- Use the Brand stickers as avatars — rejected. They are raster art meant
  for empty states and Sheets; they smear at 32px and cannot animate parts.
- One species with eight poses — rejected for the same sameness reason.
- Static marks with an idle breathe only — rejected once `think` and
  `reply` read cleanly at sidebar and header size.
- Per-part color pickers — rejected. One accent, derived tones.
