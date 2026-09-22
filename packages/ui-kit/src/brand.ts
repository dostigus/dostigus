/** Goose Brand files under `assets/brand`. Host serves them at `/brand`. */

export const GOOSE_STICKERS = [
  'confused',
  'heart',
  'notes',
  'ok',
  'peek',
  'point',
  'sleep',
  'think',
  'wave',
  'work',
  'wow',
  'head',
  'logo-full',
] as const

export type GooseStickerName = (typeof GOOSE_STICKERS)[number]

export const GOOSE_LOGO_MARKS = ['logo', 'banner'] as const

export type GooseLogoMark = (typeof GOOSE_LOGO_MARKS)[number]

const stickerFile: Record<GooseStickerName, string> = {
  'confused': 'goose-confused.png',
  'heart': 'goose-heart.png',
  'notes': 'goose-notes.png',
  'ok': 'goose-ok.png',
  'peek': 'goose-peek.png',
  'point': 'goose-point.png',
  'sleep': 'goose-sleep.png',
  'think': 'goose-think.png',
  'wave': 'goose-wave.png',
  'work': 'goose-work.png',
  'wow': 'goose-wow.png',
  'head': 'goose-head.png',
  'logo-full': 'goose-logo-full.png',
}

const logoFile: Record<GooseLogoMark, string> = {
  banner: 'goose-logo-banner.png',
  logo: 'goose-logo.png',
}

export function gooseStickerSrc(name: GooseStickerName): string {
  return `/brand/goose/${stickerFile[name]}`
}

export function gooseLogoSrc(mark: GooseLogoMark): string {
  return `/brand/goose/${logoFile[mark]}`
}

/** Practical favicon files are resized from `goose-favicon-full.png`. */
export const gooseFavicon = {
  source: '/brand/goose/goose-favicon-full.png',
  png32: '/brand/favicon/favicon-32.png',
  appleTouch: '/brand/favicon/apple-touch-icon.png',
  ico: '/brand/favicon/favicon.ico',
} as const
