/** Bot avatar shapes and accent palette — see ADR 0016. */

export const BOT_AVATAR_SHAPES = [
  'circle',
  'bean',
  'squircle',
  'capsule',
  'triangle',
  'hex',
  'cloud',
  'teardrop',
] as const

export type BotAvatarShape = (typeof BOT_AVATAR_SHAPES)[number]

export const DEFAULT_AVATAR_SHAPE: BotAvatarShape = 'circle'

/**
 * Named Bot accent tokens (CSS `--bot-accent-NN`) and their hex values.
 * Host/Bot avatars and UI accents consume these — not ad-hoc hexes.
 */
export const BOT_ACCENT_TOKENS = [
  { token: 'bot-accent-01', cssVar: '--bot-accent-01', hex: '#1F7AE5' },
  { token: 'bot-accent-02', cssVar: '--bot-accent-02', hex: '#B656D7' },
  { token: 'bot-accent-03', cssVar: '--bot-accent-03', hex: '#8190AE' },
  { token: 'bot-accent-04', cssVar: '--bot-accent-04', hex: '#529098' },
  { token: 'bot-accent-05', cssVar: '--bot-accent-05', hex: '#A0A24F' },
  { token: 'bot-accent-06', cssVar: '--bot-accent-06', hex: '#0AAC7B' },
  { token: 'bot-accent-07', cssVar: '--bot-accent-07', hex: '#9B8F7E' },
  { token: 'bot-accent-08', cssVar: '--bot-accent-08', hex: '#D5AC1B' },
  { token: 'bot-accent-09', cssVar: '--bot-accent-09', hex: '#E47134' },
  { token: 'bot-accent-10', cssVar: '--bot-accent-10', hex: '#DE3957' },
  { token: 'bot-accent-11', cssVar: '--bot-accent-11', hex: '#73B125' },
  { token: 'bot-accent-12', cssVar: '--bot-accent-12', hex: '#B2774F' },
  { token: 'bot-accent-13', cssVar: '--bot-accent-13', hex: '#8354E6' },
  { token: 'bot-accent-14', cssVar: '--bot-accent-14', hex: '#28A2D6' },
  { token: 'bot-accent-15', cssVar: '--bot-accent-15', hex: '#DD547E' },
  { token: 'bot-accent-16', cssVar: '--bot-accent-16', hex: '#DC4ACD' },
] as const

export type BotAccentToken = (typeof BOT_ACCENT_TOKENS)[number]['token']
export type BotAccentHex = (typeof BOT_ACCENT_TOKENS)[number]['hex']

export const BOT_ACCENT_HEXES = BOT_ACCENT_TOKENS.map((item) => item.hex) as unknown as readonly [
  BotAccentHex,
  ...BotAccentHex[],
]

export const DEFAULT_AVATAR_COLOR: BotAccentHex = '#1F7AE5'

const HEX_BY_UPPER = new Map(
  BOT_ACCENT_TOKENS.map((item) => [item.hex.toUpperCase(), item.hex] as const),
)

export function isBotAvatarShape(value: string): value is BotAvatarShape {
  return (BOT_AVATAR_SHAPES as readonly string[]).includes(value)
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
