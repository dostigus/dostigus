import type { OpenedStore } from './store'
import { isIP } from 'node:net'
import { requireBot } from './queries'
import { StoreError } from './store-error'

/** Same singleton row as Cluster timezone and the Cluster http allowlist. See ADR 0048. */
const CLUSTER_SETTINGS_ID = 'cluster'

const HOSTNAME_MAX = 253
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const USER_MAX = 320
const PASSWORD_MAX = 1_024

export type MailEndpoint = {
  host: string
  port: number
}

export type MailLogin = MailEndpoint & {
  user: string
  password: string
}

/** Cluster-side IMAP/SMTP credentials for one Bot. Never in a Pack. See ADR 0048. */
export type BotMailBinding = {
  botId: string
  imap: MailLogin
  smtp: MailLogin
  /** True when SMTP reuses the IMAP user and password. */
  smtpSameLogin: boolean
  updatedBy: string | null
  createdAt: number
  updatedAt: number
}

/** What the Host UI may read. No password. */
export type BotMailBindingView = {
  botId: string
  imap: MailEndpoint & { user: string }
  smtp: MailEndpoint & { user: string }
  smtpSameLogin: boolean
  hasPassword: true
  updatedAt: number
}

export type BotMailBindingInput = {
  imapHost?: unknown
  imapPort?: unknown
  imapUser?: unknown
  imapPassword?: unknown
  smtpHost?: unknown
  smtpPort?: unknown
  smtpUser?: unknown
  smtpPassword?: unknown
}

type BindingRecord = {
  bot_id: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_password: string
  smtp_host: string
  smtp_port: number
  smtp_user: string | null
  smtp_password: string | null
  updated_by: string | null
  created_at: number
  updated_at: number
}

/** Hostname or IP literal, lowercase, no trailing dot. Null when invalid. */
export function normalizeMailHost(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  let host = value.trim().toLowerCase()
  if (!host || /[/?#@*\s]/.test(host) || /^[a-z]+:\/\//.test(host)) {
    return null
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  host = host.replace(/\.$/, '')
  if (isIP(host)) {
    return host
  }
  if (!host || host.includes(':') || host.length > HOSTNAME_MAX) {
    return null
  }
  return host.split('.').every((label) => DNS_LABEL.test(label)) ? host : null
}

export function parseMailPort(value: unknown): number | null {
  const port = typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : value
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return null
  }
  return port
}

function formatEntry(host: string, port: number): string {
  return isIP(host) === 6 ? `[${host}]:${port}` : `${host}:${port}`
}

/** One mail allowlist entry: `host:port` (IPv6 as `[addr]:port`). */
export function parseMailAllowlistEntry(value: unknown): MailEndpoint {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StoreError('Mail allowlist entries are host:port', 400)
  }
  const raw = value.trim()
  const bracketed = /^\[([^\]]+)\]:(\d+)$/.exec(raw)
  const plain = bracketed ? null : /^([^:]+):(\d+)$/.exec(raw)
  const match = bracketed ?? plain
  if (!match) {
    throw new StoreError('Mail allowlist entries are host:port', 400)
  }
  const host = normalizeMailHost(match[1])
  const port = parseMailPort(match[2])
  if (!host || port == null || (bracketed && isIP(host) !== 6)) {
    throw new StoreError('Mail allowlist entries are host:port', 400)
  }
  return { host, port }
}

export function normalizeMailAllowlist(entries: unknown): string[] {
  if (entries == null) {
    return []
  }
  if (!Array.isArray(entries)) {
    throw new StoreError('Mail allowlist must be an array of host:port entries', 400)
  }
  const seen = new Set<string>()
  const next: string[] = []
  for (const entry of entries) {
    const { host, port } = parseMailAllowlistEntry(entry)
    const key = formatEntry(host, port)
    if (!seen.has(key)) {
      seen.add(key)
      next.push(key)
    }
  }
  return next
}

function parseMailAllowlistJson(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new StoreError('Mail allowlist is invalid', 500)
  }
  if (!Array.isArray(parsed)) {
    throw new StoreError('Mail allowlist is invalid', 500)
  }
  return normalizeMailAllowlist(parsed)
}

/**
 * Exact host and exact port. An empty mail allowlist allows nothing:
 * IMAP/SMTP carries a password, so the Owner names each server.
 */
export function mailAllowlistAllows(host: string, port: number, allowlist: readonly string[]): boolean {
  const normalized = normalizeMailHost(host)
  if (!normalized || parseMailPort(port) == null) {
    return false
  }
  return allowlist.includes(formatEntry(normalized, port))
}

export function getMailAllowlist(store: OpenedStore): string[] {
  const row = store.sqlite.prepare(`
    SELECT mail_allowlist FROM cluster_settings WHERE id = ?
  `).get(CLUSTER_SETTINGS_ID) as { mail_allowlist: string | null } | undefined
  return parseMailAllowlistJson(row?.mail_allowlist)
}

export function setMailAllowlist(store: OpenedStore, entries: unknown): string[] {
  const next = normalizeMailAllowlist(entries)
  store.sqlite.prepare(`
    INSERT INTO cluster_settings (id, mail_allowlist, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      mail_allowlist = excluded.mail_allowlist,
      updated_at = excluded.updated_at
  `).run(CLUSTER_SETTINGS_ID, JSON.stringify(next), Date.now())
  return getMailAllowlist(store)
}

function readRecord(store: OpenedStore, botId: string): BindingRecord | undefined {
  return store.sqlite.prepare(`
    SELECT bot_id, imap_host, imap_port, imap_user, imap_password,
      smtp_host, smtp_port, smtp_user, smtp_password,
      updated_by, created_at, updated_at
    FROM bot_mail_bindings
    WHERE bot_id = ?
  `).get(botId) as BindingRecord | undefined
}

function toBinding(row: BindingRecord): BotMailBinding {
  const smtpSameLogin = row.smtp_user == null
  return {
    botId: row.bot_id,
    imap: {
      host: row.imap_host,
      port: row.imap_port,
      user: row.imap_user,
      password: row.imap_password,
    },
    smtp: {
      host: row.smtp_host,
      port: row.smtp_port,
      user: row.smtp_user ?? row.imap_user,
      password: row.smtp_password ?? row.imap_password,
    },
    smtpSameLogin,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toBotMailBindingView(binding: BotMailBinding): BotMailBindingView {
  return {
    botId: binding.botId,
    imap: { host: binding.imap.host, port: binding.imap.port, user: binding.imap.user },
    smtp: { host: binding.smtp.host, port: binding.smtp.port, user: binding.smtp.user },
    smtpSameLogin: binding.smtpSameLogin,
    hasPassword: true,
    updatedAt: binding.updatedAt,
  }
}

export function getBotMailBinding(store: OpenedStore, botId: string): BotMailBinding | null {
  const row = readRecord(store, botId)
  return row ? toBinding(row) : null
}

function requiredText(value: unknown, max: number, message: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new StoreError(message, 400)
  }
  return value.trim()
}

function optionalText(value: unknown, max: number, message: string): string | null {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return null
  }
  return requiredText(value, max, message)
}

/** Password fields are not trimmed: a space can be part of an app password. */
function optionalPassword(value: unknown): string | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string' || value.length > PASSWORD_MAX || !value.trim()) {
    throw new StoreError('Mail password is invalid', 400)
  }
  return value
}

function requiredHost(value: unknown, label: 'IMAP' | 'SMTP'): string {
  const host = normalizeMailHost(value)
  if (!host) {
    throw new StoreError(`${label} host is a hostname`, 400)
  }
  return host
}

function requiredPort(value: unknown, label: 'IMAP' | 'SMTP'): number {
  const port = parseMailPort(value)
  if (port == null) {
    throw new StoreError(`${label} port is 1 to 65535`, 400)
  }
  return port
}

function resolveRecord(
  store: OpenedStore,
  botId: string,
  input: BotMailBindingInput,
  actorId: string | null,
): BindingRecord {
  requireBot(store, botId)
  const existing = readRecord(store, botId)
  const imapHost = requiredHost(input.imapHost, 'IMAP')
  const imapPort = requiredPort(input.imapPort, 'IMAP')
  const imapUser = requiredText(input.imapUser, USER_MAX, 'IMAP user is required')
  const imapPassword = optionalPassword(input.imapPassword) ?? existing?.imap_password ?? null
  if (!imapPassword) {
    throw new StoreError('IMAP password is required', 400)
  }
  const smtpHost = requiredHost(input.smtpHost, 'SMTP')
  const smtpPort = requiredPort(input.smtpPort, 'SMTP')
  const smtpUser = optionalText(input.smtpUser, USER_MAX, 'SMTP user is invalid')
  let smtpPassword: string | null = null
  if (smtpUser) {
    smtpPassword = optionalPassword(input.smtpPassword)
      ?? (existing?.smtp_user != null ? existing.smtp_password : null)
    if (!smtpPassword) {
      throw new StoreError('SMTP password is required when the SMTP user differs', 400)
    }
  }
  const now = Date.now()
  return {
    bot_id: botId,
    imap_host: imapHost,
    imap_port: imapPort,
    imap_user: imapUser,
    imap_password: imapPassword,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_user: smtpUser,
    smtp_password: smtpPassword,
    updated_by: actorId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
}

/**
 * Create or replace the one mailbox on a Bot. An empty password keeps the
 * stored one. Empty SMTP user and password reuse the IMAP login.
 */
export function setBotMailBinding(
  store: OpenedStore,
  botId: string,
  input: BotMailBindingInput,
  actorId: string | null = null,
): BotMailBinding {
  const row = resolveRecord(store, botId, input, actorId)
  store.sqlite.prepare(`
    INSERT INTO bot_mail_bindings (
      bot_id, imap_host, imap_port, imap_user, imap_password,
      smtp_host, smtp_port, smtp_user, smtp_password,
      updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bot_id) DO UPDATE SET
      imap_host = excluded.imap_host,
      imap_port = excluded.imap_port,
      imap_user = excluded.imap_user,
      imap_password = excluded.imap_password,
      smtp_host = excluded.smtp_host,
      smtp_port = excluded.smtp_port,
      smtp_user = excluded.smtp_user,
      smtp_password = excluded.smtp_password,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(
    row.bot_id,
    row.imap_host,
    row.imap_port,
    row.imap_user,
    row.imap_password,
    row.smtp_host,
    row.smtp_port,
    row.smtp_user,
    row.smtp_password,
    row.updated_by,
    row.created_at,
    row.updated_at,
  )
  return toBinding(readRecord(store, botId)!)
}

/** The binding a save would write, for a test connection. Does not write the Store. */
export function previewBotMailBinding(
  store: OpenedStore,
  botId: string,
  input: BotMailBindingInput,
): BotMailBinding {
  return toBinding(resolveRecord(store, botId, input, null))
}

export function deleteBotMailBinding(store: OpenedStore, botId: string): boolean {
  const result = store.sqlite.prepare('DELETE FROM bot_mail_bindings WHERE bot_id = ?').run(botId)
  return Number(result.changes) > 0
}

/** Every secret string on the Bot's binding. Pack export redacts these literally. */
export function botMailSecretLiterals(store: OpenedStore, botId: string): string[] {
  const row = readRecord(store, botId)
  if (!row) {
    return []
  }
  return [row.imap_password, row.smtp_password].filter((value): value is string => {
    return typeof value === 'string' && value.trim().length >= 4
  })
}
