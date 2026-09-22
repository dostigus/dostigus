/** Bot Goose mark shapes and accent palette — see ADR 0016 / ADR 0017. */

export const BOT_AVATAR_SHAPES = [
  'round',
  'tall',
  'squat',
  'lean',
  'plump',
  'chick',
  'honk',
  'peek',
] as const

export type BotAvatarShape = (typeof BOT_AVATAR_SHAPES)[number]

export const DEFAULT_AVATAR_SHAPE: BotAvatarShape = 'round'

/**
 * Legacy geometric silhouettes from ADR 0016 → nearest Goose mark (ADR 0017).
 * Match stored values by name; migrate on read.
 */
export const LEGACY_AVATAR_SHAPE_MAP = {
  circle: 'round',
  bean: 'plump',
  squircle: 'squat',
  capsule: 'tall',
  triangle: 'lean',
  hex: 'chick',
  cloud: 'honk',
  teardrop: 'peek',
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

/** Default fill — palette hex (now `--bot-accent-10` after hue reorder). */
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

/** Map a stored shape id (current or legacy) to a Goose mark shape. */
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

/**
 * Beak fill derived from the body accent: darker and slightly warmer,
 * not a second palette pick.
 */
export function beakColorFromBody(hex: string): string {
  const normalized = normalizeBotAccentHex(hex) ?? DEFAULT_AVATAR_COLOR
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  const nextR = Math.min(255, Math.round(r * 0.72 + 28))
  const nextG = Math.round(g * 0.55)
  const nextB = Math.round(b * 0.42)
  return `#${[nextR, nextG, nextB].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
