/**
 * Kit components the Host renders. Sheets bind here — not per-bot SPAs.
 * See ADR 0013, ADR 0016, ADR 0022, and ADR 0025.
 */
export const uiKitComponents = {
  button: 'KitButton',
  chatParts: 'KitChatParts',
  dialog: 'KitDialog',
  sheet: 'KitSheet',
  sheetShell: 'SheetShell',
  gooseSticker: 'GooseSticker',
  gooseLogo: 'GooseLogo',
  botAvatar: 'KitBotAvatar',
  markdown: 'KitMarkdown',
} as const

export type UiKitComponentName = keyof typeof uiKitComponents
