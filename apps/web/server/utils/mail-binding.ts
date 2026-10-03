import type { BotMailBindingInput, BotMailBindingView, OpenedStore } from '@dostigus/db'
import type { BotViewer } from '@dostigus/shared'
import { getBotMailBinding, requireBot, StoreError, toBotMailBindingView, viewerMaySeeBot } from '@dostigus/db'

/** The Owner sees every Bot. An Admin binds only a Bot they can open. See ADR 0048. */
export function requireMailBindingBot(store: OpenedStore, botId: string, viewer: BotViewer): void {
  const bot = requireBot(store, botId)
  if (viewer.role !== 'owner' && !viewerMaySeeBot(store, bot, viewer)) {
    throw new StoreError('Bot not found', 404)
  }
}

export type MailBindingState = {
  binding: BotMailBindingView | null
}

export function readMailBindingState(store: OpenedStore, botId: string): MailBindingState {
  const binding = getBotMailBinding(store, botId)
  return { binding: binding ? toBotMailBindingView(binding) : null }
}

export function mailBindingInputFromBody(body: unknown): BotMailBindingInput {
  const row = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  return {
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapUser: row.imapUser,
    imapPassword: row.imapPassword,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpPassword: row.smtpPassword,
  }
}
