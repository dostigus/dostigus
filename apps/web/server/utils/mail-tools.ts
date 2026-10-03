import type { BotMailBinding, OpenedStore } from '@dostigus/db'
import type { MailOutgoing, MailTransport } from './mail-client'
import type { ScheduleToolContext } from './schedule-tools'
import { randomUUID } from 'node:crypto'
import { getBotMailBinding, requireBot, StoreError } from '@dostigus/db'
import { imapSmtpTransport } from './mail-client'
import { resolveMailDestination } from './mail-net'

export const MAIL_LIST_DEFAULT = 20
export const MAIL_LIST_MAX = 50
export const MAIL_RECIPIENTS_MAX = 10
export const MAIL_SUBJECT_MAX = 300
export const MAIL_BODY_SEND_MAX = 20_000
/** A draft waits this long for the person to confirm. */
export const MAIL_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const MAIL_DRAFTS_MAX = 500

const EMAIL = /^[^\s@<>",;:]{1,64}@[^\s@<>",;:]{1,253}\.[^\s@<>",;:]{2,63}$/
const MESSAGE_ID = /^<[^\s<>]{3,500}>$/

export type MailToolContext = ScheduleToolContext & {
  now?: () => number
}

type MailDraft = {
  id: string
  botId: string
  /** The person whose turn composed the draft (the Schedule person on Wake). */
  personId: string | null
  /** The Chat turn that composed it. Confirm must arrive on a later turn. */
  turnKey: string | null
  createdAt: number
  message: MailOutgoing
}

const drafts = new Map<string, MailDraft>()

/** Test hook. Drafts live in Host memory only (no mail tables, ADR 0048). */
export function clearMailDrafts(): void {
  drafts.clear()
}

function pruneDrafts(now: number): void {
  for (const [id, draft] of drafts) {
    if (now - draft.createdAt > MAIL_DRAFT_TTL_MS) {
      drafts.delete(id)
    }
  }
  while (drafts.size > MAIL_DRAFTS_MAX) {
    const oldest = drafts.keys().next().value
    if (oldest === undefined) {
      break
    }
    drafts.delete(oldest)
  }
}

/** Chat turns stay on their Bot. `/mcp` names the Bot. */
function mailBotId(input: Record<string, unknown>, ctx?: MailToolContext): string {
  const named = typeof input.botId === 'string' ? input.botId.trim() : ''
  if (ctx?.turnBotId) {
    if (named && named !== ctx.turnBotId) {
      throw new StoreError('Mail on this turn stays on this Bot', 403)
    }
    return ctx.turnBotId
  }
  if (!named) {
    throw new StoreError('Name the Bot', 400)
  }
  return named
}

function requireBinding(store: OpenedStore, botId: string): BotMailBinding {
  requireBot(store, botId)
  const binding = getBotMailBinding(store, botId)
  if (!binding) {
    throw new StoreError('This Bot has no mailbox yet. The Owner or an Admin binds it in the Closet.', 409)
  }
  return binding
}

function transportFor(ctx?: MailToolContext): MailTransport {
  return ctx?.mailTransport ?? imapSmtpTransport
}

function clampLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) {
    return MAIL_LIST_DEFAULT
  }
  return Math.min(Math.floor(n), MAIL_LIST_MAX)
}

export async function mailList(store: OpenedStore, input: Record<string, unknown>, ctx?: MailToolContext) {
  const botId = mailBotId(input, ctx)
  const binding = requireBinding(store, botId)
  const dest = await resolveMailDestination(binding.imap, ctx?.lookup)
  const messages = await transportFor(ctx).list(dest, binding.imap, {
    limit: clampLimit(input.limit),
    unseenOnly: input.unseenOnly === true,
  })
  return { mailbox: binding.imap.user, messages }
}

export async function mailGet(store: OpenedStore, input: Record<string, unknown>, ctx?: MailToolContext) {
  const botId = mailBotId(input, ctx)
  const uid = typeof input.uid === 'number' ? input.uid : Number.parseInt(String(input.uid ?? ''), 10)
  if (!Number.isInteger(uid) || uid < 1) {
    throw new StoreError('uid is a positive integer from dostigus_mail_list', 400)
  }
  const binding = requireBinding(store, botId)
  const dest = await resolveMailDestination(binding.imap, ctx?.lookup)
  const message = await transportFor(ctx).get(dest, binding.imap, uid)
  if (!message) {
    throw new StoreError('Message not found', 404)
  }
  return { message }
}

function recipients(value: unknown, label: 'to' | 'cc'): string[] {
  if (value == null || value === '') {
    return []
  }
  const list = Array.isArray(value)
    ? value
    : String(value).split(',')
  const out: string[] = []
  for (const item of list) {
    const address = typeof item === 'string' ? item.trim() : ''
    if (!address) {
      continue
    }
    if (!EMAIL.test(address)) {
      throw new StoreError(`${label} has an invalid address`, 400)
    }
    if (!out.includes(address.toLowerCase())) {
      out.push(address.toLowerCase())
    }
  }
  return out
}

function singleLine(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StoreError(`${label} is required`, 400)
  }
  const text = value.trim()
  if (/[\r\n]/.test(text) || text.length > max) {
    throw new StoreError(`${label} is one line of ${max} characters or fewer`, 400)
  }
  return text
}

function composeDraft(binding: BotMailBinding, input: Record<string, unknown>): MailOutgoing {
  const to = recipients(input.to, 'to')
  const cc = recipients(input.cc, 'cc')
  if (to.length === 0) {
    throw new StoreError('to needs at least one address', 400)
  }
  if (to.length + cc.length > MAIL_RECIPIENTS_MAX) {
    throw new StoreError(`A draft has at most ${MAIL_RECIPIENTS_MAX} recipients`, 400)
  }
  const subject = singleLine(input.subject, MAIL_SUBJECT_MAX, 'subject')
  if (typeof input.body !== 'string' || !input.body.trim()) {
    throw new StoreError('body is required', 400)
  }
  if (input.body.length > MAIL_BODY_SEND_MAX) {
    throw new StoreError(`body is ${MAIL_BODY_SEND_MAX} characters or fewer`, 400)
  }
  let inReplyTo: string | null = null
  if (typeof input.inReplyTo === 'string' && input.inReplyTo.trim()) {
    inReplyTo = input.inReplyTo.trim()
    if (!MESSAGE_ID.test(inReplyTo)) {
      throw new StoreError('inReplyTo is a Message-ID such as <id@host>', 400)
    }
  }
  const from = binding.smtp.user
  if (!EMAIL.test(from)) {
    throw new StoreError('The SMTP user is not an email address. The Owner or an Admin fixes it in the Closet.', 409)
  }
  return { from, to, cc, subject, text: input.body.replace(/\r\n/g, '\n'), inReplyTo }
}

function draftView(draft: MailDraft) {
  return {
    draftId: draft.id,
    from: draft.message.from,
    to: draft.message.to,
    cc: draft.message.cc,
    subject: draft.message.subject,
    body: draft.message.text,
    inReplyTo: draft.message.inReplyTo,
  }
}

const CONFIRM_NOTE = 'Not sent. Show this draft to the person and ask whether to send it. Only after the person confirms on a later message, call dostigus_mail_send with this draftId and confirm true.'

/**
 * Draft by default. Real SMTP send only on `confirm: true` for an existing
 * draft, from the same person on the same Bot, on a later Chat turn than the
 * one that composed it. A Wake and `/mcp` never send. See ADR 0048.
 */
export async function mailSend(store: OpenedStore, input: Record<string, unknown>, ctx?: MailToolContext) {
  const now = (ctx?.now ?? Date.now)()
  pruneDrafts(now)
  const botId = mailBotId(input, ctx)
  const binding = requireBinding(store, botId)
  const personId = ctx?.personId ?? null
  const draftId = typeof input.draftId === 'string' ? input.draftId.trim() : ''

  if (!draftId) {
    if (input.confirm === true) {
      throw new StoreError('Compose a draft first. confirm sends an existing draftId.', 400)
    }
    const draft: MailDraft = {
      id: randomUUID(),
      botId,
      personId,
      turnKey: ctx?.turnKey ?? null,
      createdAt: now,
      message: composeDraft(binding, input),
    }
    drafts.set(draft.id, draft)
    return { status: 'draft' as const, ...draftView(draft), note: CONFIRM_NOTE }
  }

  const draft = drafts.get(draftId)
  if (!draft || draft.botId !== botId || draft.personId !== personId) {
    throw new StoreError('Draft not found. Compose it again.', 404)
  }
  if (input.confirm !== true) {
    return { status: 'draft' as const, ...draftView(draft), note: CONFIRM_NOTE }
  }
  if (ctx?.wake) {
    throw new StoreError('A Wake does not send mail. Leave the draft for the person to confirm in Chat.', 403)
  }
  if (!personId || !ctx?.turnKey) {
    throw new StoreError('Mail send needs a person to confirm in Chat', 403)
  }
  if (draft.turnKey === ctx.turnKey) {
    throw new StoreError('Show the draft and wait. The person confirms on their next message.', 409)
  }
  const dest = await resolveMailDestination(binding.smtp, ctx.lookup)
  const sent = await transportFor(ctx).send(dest, binding.smtp, draft.message)
  drafts.delete(draft.id)
  return {
    status: 'sent' as const,
    messageId: sent.messageId,
    to: draft.message.to,
    cc: draft.message.cc,
    subject: draft.message.subject,
  }
}

/** Closet test connection: IMAP sign-in, then SMTP sign-in. No mail is read or sent. */
export async function testMailBinding(
  store: OpenedStore,
  binding: BotMailBinding,
  ctx?: Pick<MailToolContext, 'lookup' | 'mailTransport'>,
): Promise<{ imap: MailCheck, smtp: MailCheck }> {
  const transport = ctx?.mailTransport ?? imapSmtpTransport
  const check = async (fn: () => Promise<void>): Promise<MailCheck> => {
    try {
      await fn()
      return { ok: true, error: null, statusCode: null }
    } catch (error) {
      if (error instanceof StoreError) {
        return { ok: false, error: error.message, statusCode: error.statusCode }
      }
      return { ok: false, error: 'request failed', statusCode: 502 }
    }
  }
  const [imap, smtp] = await Promise.all([
    check(async () => {
      const dest = await resolveMailDestination(binding.imap, ctx?.lookup)
      await transport.verifyImap(dest, binding.imap)
    }),
    check(async () => {
      const dest = await resolveMailDestination(binding.smtp, ctx?.lookup)
      await transport.verifySmtp(dest, binding.smtp)
    }),
  ])
  return { imap, smtp }
}

export type MailCheck = {
  ok: boolean
  error: string | null
  statusCode: number | null
}
