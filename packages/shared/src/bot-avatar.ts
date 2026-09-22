/** Bot mark cast, palette, and mark tones — see ADR 0016 / ADR 0018. */

/**
 * The Dostigus flock. Eight birds, one per silhouette, chosen so ten Bots in
 * the sidebar stay apart by outline alone before color helps.
 */
export const BOT_AVATAR_SHAPES = [
  'goose',
  'duck',
  'swan',
  'chick',
  'parrot',
  'heron',
  'puffin',
  'owl',
] as const

export type BotAvatarShape = (typeof BOT_AVATAR_SHAPES)[number]

export const DEFAULT_AVATAR_SHAPE: BotAvatarShape = 'goose'

/** Display names for the appearance editor and screen readers. */
export const BOT_AVATAR_SHAPE_LABELS = {
  goose: 'Goose',
  duck: 'Duck',
  swan: 'Swan',
  chick: 'Chick',
  parrot: 'Parrot',
  heron: 'Heron',
  puffin: 'Puffin',
  owl: 'Owl',
} as const satisfies Record<BotAvatarShape, string>

/**
 * Stored ids from earlier releases → a flock bird. ADR 0016 shipped geometric
 * ids, ADR 0017 shipped goose marks; both migrate on read and in the Store.
 */
export const LEGACY_AVATAR_SHAPE_MAP = {
  circle: 'goose',
  round: 'goose',
  capsule: 'swan',
  tall: 'swan',
  squircle: 'duck',
  squat: 'duck',
  triangle: 'heron',
  lean: 'heron',
  bean: 'puffin',
  plump: 'puffin',
  hex: 'chick',
  cloud: 'parrot',
  honk: 'parrot',
  teardrop: 'owl',
  peek: 'owl',
} as const satisfies Record<string, BotAvatarShape>

export type LegacyBotAvatarShape = keyof typeof LEGACY_AVATAR_SHAPE_MAP

/**
 * Named Bot accent tokens (CSS `--bot-accent-NN`) and their hex values,
 * ordered by hue (color-wheel). Host/Bot avatars and UI accents consume
 * these — not ad-hoc hexes. Resolve stored colors by hex value, not index.
 */
export const BOT_ACCENT_TOKENS = [
  { token: 'bot-accent-01', cssVar: '--bot-accent-01', hex: '#E47134' },
  { token: 'bot-accent-02', cssVar: '--bot-accent-02', hex: '#B2774F' },
  { token: 'bot-accent-03', cssVar: '--bot-accent-03', hex: '#9B8F7E' },
  { token: 'bot-accent-04', cssVar: '--bot-accent-04', hex: '#D5AC1B' },
  { token: 'bot-accent-05', cssVar: '--bot-accent-05', hex: '#A0A24F' },
  { token: 'bot-accent-06', cssVar: '--bot-accent-06', hex: '#73B125' },
  { token: 'bot-accent-07', cssVar: '--bot-accent-07', hex: '#0AAC7B' },
  { token: 'bot-accent-08', cssVar: '--bot-accent-08', hex: '#529098' },
  { token: 'bot-accent-09', cssVar: '--bot-accent-09', hex: '#28A2D6' },
  { token: 'bot-accent-10', cssVar: '--bot-accent-10', hex: '#1F7AE5' },
  { token: 'bot-accent-11', cssVar: '--bot-accent-11', hex: '#8190AE' },
  { token: 'bot-accent-12', cssVar: '--bot-accent-12', hex: '#8354E6' },
  { token: 'bot-accent-13', cssVar: '--bot-accent-13', hex: '#B656D7' },
  { token: 'bot-accent-14', cssVar: '--bot-accent-14', hex: '#DC4ACD' },
  { token: 'bot-accent-15', cssVar: '--bot-accent-15', hex: '#DD547E' },
  { token: 'bot-accent-16', cssVar: '--bot-accent-16', hex: '#DE3957' },
] as const

export type BotAccentToken = (typeof BOT_ACCENT_TOKENS)[number]['token']
export type BotAccentHex = (typeof BOT_ACCENT_TOKENS)[number]['hex']

export const BOT_ACCENT_HEXES = BOT_ACCENT_TOKENS.map((item) => item.hex) as unknown as readonly [
  BotAccentHex,
  ...BotAccentHex[],
]

/** Default fill — palette hex (`--bot-accent-10`). */
export const DEFAULT_AVATAR_COLOR: BotAccentHex = '#1F7AE5'

export const BOT_AVATAR_STATES = ['none', 'idle', 'think', 'reply', 'work'] as const

export type BotAvatarState = (typeof BOT_AVATAR_STATES)[number]

export const DEFAULT_AVATAR_STATE: BotAvatarState = 'none'

const HEX_BY_UPPER = new Map(
  BOT_ACCENT_TOKENS.map((item) => [item.hex.toUpperCase(), item.hex] as const),
)

export function isBotAvatarShape(value: string): value is BotAvatarShape {
  return (BOT_AVATAR_SHAPES as readonly string[]).includes(value)
}

export function isLegacyBotAvatarShape(value: string): value is LegacyBotAvatarShape {
  return Object.prototype.hasOwnProperty.call(LEGACY_AVATAR_SHAPE_MAP, value)
}

/** Map a stored shape id (current or legacy) to a flock bird. */
export function migrateBotAvatarShape(value: string | undefined | null): BotAvatarShape {
  if (value == null || value === '') {
    return DEFAULT_AVATAR_SHAPE
  }
  if (isBotAvatarShape(value)) {
    return value
  }
  if (isLegacyBotAvatarShape(value)) {
    return LEGACY_AVATAR_SHAPE_MAP[value]
  }
  return DEFAULT_AVATAR_SHAPE
}

export function isBotAvatarState(value: string): value is BotAvatarState {
  return (BOT_AVATAR_STATES as readonly string[]).includes(value)
}

/** Normalize a palette hex (any case) or return undefined if outside the palette. */
export function normalizeBotAccentHex(value: string | undefined | null): BotAccentHex | undefined {
  if (value == null || value === '') {
    return undefined
  }
  const trimmed = value.trim()
  return HEX_BY_UPPER.get(trimmed.toUpperCase())
}

export function isBotAccentHex(value: string): value is BotAccentHex {
  return normalizeBotAccentHex(value) !== undefined
}

export function botAccentCssVar(hex: string): string | undefined {
  const normalized = normalizeBotAccentHex(hex)
  if (!normalized) {
    return undefined
  }
  return BOT_ACCENT_TOKENS.find((item) => item.hex === normalized)?.cssVar
}

/** Tones a Bot mark paints with. Every tone derives from the body accent. */
export type BotMarkPalette = {
  /** Body, neck, head — the Manifest accent itself. */
  body: string
  /** Wing, tail, tuft — the accent pushed darker for depth. */
  shade: string
  /** Eye whites and belly patch — a warm near-cream tinted by the accent. */
  light: string
  /** Beak and feet — a warm tone held apart from the body on all sixteen accents. */
  beak: string
  /** Pupils. */
  ink: string
}

type Hsl = { h: number, s: number, l: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hexToHsl(hex: string): Hsl {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const span = max - min
  if (span === 0) {
    return { h: 0, s: 0, l }
  }
  const s = span / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) {
    h = ((g - b) / span) % 6
  } else if (max === g) {
    h = (b - r) / span + 2
  } else {
    h = (r - g) / span + 4
  }
  h *= 60
  return { h: h < 0 ? h + 360 : h, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const hue = ((h % 360) + 360) % 360
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - chroma / 2
  const [r, g, b] = hue < 60
    ? [chroma, x, 0]
    : hue < 120
      ? [x, chroma, 0]
      : hue < 180
        ? [0, chroma, x]
        : hue < 240
          ? [0, x, chroma]
          : hue < 300
            ? [x, 0, chroma]
            : [chroma, 0, x]
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/**
 * A coral bill drowns in a warm body, so warm accents get a pale peach bill
 * and everything else gets the bright brand coral.
 */
function beakHsl(body: Hsl): Hsl {
  const warm = (body.h <= 70 || body.h >= 330) && body.s > 0.3
  if (warm) {
    return { h: 32, s: 0.75, l: 0.84 }
  }
  return { h: 20, s: 0.88, l: 0.62 }
}

/** Every tone a Bot mark needs, derived from one palette accent. */
export function botMarkPalette(hex: string): BotMarkPalette {
  const normalized = normalizeBotAccentHex(hex) ?? DEFAULT_AVATAR_COLOR
  const body = hexToHsl(normalized)
  return {
    body: normalized,
    shade: hslToHex({ h: body.h, s: clamp(body.s * 1.05, 0, 1), l: clamp(body.l * 0.79, 0.1, 0.82) }),
    light: hslToHex({ h: body.h, s: clamp(body.s * 0.35, 0, 0.3), l: 0.94 }),
    beak: hslToHex(beakHsl(body)),
    ink: '#17140F',
  }
}
