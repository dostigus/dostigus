import type { BotAvatarShape } from '@dostigus/shared'

/**
 * Bot mark geometry — the Dostigus flock. Eight birds drawn on one 64×64
 * grid so a sidebar column of Bots lines up, with named parts (`body`,
 * `wing`, `head`, `crest`, `beak`, `jaw`, `eyes`) that motion can target.
 *
 * Shapes stay primitive on purpose: discs, ellipses and round-capped tubes
 * survive a 32px sidebar row, where fine outline detail turns to mush.
 * See ADR 0018.
 */

export const MARK_VIEWBOX = 64

export type MarkPiece
  = | { tag: 'circle', cx: number, cy: number, r: number }
    | { tag: 'ellipse', cx: number, cy: number, rx: number, ry: number, rotate?: number }
    | { tag: 'path', d: string }
  /** Round-capped tube: necks, legs, plumes. Reads as solid at any size. */
    | { tag: 'tube', d: string, width: number }

export type MarkEye = {
  cx: number
  cy: number
  /** Eye-white radius. The dark pupil sits inside it. */
  r: number
  pupil: number
}

export type BotMark = {
  /** Behind the body: tail fans and long tails. */
  tail: MarkPiece[]
  /** Torso plus the neck tube that carries the head. */
  body: MarkPiece[]
  /** Pale chest patch, drawn over the body. */
  belly: MarkPiece[]
  /** Folded wing or flipper, in the shade tone. */
  wing: MarkPiece[]
  /** Legs and feet, in the beak tone. */
  feet: MarkPiece[]
  /** Tufts, plumes, ear tufts — behind the skull. */
  crest: MarkPiece[]
  /** Skull. */
  head: MarkPiece[]
  /** Upper bill. */
  beak: MarkPiece[]
  /** Lower bill. Opens on `reply`. */
  jaw: MarkPiece[]
  eyes: MarkEye[]
  /** Neck joint the head nods and tilts around. */
  headPivot: [number, number]
  /** Bill hinge the jaw opens around. */
  jawPivot: [number, number]
  /** Shoulder the wing flicks around. */
  wingPivot: [number, number]
}

/** Leg tube plus a webbed paddle foot, in the beak tone. */
function leg(
  hip: [number, number],
  foot: [number, number],
  scale = 1,
  width = 2.4,
): MarkPiece[] {
  const [fx, fy] = foot
  const w = 6.2 * scale
  const h = 3.2 * scale
  return [
    { tag: 'tube', d: `M${hip[0]} ${hip[1]} L${fx} ${fy}`, width },
    {
      tag: 'path',
      d: `M${fx - w * 0.3} ${fy - h * 0.45} C${fx + w * 0.2} ${fy - h * 0.55} ${fx + w * 0.8} ${fy} ${fx + w} ${fy + h * 0.5}`
        + ` C${fx + w * 1.1} ${fy + h * 0.9} ${fx + w * 0.9} ${fy + h} ${fx + w * 0.6} ${fy + h}`
        + ` L${fx - w * 0.5} ${fy + h} C${fx - w * 0.75} ${fy + h} ${fx - w * 0.7} ${fy - h * 0.3} ${fx - w * 0.3} ${fy - h * 0.45} Z`,
    },
  ]
}

export const BOT_MARKS: Record<BotAvatarShape, BotMark> = {
  /** The house bird: S-neck, round body, blunt bill. */
  goose: {
    tail: [{ tag: 'path', d: 'M17 31 C11.5 28.5 6.5 27 3 26.5 C3.5 30.5 4.5 34.5 6 38 C9.5 39 13.5 39.5 17 39 Z' }],
    body: [
      { tag: 'ellipse', cx: 27, cy: 39, rx: 17.5, ry: 12.5, rotate: -7 },
      { tag: 'tube', d: 'M33 31 C31.5 23 35 16.5 41 14', width: 10 },
    ],
    belly: [],
    wing: [{ tag: 'path', d: 'M37 33.5 C29 30.5 18 32 11 37.5 C8.5 39.5 5.5 42 3.5 43.8 C6.5 44.2 9.5 44 12 43.4 C10.8 45 9 46.6 7 48 C11 48.2 15.5 47.4 19.5 45.8 C25 43.8 30 43.2 34 41.6 C36.8 40.4 38 37.6 37.6 35.2 C37.4 34.2 37.4 33.8 37 33.5 Z' }],
    feet: [...leg([24, 46], [24, 53]), ...leg([32, 46], [32, 53])],
    crest: [],
    head: [{ tag: 'circle', cx: 44.5, cy: 13.5, r: 8.8 }],
    beak: [{ tag: 'path', d: 'M50.5 9.6 C55.5 9.2 59.8 10.9 62.3 12.8 C62.9 13.3 62.9 13.9 62.3 14.3 L50.5 15 Z' }],
    jaw: [{ tag: 'path', d: 'M50.5 15.3 L62.1 14.7 C62.7 15.1 62.5 15.8 61.8 16.3 C59 18.1 54.8 19.3 50.5 19.1 Z' }],
    eyes: [{ cx: 46, cy: 11.4, r: 3.1, pupil: 1.7 }],
    headPivot: [38, 21],
    jawPivot: [50.5, 15.3],
    wingPivot: [37, 34],
  },

  /** Low and wide, short neck, broad flat bill. */
  duck: {
    tail: [{ tag: 'path', d: 'M16 32 C10.5 29.5 5.5 28 2.5 27.5 C3 31 4 35 5.5 38.5 C9 39.5 13 40 16 39.5 Z' }],
    body: [
      { tag: 'ellipse', cx: 29, cy: 41, rx: 19.5, ry: 12.5, rotate: -5 },
      { tag: 'tube', d: 'M38 34 C40.5 29.5 42.5 26.5 44 25', width: 12 },
    ],
    belly: [],
    wing: [{ tag: 'path', d: 'M39 35 C31 31.5 19 33.5 11.5 39.5 C9 41.5 6 44 4 45.8 C7 46.2 10 46 12.5 45.4 C11.3 47 9.5 48.6 7.5 50 C11.5 50.2 16 49.4 20 47.8 C25.5 45.8 31.5 45 35.5 43.4 C38.5 42.2 40 39.2 39.6 36.8 C39.4 35.8 39.4 35.3 39 35 Z' }],
    feet: [...leg([26, 48], [26, 54]), ...leg([35, 48], [35, 54])],
    crest: [],
    head: [{ tag: 'circle', cx: 45, cy: 23.5, r: 9.8 }],
    beak: [{ tag: 'path', d: 'M51.5 19.2 C56.5 18.8 61 20.2 62.6 22.4 C63.2 23.3 62.7 24.2 61.4 24.5 L51.5 24.9 Z' }],
    jaw: [{ tag: 'path', d: 'M51.5 25.2 L61.4 24.8 C62.6 25.2 62.8 26.3 61.6 27.2 C59 29 54.9 29.8 51.5 29.4 Z' }],
    eyes: [{ cx: 46.4, cy: 21, r: 3.2, pupil: 1.75 }],
    headPivot: [40, 30],
    jawPivot: [51.5, 25.2],
    wingPivot: [39, 36],
  },

  /** Almost all neck: a tall curve with a small head and a knobbed bill. */
  swan: {
    tail: [{ tag: 'path', d: 'M15 39 C10 36.5 5.5 35 2.5 34.5 C3 38 4 42 5.5 45.5 C9 46.5 12.5 47 15 46.5 Z' }],
    body: [
      { tag: 'ellipse', cx: 25, cy: 46, rx: 15.5, ry: 10, rotate: -8 },
      { tag: 'tube', d: 'M30 40 C25.5 30 27.5 13.5 38 10.5', width: 6.8 },
    ],
    belly: [],
    wing: [{ tag: 'path', d: 'M33 40 C26.5 37 18 38.5 12.5 42.5 C10.5 44 8 46 6.5 47.4 C9 47.8 11.5 47.6 13.5 47.2 C12.5 48.6 11 49.8 9.5 50.8 C13 51 17 50.4 20.5 49 C25 47.3 29 46.7 31.8 45.4 C34.4 44.2 35 42 34 40.6 Z' }],
    feet: [],
    crest: [],
    head: [{ tag: 'circle', cx: 43, cy: 10, r: 6.5 }],
    beak: [
      { tag: 'path', d: 'M47.8 6.8 C51.6 6.6 55.6 7.8 57.7 9.4 C58.3 9.8 58.3 10.3 57.7 10.6 L47.8 11.2 Z' },
      { tag: 'ellipse', cx: 46.6, cy: 5.6, rx: 2.5, ry: 2.1 },
    ],
    jaw: [{ tag: 'path', d: 'M47.8 11.5 L57.5 11 C58.1 11.3 58 12 57.3 12.4 C55 13.8 51.5 14.6 47.8 14.4 Z' }],
    eyes: [{ cx: 44.4, cy: 8.2, r: 2.6, pupil: 1.4 }],
    headPivot: [32, 21],
    jawPivot: [47.8, 11.5],
    wingPivot: [34.5, 39],
  },

  /** A fluff ball with two down wisps and a stubby bill. */
  chick: {
    tail: [],
    body: [{ tag: 'circle', cx: 30, cy: 38, r: 15.2 }],
    belly: [],
    wing: [{ tag: 'path', d: 'M28.5 33 C23 31.5 17.5 33.5 15 37.5 C13.8 39.4 13 41 12.6 42.4 C15.5 43.6 19.5 43.6 23 42.4 C26.5 41.2 29.5 39.6 30.2 37.6 C30.8 36 30.2 34.2 28.5 33 Z' }],
    feet: [...leg([26, 48], [26, 54]), ...leg([34, 48], [34, 54])],
    crest: [
      { tag: 'tube', d: 'M31.5 12 C31 9 29.5 7.2 27.8 6.4', width: 2.1 },
      { tag: 'tube', d: 'M35.5 11.6 C36.4 8.8 38 7.4 39.8 6.8', width: 2.1 },
    ],
    head: [{ tag: 'circle', cx: 33, cy: 23.5, r: 12.2 }],
    beak: [{ tag: 'path', d: 'M43.5 20.6 C47.8 20.4 51.3 21.4 52.9 22.4 C53.4 22.7 53.4 23.1 52.9 23.3 L43.5 23.8 Z' }],
    jaw: [{ tag: 'path', d: 'M43.5 24.1 L52.7 23.6 C53.2 23.9 53.1 24.5 52.5 24.9 C50.6 26 47 26.7 43.5 26.6 Z' }],
    eyes: [{ cx: 38.2, cy: 21.4, r: 3.4, pupil: 1.85 }],
    headPivot: [33, 33],
    jawPivot: [43.5, 24.1],
    wingPivot: [29.5, 33],
  },

  /** Three-spike crest and a hooked bill; the loud one. */
  parrot: {
    tail: [{ tag: 'path', d: 'M22 45 C18 50 14.5 54 11.5 56.5 L18.5 57.5 C22 55 25.5 51 27.5 47.5 Z' }],
    body: [
      { tag: 'ellipse', cx: 29, cy: 40, rx: 15, ry: 14, rotate: -8 },
      { tag: 'tube', d: 'M34.5 31 C36.5 27 38.5 24.5 40.5 23', width: 11 },
    ],
    belly: [],
    wing: [{ tag: 'path', d: 'M35 32.5 C28 30.5 20 33 16.5 38.5 C15 40.8 13.5 43 12.5 44.4 C14.5 44.6 16.4 44.4 18 44 C17.4 45.4 16.4 46.6 15.2 47.6 C18 47.8 21.4 47.2 24.2 46 C28.4 44.2 32.4 43.4 34.4 41.6 C36.8 39.6 37 34.6 35 32.5 Z' }],
    feet: [...leg([31, 48], [31, 54])],
    // Each spike starts on the skull arc, so the crest never floats off the head.
    crest: [
      { tag: 'path', d: 'M32.6 16 C29 12.2 26.9 8.6 25.8 5.6 C28.7 8.3 32.4 10.6 36 12.6 Z' },
      { tag: 'path', d: 'M35.7 12.8 C33.9 9.2 32.5 5.6 32.1 2.6 C34.7 5.7 37.4 8.6 39.7 11.3 Z' },
      { tag: 'path', d: 'M39.6 11.5 C39.5 8.1 39.9 4.8 40.6 2 C42 5.1 43.2 8.4 43.9 11.7 Z' },
    ],
    head: [{ tag: 'circle', cx: 41, cy: 21, r: 9.8 }],
    beak: [{ tag: 'path', d: 'M47.5 16 C52 15.8 55.8 17.4 56.8 19.8 C57.6 21.8 56 24.6 53.2 26 C54.4 23.2 53.4 20.8 50.2 20.2 L47.5 20 Z' }],
    jaw: [{ tag: 'path', d: 'M48.5 21 C51.4 21.2 53.4 22.2 54 23.7 C52.7 24.9 50.7 25.5 48.5 25.1 Z' }],
    eyes: [{ cx: 43.6, cy: 18.8, r: 3.3, pupil: 1.8 }],
    headPivot: [36, 29],
    jawPivot: [48.5, 21],
    wingPivot: [35.5, 33],
  },

  /** Slim, dagger bill, a plume swept off the back of the head. */
  heron: {
    tail: [{ tag: 'path', d: 'M16 38 C10.5 36 5.5 34.5 2.5 34 C3 37.5 4 41 5.5 44 C9 44.5 12.5 44.5 16 44 Z' }],
    body: [
      { tag: 'ellipse', cx: 24, cy: 42, rx: 14, ry: 9.8, rotate: -12 },
      { tag: 'tube', d: 'M26.5 35 C23.5 27 30 16 37 12.5', width: 6.4 },
    ],
    belly: [],
    wing: [{ tag: 'path', d: 'M32 36.5 C26 34 18 35.5 13.5 39.5 C11.6 41.2 9.4 43 8 44.2 C10.2 44.5 12.2 44.3 13.8 43.9 C13 45.1 11.8 46.2 10.6 47.1 C13.6 47.4 17 46.8 20 45.6 C24.4 43.9 28.6 43.4 30.8 41.8 C33.2 40.2 33.6 38 32 36.5 Z' }],
    feet: [...leg([22.5, 46], [20.5, 56], 0.65, 1.8), ...leg([28.5, 46], [29.5, 56], 0.65, 1.8)],
    crest: [
      { tag: 'tube', d: 'M36 8 C31 5.5 27 5 24 5.5', width: 2 },
      { tag: 'tube', d: 'M36.5 11 C32.5 9.5 29 9.2 26.5 9.8', width: 1.6 },
    ],
    head: [{ tag: 'circle', cx: 40, cy: 11.8, r: 6.4 }],
    beak: [{ tag: 'path', d: 'M44.8 9.2 C50 9.8 56.5 11 61.8 12.1 C62.4 12.2 62.4 12.6 61.8 12.7 L44.8 12.9 Z' }],
    jaw: [{ tag: 'path', d: 'M44.8 13.2 L61.6 13.1 C62.2 13.2 62.2 13.6 61.6 13.7 C56.5 14.9 50 15.8 44.8 16.2 Z' }],
    eyes: [{ cx: 41.6, cy: 10.6, r: 2.6, pupil: 1.4 }],
    headPivot: [32, 19],
    jawPivot: [44.8, 13.2],
    wingPivot: [32.5, 37],
  },

  /** Upright and stocky with a pale chest and a deep wedge bill. */
  puffin: {
    tail: [{ tag: 'path', d: 'M20 48 C15 52.5 11 56.5 9 59 L17 59.5 C20.5 57 23.5 53.5 25 50.5 Z' }],
    body: [{ tag: 'ellipse', cx: 30, cy: 38, rx: 16, ry: 16 }],
    belly: [{ tag: 'ellipse', cx: 31.5, cy: 41.5, rx: 10.2, ry: 11.5 }],
    wing: [{ tag: 'path', d: 'M18 26.5 C14 29.5 13.2 37 14.8 44 C15.8 48.5 18.3 51 20.8 50.5 C22.3 50 22.6 47 22 42 C21.4 36 20.8 30 20.3 27.5 C19.9 26.2 19 25.8 18 26.5 Z' }],
    feet: [...leg([26, 50], [26, 55]), ...leg([35, 50], [35, 55])],
    crest: [],
    head: [{ tag: 'circle', cx: 32, cy: 19, r: 12.8 }],
    beak: [{ tag: 'path', d: 'M42.5 13.4 C48.5 13.2 54.8 15.2 57.2 18 C58.4 19.4 58.2 20.2 56.8 20.6 L42.5 20.7 Z' }],
    jaw: [{ tag: 'path', d: 'M42.5 21 L56.8 21 C58 21.4 58.2 22.4 57.2 23.6 C54.8 26.6 48.5 28.6 42.5 28.4 Z' }],
    eyes: [{ cx: 36.5, cy: 15.8, r: 3.6, pupil: 1.95 }],
    headPivot: [32, 30],
    jawPivot: [42.5, 21],
    wingPivot: [19, 27],
  },

  /** The one that looks straight back at you: ear tufts and two big eyes. */
  owl: {
    tail: [],
    body: [{ tag: 'ellipse', cx: 32, cy: 41.5, rx: 16.5, ry: 13.5 }],
    belly: [],
    wing: [
      { tag: 'path', d: 'M17.8 33 C14.3 36 13.8 43 15.8 49 C17.3 53 19.8 54.5 21.3 53 C22.3 52 21.8 48 21.3 43 C20.8 38 20.3 34.5 19.8 33 C19.3 31.8 18.5 32.2 17.8 33 Z' },
      { tag: 'path', d: 'M46.2 33 C49.7 36 50.2 43 48.2 49 C46.7 53 44.2 54.5 42.7 53 C41.7 52 42.2 48 42.7 43 C43.2 38 43.7 34.5 44.2 33 C44.7 31.8 45.5 32.2 46.2 33 Z' },
    ],
    feet: [...leg([25, 51], [25, 55.5]), ...leg([39, 51], [39, 55.5])],
    crest: [
      { tag: 'path', d: 'M19 15 C17 10 16.5 6.5 17 3.5 C20.5 6.5 24.5 10 27 12.5 Z' },
      { tag: 'path', d: 'M45 15 C47 10 47.5 6.5 47 3.5 C43.5 6.5 39.5 10 37 12.5 Z' },
    ],
    head: [{ tag: 'circle', cx: 32, cy: 24, r: 15 }],
    beak: [{ tag: 'path', d: 'M32 25 C34.2 25 35.6 25.7 35.6 26.8 L28.4 26.8 C28.4 25.7 29.8 25 32 25 Z' }],
    jaw: [{ tag: 'path', d: 'M28.4 27.1 L35.6 27.1 C35.6 29.6 33.8 32.2 32 33.4 C30.2 32.2 28.4 29.6 28.4 27.1 Z' }],
    eyes: [
      { cx: 25.4, cy: 23.2, r: 5.6, pupil: 2.9 },
      { cx: 38.6, cy: 23.2, r: 5.6, pupil: 2.9 },
    ],
    headPivot: [32, 36],
    jawPivot: [32, 27.3],
    wingPivot: [32, 34],
  },
}

type PieceRender = {
  tag: 'circle' | 'ellipse' | 'path'
  attrs: Record<string, string | number>
}

/** Turn mark geometry into SVG element props. Tubes render as stroked paths. */
export function renderPiece(piece: MarkPiece): PieceRender {
  if (piece.tag === 'circle') {
    return { tag: 'circle', attrs: { cx: piece.cx, cy: piece.cy, r: piece.r } }
  }
  if (piece.tag === 'ellipse') {
    const attrs: Record<string, string | number> = {
      cx: piece.cx,
      cy: piece.cy,
      rx: piece.rx,
      ry: piece.ry,
    }
    if (piece.rotate) {
      attrs.transform = `rotate(${piece.rotate} ${piece.cx} ${piece.cy})`
    }
    return { tag: 'ellipse', attrs }
  }
  if (piece.tag === 'path') {
    return { tag: 'path', attrs: { d: piece.d } }
  }
  return {
    tag: 'path',
    attrs: {
      'd': piece.d,
      'stroke-width': piece.width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'style': 'fill:none',
    },
  }
}
