/**
 * Who may list or open a Bot. See ADR 0024.
 * A Bot is personal to its creator. The Owner always can.
 * Anyone else needs an explicit grant. A grant is not on the Bot row.
 */

export type BotAccess = {
  /** Owner or Member who created the Bot. Null only before an Owner exists. */
  createdBy: string | null
}

export type BotViewer = {
  id: string
  role: 'owner' | 'member'
}

/**
 * Owner, creator, or an explicit grant.
 * Pass `granted` when this viewer has a `bot_grants` row.
 */
export function canSeeBot(bot: BotAccess, viewer: BotViewer, granted = false): boolean {
  if (viewer.role === 'owner') {
    return true
  }
  if (bot.createdBy != null && bot.createdBy === viewer.id) {
    return true
  }
  return granted
}

/** Manifest edit and delete: the creator and the Owner. A grantee chats only. */
export function canEditBot(bot: BotAccess, viewer: BotViewer): boolean {
  if (viewer.role === 'owner') {
    return true
  }
  return bot.createdBy != null && bot.createdBy === viewer.id
}

export function canDeleteBot(bot: BotAccess, viewer: BotViewer): boolean {
  return canEditBot(bot, viewer)
}

/** The Owner grants on any Bot. The creator grants on their own. A grantee cannot re-share. */
export function canGrantBot(bot: BotAccess, viewer: BotViewer): boolean {
  return canEditBot(bot, viewer)
}

/** Always this viewer's own bot-thread, including a Bot they did not create. */
export function botThreadPersonId(_bot: BotAccess, viewer: BotViewer): string {
  return viewer.id
}
