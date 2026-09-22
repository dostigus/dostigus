import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
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

it('registers the Sheet shell, Dialog, and Button', () => {
  expect(uiKitComponents).toMatchObject({
    button: 'KitButton',
    dialog: 'KitDialog',
    sheet: 'KitSheet',
    sheetShell: 'SheetShell',
    gooseSticker: 'GooseSticker',
    gooseLogo: 'GooseLogo',
  })
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
