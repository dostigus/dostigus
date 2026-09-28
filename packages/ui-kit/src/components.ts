/**
 * Kit components the Host renders. Sheets bind here — not per-bot SPAs.
 * See ADR 0013, ADR 0016, ADR 0022, and ADR 0025.
 */
export const uiKitComponents = {
  button: 'KitButton',
  chatParts: 'KitChatParts',
  chip: 'KitChip',
  dialog: 'KitDialog',
  field: 'KitField',
  input: 'KitInput',
  listRow: 'KitListRow',
  menu: 'KitMenu',
  menuItem: 'KitMenuItem',
  menuSeparator: 'KitMenuSeparator',
  panel: 'KitPanel',
  select: 'KitSelect',
  sheet: 'KitSheet',
  sheetShell: 'SheetShell',
  textarea: 'KitTextarea',
  toggle: 'KitToggle',
  gooseSticker: 'GooseSticker',
  gooseLogo: 'GooseLogo',
  botAvatar: 'KitBotAvatar',
  markdown: 'KitMarkdown',
} as const

export type UiKitComponentName = keyof typeof uiKitComponents
