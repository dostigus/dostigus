/**
 * Bot visibility and who may open which bot-thread.
 * See ADR 0024. A private Bot cannot join a room; this Host has no room
 * join API, so that rule is access on the Bot, not a room write.
 */

export const BOT_VISIBILITIES = ['shared', 'private'] as const

export type BotVisibility = (typeof BOT_VISIBILITIES)[number]

export function isBotVisibility(value: string): value is BotVisibility {
  return (BOT_VISIBILITIES as readonly string[]).includes(value)
}

export type BotAccess = {
  visibility: BotVisibility
  /** Owner or Member who created the Bot. Null only before an Owner exists. */
  createdBy: string | null
}

export type BotViewer = {
  id: string
  role: 'owner' | 'member'
}

/** Owner sees every Bot. A Member sees shared Bots and their own private Bot. */
export function canSeeBot(bot: BotAccess, viewer: BotViewer): boolean {
  if (viewer.role === 'owner') {
    return true
  }
  if (bot.visibility === 'shared') {
    return true
  }
  return bot.createdBy === viewer.id
}

/**
 * Owner edits a shared Bot and a Bot they created.
 * A Member edits only their own private Bot.
 */
export function canEditBot(bot: BotAccess, viewer: BotViewer): boolean {
  if (!canSeeBot(bot, viewer)) {
    return false
  }
  if (viewer.role === 'owner') {
    return bot.visibility === 'shared' || bot.createdBy == null || bot.createdBy === viewer.id
  }
  return bot.visibility === 'private' && bot.createdBy === viewer.id
}

export function canDeleteBot(bot: BotAccess, viewer: BotViewer): boolean {
  return canEditBot(bot, viewer)
}

/** Only the Owner flips visibility. A flip keeps the creator. */
export function canFlipBotVisibility(viewer: BotViewer): boolean {
  return viewer.role === 'owner'
}

/**
 * The person on the bot-thread this viewer opens.
 * A shared Bot uses the viewer's own bot-thread.
 * The Owner opening a Member's private Bot uses that Member's bot-thread.
 */
export function botThreadPersonId(bot: BotAccess, viewer: BotViewer): string {
  if (
    bot.visibility === 'private'
    && viewer.role === 'owner'
    && bot.createdBy
    && bot.createdBy !== viewer.id
  ) {
    return bot.createdBy
  }
  return viewer.id
}
