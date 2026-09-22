import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOT_AVATAR_SHAPES, BOT_AVATAR_STATES } from '@dostigus/shared'
import { expect, it } from 'vitest'
import { BOT_MARKS, MARK_VIEWBOX, renderPiece } from '../../src/bot-marks'
import { GOOSE_STICKERS, gooseFavicon, gooseLogoSrc, gooseStickerSrc } from '../../src/brand'
import { uiKitComponents } from '../../src/components'

const root = join(import.meta.dirname, '../..')

it('ships only the supplied goose files plus favicon sizes', () => {
  const goose = readdirSync(join(root, 'assets/brand/goose')).sort()
  const expected = [
    ...GOOSE_STICKERS.map((name) => `goose-${name}.png`),
    'goose-favicon-full.png',
    'goose-logo-banner.png',
    'goose-logo.png',
  ].sort()
  expect(goose).toEqual(expected)
  expect(goose).toHaveLength(16)

  const favicon = readdirSync(join(root, 'assets/brand/favicon')).sort()
  expect(favicon).toEqual([
    'apple-touch-icon.png',
    'favicon-32.png',
    'favicon.ico',
  ])
})

it('maps stickers, the logo, and favicon onto /brand', () => {
  expect(gooseStickerSrc('wave')).toBe('/brand/goose/goose-wave.png')
  expect(gooseStickerSrc('logo-full')).toBe('/brand/goose/goose-logo-full.png')
  expect(gooseStickerSrc('head')).toBe('/brand/goose/goose-head.png')
  expect(gooseLogoSrc('logo')).toBe('/brand/goose/goose-logo.png')
  expect(gooseLogoSrc('banner')).toBe('/brand/goose/goose-logo-banner.png')
  expect(gooseFavicon.source).toBe('/brand/goose/goose-favicon-full.png')
  expect(gooseFavicon.png32).toBe('/brand/favicon/favicon-32.png')
  expect(gooseFavicon.appleTouch).toBe('/brand/favicon/apple-touch-icon.png')
})

it('registers the Sheet shell, Dialog, Button, and Bot avatar', () => {
  expect(uiKitComponents).toMatchObject({
    button: 'KitButton',
    dialog: 'KitDialog',
    sheet: 'KitSheet',
    sheetShell: 'SheetShell',
    gooseSticker: 'GooseSticker',
    gooseLogo: 'GooseLogo',
    botAvatar: 'KitBotAvatar',
  })
})

it('ships Bot accent tokens and the eight-bird flock', () => {
  const accents = readFileSync(join(root, 'src/bot-accents.css'), 'utf8')
  expect(accents).toContain('--bot-accent-01: #e47134')
  expect(accents).toContain('--bot-accent-10: #1f7ae5')
  expect(accents).toContain('--bot-accent-16: #de3957')
  expect(readFileSync(join(root, 'src/kit.css'), 'utf8')).toContain('bot-accents.css')

  expect(Object.keys(BOT_MARKS)).toEqual(BOT_AVATAR_SHAPES)
  for (const shape of BOT_AVATAR_SHAPES) {
    const mark = BOT_MARKS[shape]
    expect(mark.body.length).toBeGreaterThan(0)
    expect(mark.head.length).toBeGreaterThan(0)
    expect(mark.beak.length).toBeGreaterThan(0)
    expect(mark.jaw.length).toBeGreaterThan(0)
    expect(mark.wing.length).toBeGreaterThan(0)
    expect(mark.eyes.length).toBeGreaterThan(0)
    for (const eye of mark.eyes) {
      expect(eye.pupil).toBeLessThan(eye.r)
    }
  }
  expect(BOT_MARKS.owl.eyes).toHaveLength(2)
  expect(BOT_MARKS.parrot.crest.length).toBe(3)
  expect(BOT_MARKS.puffin.belly.length).toBe(1)
})

it('renders mark pieces as plain SVG element props', () => {
  expect(renderPiece({ tag: 'circle', cx: 1, cy: 2, r: 3 })).toEqual({
    tag: 'circle',
    attrs: { cx: 1, cy: 2, r: 3 },
  })
  const tilted = renderPiece({ tag: 'ellipse', cx: 4, cy: 5, rx: 6, ry: 7, rotate: -8 })
  expect(tilted.tag).toBe('ellipse')
  expect(tilted.attrs.transform).toBe('rotate(-8 4 5)')
  const tube = renderPiece({ tag: 'tube', d: 'M0 0 L1 1', width: 2 })
  expect(tube.tag).toBe('path')
  expect(tube.attrs['stroke-width']).toBe(2)
  expect(tube.attrs.style).toBe('fill:none')
})

it('draws every flock part and every motion state in the Kit avatar', () => {
  const avatar = readFileSync(join(root, 'src/components/KitBotAvatar.vue'), 'utf8')
  const parts = ['tail', 'body', 'belly', 'wing', 'feet', 'crest', 'skull', 'beak', 'jaw', 'eye', 'gaze']
  for (const part of parts) {
    expect(avatar).toContain(`kit-bot-avatar__${part}`)
  }
  for (const motion of ['mark-motion', 'head-motion', 'jaw-motion', 'wing-motion', 'eye-motion']) {
    expect(avatar).toContain(`kit-bot-avatar__${motion}`)
  }
  for (const state of BOT_AVATAR_STATES) {
    if (state === 'none') {
      continue
    }
    expect(avatar).toContain(`kit-bot-avatar--${state}`)
  }
  for (const frames of [
    'kit-bot-breathe',
    'kit-bot-blink',
    'kit-bot-think-head',
    'kit-bot-talk',
    'kit-bot-flap',
    'kit-bot-greet-wing',
    'kit-bot-listen-head',
    'kit-bot-celebrate-hop',
    'kit-bot-error-head',
    'kit-bot-sleep-breathe',
  ]) {
    expect(avatar).toContain(`@keyframes ${frames}`)
  }
  // greet and celebrate play once, then the Host takes the mark back to idle.
  expect(avatar).toMatch(/kit-bot-greet-head [\d.]+s ease-in-out 1 both/)
  expect(avatar).toMatch(/kit-bot-celebrate-hop [\d.]+s cubic-bezier\([^)]+\) 1 both/)
  expect(avatar).toContain('prefers-reduced-motion')
})

it('keeps every mark part inside the 64 grid', () => {
  // Rough guard against a part drifting out of the box, like the old parrot crest.
  for (const shape of BOT_AVATAR_SHAPES) {
    const mark = BOT_MARKS[shape]
    const groups = [mark.tail, mark.body, mark.belly, mark.wing, mark.feet, mark.crest, mark.head, mark.beak, mark.jaw]
    for (const piece of groups.flat()) {
      const numbers = piece.tag === 'circle'
        ? [piece.cx - piece.r, piece.cx + piece.r, piece.cy - piece.r, piece.cy + piece.r]
        : piece.tag === 'ellipse'
          ? [piece.cx - piece.rx, piece.cx + piece.rx, piece.cy - piece.ry, piece.cy + piece.ry]
          : (piece.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
      for (const value of numbers) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(MARK_VIEWBOX)
      }
    }
    for (const [x, y] of [mark.headPivot, mark.jawPivot, mark.wingPivot]) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(MARK_VIEWBOX)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(MARK_VIEWBOX)
    }
  }
})

it('builds the Sheet shell on Reka Dialog', () => {
  const shell = readFileSync(join(root, 'src/components/SheetShell.vue'), 'utf8')
  expect(shell).toContain('reka-ui')
  expect(shell).toContain('DialogRoot')
  expect(shell).toContain('DialogContent')
  expect(readFileSync(join(root, 'src/components/KitSheet.vue'), 'utf8')).toContain('kind="sheet"')
  expect(readFileSync(join(root, 'src/components/KitDialog.vue'), 'utf8')).toContain('kind="modal"')
  expect(readFileSync(join(root, 'src/components/KitButton.vue'), 'utf8')).toContain('kit-button')
})
