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

`state` drives CSS on the part groups. Nine states ship:

| State | What moves | Host call site |
|-------|-----------|----------------|
| `none` | nothing | appearance editor, unpicked birds |
| `idle` | slow breath, small head settle, rare blink | sidebar rows, Chat pill at rest |
| `think` | bill up, long sway, gaze searching | Chat pill while a reply is in flight; pending Chat mark only when no key is set |
| `reply` | jaw talks three syllables a cycle, head rides them, one wing flick | Chat pill as the reply lands |
| `work` | steady flap | Kit only — no Host Job surface yet |
| `greet` | one nod and a wing wave, then still | Chat open, and the picked bird in the editor |
| `listen` | leans in, gaze forward, slower blink | Chat composer focused |
| `celebrate` | one hop and a wing cheer | Chat pill after the reply finishes |
| `error` | confused head wobble, slow blink | Chat pill on a failed send |
| `sleep` | eyes shut to a slit, head down, long breath | Chat pill when no LLM gateway key is set, so the Bot cannot answer |

`greet` and `celebrate` play once (`ONE_SHOT_AVATAR_STATES`); the Host drops
back to `idle` when they finish. A pupil group (`gaze`) sits inside each eye
so a state can move the look without moving the eye.

The pending Chat mark, when no key is set, is that same bird, at the Kit
`lg` size, in `think`. A configured reply uses the activity row in
[ADR 0021](0021-chat-activity-status.md) instead of a second thinker.
Landing `reply` and `celebrate` stay on the Chat
header mark, which then returns to `idle`. A green live dot on the Chat
header avatar and the matching sidebar row tracks the busy window (in
flight, landing, the short cheer, and the short error pose) and hides at
rest.

Under `prefers-reduced-motion: reduce` nothing animates, but a state that
carries meaning keeps its pose: the thinker holds its bill up, the listener
leans in, the confused bird stays tilted, and the sleeper stays shut.

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
  older generations, the nine motion states with the one-shot pair, and
  `botMarkPalette`. `beakColorFromBody` is gone.
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
- Sprite sheets or Lottie for the richer states — rejected. CSS on named
  parts costs nothing to ship and scales with the mark.
- Per-part color pickers — rejected. One accent, derived tones.
