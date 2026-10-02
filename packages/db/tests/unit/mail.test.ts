import { packTreeToZip } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import {
  createBot,
  createOwner,
  deleteBot,
  deleteBotMailBinding,
  exportBotPack,
  getBotMailBinding,
  getClusterHttpAllowlist,
  getMailAllowlist,
  mailAllowlistAllows,
  normalizeMailAllowlist,
  openStore,
  previewBotMailBinding,
  setBotMailBinding,
  setClusterHttpAllowlist,
  setMailAllowlist,
  StoreError,
  toBotMailBindingView,
  upsertBotSkill,
} from '../../src/index'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const BIND = {
  imapHost: 'IMAP.Example.com.',
  imapPort: 993,
  imapUser: 'ada@example.com',
  imapPassword: 'app pass word 1234',
  smtpHost: 'smtp.example.com',
  smtpPort: '465',
}

function seed() {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const { bot } = createBot(store, { name: 'Mailer', createdBy: owner.id })
  return { store, owner, bot }
}

it('denies every mail destination while the mail allowlist is empty', () => {
  const store = memoryStore()
  expect(getMailAllowlist(store)).toEqual([])
  expect(mailAllowlistAllows('imap.example.com', 993, [])).toBe(false)
  expect(setMailAllowlist(store, [])).toEqual([])
})

it('stores host:port entries and matches exact host and exact port', () => {
  const store = memoryStore()
  expect(setMailAllowlist(store, [
    'IMAP.Example.com.:993',
    'imap.example.com:993',
    'smtp.example.com:465',
    '[2001:db8::1]:587',
    '203.0.113.5:587',
  ])).toEqual([
    'imap.example.com:993',
    'smtp.example.com:465',
    '[2001:db8::1]:587',
    '203.0.113.5:587',
  ])
  const list = getMailAllowlist(store)
  expect(mailAllowlistAllows('imap.example.com', 993, list)).toBe(true)
  expect(mailAllowlistAllows('IMAP.EXAMPLE.COM.', 993, list)).toBe(true)
  expect(mailAllowlistAllows('imap.example.com', 143, list)).toBe(false)
  expect(mailAllowlistAllows('example.com', 993, list)).toBe(false)
  expect(mailAllowlistAllows('imap.example.com.evil.test', 993, list)).toBe(false)
  expect(mailAllowlistAllows('2001:db8::1', 587, list)).toBe(true)
  expect(mailAllowlistAllows('[2001:db8::1]', 587, list)).toBe(true)
  expect(mailAllowlistAllows('203.0.113.5', 587, list)).toBe(true)
})

it('rejects scheme, path, userinfo, wildcard, and missing or bad port entries', () => {
  for (const bad of [
    'imap.example.com',
    'imaps://imap.example.com:993',
    'imap.example.com:993/inbox',
    'ada@imap.example.com:993',
    '*.example.com:993',
    'imap.example.com:0',
    'imap.example.com:65536',
    'imap.example.com:99a',
    '2001:db8::1:587',
    '[imap.example.com]:993',
    ':993',
    '',
  ]) {
    expect(() => normalizeMailAllowlist([bad]), bad).toThrow(StoreError)
  }
  expect(() => normalizeMailAllowlist('imap.example.com:993')).toThrow(StoreError)
})

it('keeps the mail allowlist apart from the Cluster http allowlist', () => {
  const store = memoryStore()
  setClusterHttpAllowlist(store, ['api.example.com'])
  setMailAllowlist(store, ['imap.example.com:993'])
  expect(getClusterHttpAllowlist(store)).toEqual(['api.example.com'])
  expect(getMailAllowlist(store)).toEqual(['imap.example.com:993'])
  setClusterHttpAllowlist(store, [])
  expect(getMailAllowlist(store)).toEqual(['imap.example.com:993'])
})

it('binds one mailbox per Bot, keeps a blank password, and reuses the IMAP login for SMTP', () => {
  const { store, owner, bot } = seed()
  expect(() => setBotMailBinding(store, bot.id, { ...BIND, imapPassword: '' })).toThrow('IMAP password is required')

  const first = setBotMailBinding(store, bot.id, BIND, owner.id)
  expect(first.imap).toEqual({ host: 'imap.example.com', port: 993, user: 'ada@example.com', password: 'app pass word 1234' })
  expect(first.smtp).toEqual({ host: 'smtp.example.com', port: 465, user: 'ada@example.com', password: 'app pass word 1234' })
  expect(first.smtpSameLogin).toBe(true)

  const second = setBotMailBinding(store, bot.id, { ...BIND, imapHost: 'mail.example.com', imapPassword: '' }, owner.id)
  expect(second.imap.host).toBe('mail.example.com')
  expect(second.imap.password).toBe('app pass word 1234')
  expect(second.createdAt).toBe(first.createdAt)

  expect(() => setBotMailBinding(store, bot.id, { ...BIND, smtpUser: 'relay@example.com' })).toThrow('SMTP password is required')
  const split = setBotMailBinding(store, bot.id, { ...BIND, smtpUser: 'relay@example.com', smtpPassword: 'relay-secret-99' })
  expect(split.smtp.user).toBe('relay@example.com')
  expect(split.smtp.password).toBe('relay-secret-99')
  expect(split.smtpSameLogin).toBe(false)
})

it('never puts a password in the binding view', () => {
  const { store, bot } = seed()
  const view = toBotMailBindingView(setBotMailBinding(store, bot.id, BIND))
  expect(JSON.stringify(view)).not.toContain('app pass word 1234')
  expect(view.hasPassword).toBe(true)
})

it('previews a binding for a test connection without writing the Store', () => {
  const { store, bot } = seed()
  const preview = previewBotMailBinding(store, bot.id, BIND)
  expect(preview.imap.host).toBe('imap.example.com')
  expect(getBotMailBinding(store, bot.id)).toBeNull()
})

it('rejects bad hosts and ports on a binding', () => {
  const { store, bot } = seed()
  expect(() => setBotMailBinding(store, bot.id, { ...BIND, imapHost: 'imaps://imap.example.com' })).toThrow('IMAP host')
  expect(() => setBotMailBinding(store, bot.id, { ...BIND, smtpPort: 70000 })).toThrow('SMTP port')
  expect(() => setBotMailBinding(store, 'missing', BIND)).toThrow(StoreError)
})

it('drops the binding with the Bot and on unbind', () => {
  const { store, bot } = seed()
  setBotMailBinding(store, bot.id, BIND)
  expect(deleteBotMailBinding(store, bot.id)).toBe(true)
  expect(getBotMailBinding(store, bot.id)).toBeNull()
  setBotMailBinding(store, bot.id, BIND)
  deleteBot(store, bot.id)
  expect(store.sqlite.prepare('SELECT COUNT(*) AS n FROM bot_mail_bindings').get()).toEqual({ n: 0 })
})

it('scrubs the bound mailbox password from a Pack export', () => {
  const { store, owner, bot } = seed()
  setBotMailBinding(store, bot.id, { ...BIND, smtpUser: 'relay@example.com', smtpPassword: 'relay-secret-99' })
  upsertBotSkill(store, bot.id, {
    id: 'inbox',
    description: 'Inbox triage',
    instructions: 'Sign in with app pass word 1234 and relay with relay-secret-99.',
  })
  const exported = exportBotPack(store, bot.id, { id: owner.id, role: 'owner' })
  const text = new TextDecoder().decode(packTreeToZip(exported))
  const json = JSON.stringify(exported)
  for (const secret of ['app pass word 1234', 'relay-secret-99']) {
    expect(json).not.toContain(secret)
    expect(text).not.toContain(secret)
  }
  expect(exported.skills[0]?.instructions).toContain('[redacted]')
  expect(json).not.toContain('imap.example.com')
})
