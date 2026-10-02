import type { MailLogin } from '@dostigus/db'
import type { FetchMessageObject, MessageAddressObject, MessageStructureObject } from 'imapflow'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { MailDestination } from './mail-net'
import { Buffer } from 'node:buffer'
import { StoreError } from '@dostigus/db'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

/** Text body cap for dostigus_mail_get, same budget as Host HTTP get. */
export const MAIL_BODY_MAX_BYTES = 65_536
const CONNECT_TIMEOUT_MS = 10_000
const SOCKET_TIMEOUT_MS = 20_000

export type MailAddress = {
  name: string | null
  address: string
}

export type MailSummary = {
  uid: number
  messageId: string | null
  date: string | null
  from: MailAddress[]
  to: MailAddress[]
  subject: string
  seen: boolean
}

export type MailMessage = MailSummary & {
  cc: MailAddress[]
  replyTo: MailAddress[]
  inReplyTo: string | null
  text: string
  truncated: boolean
  attachments: Array<{ filename: string, mime: string, size: number | null }>
}

export type MailOutgoing = {
  from: string
  to: string[]
  cc: string[]
  subject: string
  text: string
  inReplyTo: string | null
}

/** IMAP/SMTP calls the Mailer tools make. Tests pass a double. */
export type MailTransport = {
  list: (dest: MailDestination, login: MailLogin, options: { limit: number, unseenOnly: boolean }) => Promise<MailSummary[]>
  get: (dest: MailDestination, login: MailLogin, uid: number) => Promise<MailMessage | null>
  send: (dest: MailDestination, login: MailLogin, message: MailOutgoing) => Promise<{ messageId: string | null }>
  verifyImap: (dest: MailDestination, login: MailLogin) => Promise<void>
  verifySmtp: (dest: MailDestination, login: MailLogin) => Promise<void>
}

function imapClient(dest: MailDestination, login: MailLogin): ImapFlow {
  const starttls = dest.port === 143
  return new ImapFlow({
    host: dest.address,
    port: dest.port,
    secure: !starttls,
    doSTARTTLS: starttls ? true : undefined,
    servername: dest.servername ?? undefined,
    auth: { user: login.user, pass: login.password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  })
}

function smtpTransport(dest: MailDestination, login: MailLogin) {
  const implicitTls = dest.port === 465
  const options: SMTPTransport.Options & { servername?: string } = {
    host: dest.address,
    port: dest.port,
    secure: implicitTls,
    requireTLS: !implicitTls,
    servername: dest.servername ?? undefined,
    tls: dest.servername ? { servername: dest.servername } : undefined,
    auth: { user: login.user, pass: login.password },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    logger: false,
  }
  return nodemailer.createTransport(options)
}

/** Server replies can echo the login; never pass them through. */
function mailError(kind: 'IMAP' | 'SMTP', error: unknown): StoreError {
  if (error instanceof StoreError) {
    return error
  }
  const record = (error ?? {}) as { authenticationFailed?: boolean, code?: string, responseCode?: number }
  if (record.authenticationFailed || record.code === 'EAUTH' || record.responseCode === 535) {
    return new StoreError(`${kind} sign-in was rejected`, 401)
  }
  if (record.code === 'ETIMEDOUT' || record.code === 'ETIMEOUT' || record.code === 'CONNECT_TIMEOUT') {
    return new StoreError(`${kind} server timed out`, 504)
  }
  if (record.code === 'ESOCKET' || record.code === 'ECONNREFUSED' || record.code === 'ECONNECTION') {
    return new StoreError(`${kind} server refused the connection`, 502)
  }
  return new StoreError(`${kind} request failed`, 502)
}

async function withImap<T>(
  dest: MailDestination,
  login: MailLogin,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = imapClient(dest, login)
  client.on('error', () => {})
  try {
    await client.connect()
    return await fn(client)
  } catch (error) {
    throw mailError('IMAP', error)
  } finally {
    await client.logout().catch(() => client.close())
  }
}

function addresses(rows: MessageAddressObject[] | undefined): MailAddress[] {
  return (rows ?? [])
    .filter((row) => typeof row.address === 'string' && row.address)
    .map((row) => ({ name: row.name?.trim() || null, address: row.address! }))
}

function isoDate(value: Date | string | undefined): string | null {
  if (!value) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toSummary(message: FetchMessageObject): MailSummary {
  const envelope = message.envelope
  return {
    uid: message.uid,
    messageId: envelope?.messageId ?? null,
    date: isoDate(envelope?.date ?? message.internalDate),
    from: addresses(envelope?.from),
    to: addresses(envelope?.to),
    subject: envelope?.subject ?? '',
    seen: message.flags?.has('\\Seen') ?? false,
  }
}

type BodyParts = {
  plain: string | null
  html: string | null
  attachments: MailMessage['attachments']
}

function walkStructure(node: MessageStructureObject | undefined, out: BodyParts): void {
  if (!node) {
    return
  }
  if (node.childNodes?.length) {
    for (const child of node.childNodes) {
      walkStructure(child, out)
    }
    return
  }
  const part = node.part ?? '1'
  const isAttachment = node.disposition === 'attachment'
    || Boolean(node.dispositionParameters?.filename)
  if (!isAttachment && node.type === 'text/plain' && out.plain == null) {
    out.plain = part
    return
  }
  if (!isAttachment && node.type === 'text/html' && out.html == null) {
    out.html = part
    return
  }
  if (isAttachment || !node.type.startsWith('multipart/')) {
    out.attachments.push({
      filename: node.dispositionParameters?.filename ?? node.parameters?.name ?? 'attachment',
      mime: node.type,
      size: typeof node.size === 'number' ? node.size : null,
    })
  }
}

/** Crude HTML to text for a model; enough to read a message, not to render it. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, '\'')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readCapped(stream: NodeJS.ReadableStream, max: number): Promise<{ bytes: Buffer, truncated: boolean }> {
  const chunks: Buffer[] = []
  let total = 0
  let truncated = false
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    if (total + buf.byteLength > max) {
      chunks.push(buf.subarray(0, max - total))
      total = max
      truncated = true
      break
    }
    chunks.push(buf)
    total += buf.byteLength
  }
  return { bytes: Buffer.concat(chunks, total), truncated }
}

export const imapSmtpTransport: MailTransport = {
  list: (dest, login, options) => withImap(dest, login, async (client) => {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      let range: string | number[]
      let byUid = false
      if (options.unseenOnly) {
        const uids = await client.search({ seen: false }, { uid: true })
        if (!uids || uids.length === 0) {
          return []
        }
        range = uids.slice(-options.limit)
        byUid = true
      } else {
        const exists = client.mailbox ? client.mailbox.exists : 0
        if (exists === 0) {
          return []
        }
        range = `${Math.max(1, exists - options.limit + 1)}:*`
      }
      const rows: MailSummary[] = []
      for await (const message of client.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: byUid })) {
        rows.push(toSummary(message))
      }
      return rows.sort((left, right) => right.uid - left.uid).slice(0, options.limit)
    } finally {
      lock.release()
    }
  }),
  get: (dest, login, uid) => withImap(dest, login, async (client) => {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const message = await client.fetchOne(String(uid), {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        bodyStructure: true,
      }, { uid: true })
      if (!message) {
        return null
      }
      const parts: BodyParts = { plain: null, html: null, attachments: [] }
      walkStructure(message.bodyStructure, parts)
      let text = ''
      let truncated = false
      const part = parts.plain ?? parts.html
      if (part) {
        const download = await client.download(String(uid), part, { uid: true, maxBytes: MAIL_BODY_MAX_BYTES * 4 })
        if (download.content) {
          const capped = await readCapped(download.content, MAIL_BODY_MAX_BYTES * 4)
          const raw = capped.bytes.toString('utf8')
          const decoded = parts.plain ? raw : htmlToText(raw)
          const bytes = Buffer.from(decoded, 'utf8')
          truncated = capped.truncated || bytes.byteLength > MAIL_BODY_MAX_BYTES
          text = truncated ? bytes.subarray(0, MAIL_BODY_MAX_BYTES).toString('utf8') : decoded
        }
      }
      const envelope = message.envelope
      return {
        ...toSummary(message),
        cc: addresses(envelope?.cc),
        replyTo: addresses(envelope?.replyTo),
        inReplyTo: envelope?.inReplyTo ?? null,
        text,
        truncated,
        attachments: parts.attachments,
      }
    } finally {
      lock.release()
    }
  }),
  send: async (dest, login, message) => {
    const transport = smtpTransport(dest, login)
    try {
      const info = await transport.sendMail({
        from: message.from,
        to: message.to,
        cc: message.cc.length > 0 ? message.cc : undefined,
        subject: message.subject,
        text: message.text,
        inReplyTo: message.inReplyTo ?? undefined,
        references: message.inReplyTo ?? undefined,
      })
      return { messageId: typeof info.messageId === 'string' ? info.messageId : null }
    } catch (error) {
      throw mailError('SMTP', error)
    } finally {
      transport.close()
    }
  },
  verifyImap: (dest, login) => withImap(dest, login, async () => {}),
  verifySmtp: async (dest, login) => {
    const transport = smtpTransport(dest, login)
    try {
      await transport.verify()
    } catch (error) {
      throw mailError('SMTP', error)
    } finally {
      transport.close()
    }
  },
}
