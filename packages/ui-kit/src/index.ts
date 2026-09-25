export {
  BOT_MARKS,
  type BotMark,
  MARK_VIEWBOX,
  type MarkEye,
  type MarkPiece,
  renderPiece,
} from './bot-marks'
export type { GooseLogoMark, GooseStickerName } from './brand'
export {
  GOOSE_LOGO_MARKS,
  GOOSE_STICKERS,
  gooseFavicon,
  gooseLogoSrc,
  gooseStickerSrc,
} from './brand'
export type { UiKitComponentName } from './components'
export { uiKitComponents } from './components'
export { default as GooseLogo } from './components/GooseLogo.vue'
export { default as GooseSticker } from './components/GooseSticker.vue'
export { default as KitBotAvatar } from './components/KitBotAvatar.vue'
export { default as KitButton } from './components/KitButton.vue'
export { default as KitChatParts } from './components/KitChatParts.vue'
export { default as KitDialog } from './components/KitDialog.vue'
export { default as KitMarkdown } from './components/KitMarkdown.vue'
export { default as KitSheet } from './components/KitSheet.vue'
export { default as SheetShell } from './components/SheetShell.vue'
export {
  DEFAULT_HOST_LOCALE,
  HOST_LOCALE_COOKIE,
  HOST_LOCALE_MESSAGES,
  HOST_LOCALES,
  type HostLocale,
  type HostLocaleMessages,
  type HostTranslateParams,
  isHostLocale,
  localeMessageKeys,
  resolveHostLocale,
  tHost,
} from './locale'
export {
  assistantBubbleUsesMarkdown,
  renderChatMarkdown,
} from './markdown'
