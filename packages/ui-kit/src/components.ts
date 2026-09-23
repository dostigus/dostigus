/**
 * Kit components the Host renders. Sheets bind here — not per-bot SPAs.
 * See ADR 0013, ADR 0016, and ADR 0022.
 */
export const uiKitComponents = {
  button: 'KitButton',
  dialog: 'KitDialog',
  sheet: 'KitSheet',
  sheetShell: 'SheetShell',
  gooseSticker: 'GooseSticker',
  gooseLogo: 'GooseLogo',
  botAvatar: 'KitBotAvatar',
  markdown: 'KitMarkdown',
} as const

export type UiKitComponentName = keyof typeof uiKitComponents
