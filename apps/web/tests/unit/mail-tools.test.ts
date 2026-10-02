import type { MailOutgoing, MailTransport } from '../../server/utils/mail-client'
import type { MailDestination } from '../../server/utils/mail-net'
import {
  createBot,
  createMember,
  createOwner,
  openStore,
  setBotMailBinding,
  setMailAllowlist,
  StoreError,
} from '@dostigus/db'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { htmlToText } from '../../server/utils/mail-client'
import { resolveMailDestination } from '../../server/utils/mail-net'
import { clearMailDrafts, mailSend, testMailBinding } from '../../server/utils/mail-tools'
import { invokeChatMcpTool } from '../../server/utils/mcp-platform-tools'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

beforeEach(() => {
  clearMailDrafts()
})

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

const publicLookup = async () => [{ address: '198.51.100.7', family: 4 }]

type Call = { kind: string, dest: MailDestination, message?: MailOutgoing }

function fakeTransport(calls: Call[]): MailTransport {
  return {
    list: async (dest) => {
      calls.push({ kind: 'list', dest })
      return [{ uid: 7, messageId: '<m7@example.com>', date: null, from: [], to: [], subject: 'Hi', seen: false }]
    },
    get: async (dest) => {
      calls.push({ kind: 'get', dest })
      return null
    },
    send: async (dest, _login, message) => {
      calls.push({ kind: 'send', dest, message })
      return { messageId: '<sent@example.com>' }
    },
    verifyImap: async (dest) => {
      calls.push({ kind: 'verifyImap', dest })
    },
    verifySmtp: async (dest) => {
      calls.push({ kind: 'verifySmtp', dest })
      throw new StoreError('SMTP sign-in was rejected', 401)
    },
  }
}

function seed() {
  const store = memoryStore()
  const owner = createOwner(store, { username: 'ada', passwordHash: 'hash:ada' })
  const member = createMember(store, { displayName: 'Grace', username: 'grace', passwordHash: 'hash:grace' })
  const bot = createBot(store, { name: 'Mailer', createdBy: owner.id }).bot
  const other = createBot(store, { name: 'Other', createdBy: owner.id }).bot
  setMailAllowlist(store, ['imap.example.com:993', 'smtp.example.com:465'])
  setBotMailBinding(store, bot.id, {
    imapHost: 'imap.example.com',
    imapPort: 993,
    imapUser: 'ada@example.com',
    imapPassword: 'app-password-1234',
    smtpHost: 'smtp.example.com',
    smtpPort: 465,
  })
  return { store, owner, member, bot, other }
}

const DRAFT = { to: ['bob@example.org'], subject: 'Dinner', body: 'Seven works.' }

it('connects to the checked address with the bound host as TLS servername', async () => {
  const dest = await resolveMailDestination(
    { host: 'IMAP.example.com', port: 993 },
    ['imap.example.com:993'],
    publicLookup,
  )
  expect(dest).toEqual({ host: 'imap.example.com', port: 993, address: '198.51.100.7', servername: 'imap.example.com' })
})

it('refuses a host or port off the mail allowlist before DNS', async () => {
  let looked = false
  const lookup = async () => {
    looked = true
    return [{ address: '198.51.100.7', family: 4 }]
  }
  await expect(resolveMailDestination({ host: 'imap.example.com', port: 143 }, ['imap.example.com:993'], lookup))
    .rejects
    .toMatchObject({ statusCode: 403, message: 'imap.example.com:143 is not on the mail allowlist' })
  await expect(resolveMailDestination({ host: 'imap.example.com', port: 993 }, [], lookup))
    .rejects
    .toMatchObject({ statusCode: 403 })
  expect(looked).toBe(false)
})

it('blocks loopback, private, link-local, and mapped addresses even when allowlisted', async () => {
  const cases: Array<[string, string[]]> = [
    ['127.0.0.1', ['127.0.0.1:993']],
    ['10.1.2.3', ['10.1.2.3:993']],
    ['169.254.169.254', ['169.254.169.254:993']],
    ['[::1]', ['[::1]:993']],
    ['[fe80::1]', ['[fe80::1]:993']],
    ['[::ffff:192.168.1.10]', ['[::ffff:192.168.1.10]:993']],
  ]
  for (const [host, allowlist] of cases) {
    await expect(resolveMailDestination({ host, port: 993 }, allowlist, publicLookup), host)
      .rejects
      .toMatchObject({ statusCode: 403, message: 'blocked destination' })
  }
  const rebinding = async () => [{ address: '198.51.100.7', family: 4 }, { address: '192.168.0.4', family: 4 }]
  await expect(resolveMailDestination({ host: 'imap.example.com', port: 993 }, ['imap.example.com:993'], rebinding))
    .rejects
    .toMatchObject({ message: 'blocked destination' })
})

it('lists mail on the turn Bot and refuses another Bot on that turn', async () => {
  const { store, owner, bot, other } = seed()
  const calls: Call[] = []
  const listed = await invokeChatMcpTool({
    name: 'dostigus_mail_list',
    args: {},
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    lookup: publicLookup,
    mailTransport: fakeTransport(calls),
  })
  expect(listed.ok).toBe(true)
  expect(JSON.parse(listed.content)).toMatchObject({ mailbox: 'ada@example.com', messages: [{ uid: 7 }] })
  expect(calls[0]?.dest.address).toBe('198.51.100.7')

  const crossed = await invokeChatMcpTool({
    name: 'dostigus_mail_list',
    args: { botId: other.id },
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: bot.id,
    lookup: publicLookup,
    mailTransport: fakeTransport(calls),
  })
  expect(JSON.parse(crossed.content)).toEqual({ error: 'Mail on this turn stays on this Bot' })

  const unbound = await invokeChatMcpTool({
    name: 'dostigus_mail_list',
    args: {},
    store,
    role: 'owner',
    personId: owner.id,
    turnBotId: other.id,
    lookup: publicLookup,
    mailTransport: fakeTransport(calls),
  })
  expect(JSON.parse(unbound.content).error).toContain('no mailbox yet')
})

it('drafts by default and sends only on a later turn from the same person', async () => {
  const { store, owner, member, bot } = seed()
  const calls: Call[] = []
  const transport = fakeTransport(calls)
  const base = { turnBotId: bot.id, lookup: publicLookup, mailTransport: transport }

  const draft = await mailSend(store, { ...DRAFT, confirm: true }, { ...base, personId: owner.id, turnKey: 't1' })
    .catch((error: StoreError) => error)
  expect(draft).toBeInstanceOf(StoreError)

  const composed = await mailSend(store, DRAFT, { ...base, personId: owner.id, turnKey: 't1' })
  expect(composed).toMatchObject({ status: 'draft', from: 'ada@example.com', to: ['bob@example.org'], subject: 'Dinner' })
  expect(calls.filter((call) => call.kind === 'send')).toHaveLength(0)
  const draftId = (composed as { draftId: string }).draftId

  await expect(mailSend(store, { draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 't1' }))
    .rejects
    .toMatchObject({ statusCode: 409 })
  await expect(mailSend(store, { draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 't2', wake: true }))
    .rejects
    .toMatchObject({ statusCode: 403 })
  await expect(mailSend(store, { draftId, confirm: true }, { ...base, personId: member.id, turnKey: 't2' }))
    .rejects
    .toMatchObject({ statusCode: 404 })
  const mcp = { lookup: publicLookup, mailTransport: transport }
  const mcpDraft = await mailSend(store, { ...DRAFT, botId: bot.id }, mcp) as { draftId: string }
  await expect(mailSend(store, { botId: bot.id, draftId: mcpDraft.draftId, confirm: true }, mcp))
    .rejects
    .toMatchObject({ statusCode: 403, message: 'Mail send needs a person to confirm in Chat' })
  expect(calls.filter((call) => call.kind === 'send')).toHaveLength(0)

  const again = await mailSend(store, { draftId }, { ...base, personId: owner.id, turnKey: 't2' })
  expect(again).toMatchObject({ status: 'draft', draftId })
  expect(calls.filter((call) => call.kind === 'send')).toHaveLength(0)

  const sent = await mailSend(store, { draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 't2' })
  expect(sent).toMatchObject({ status: 'sent', messageId: '<sent@example.com>', to: ['bob@example.org'] })
  const sends = calls.filter((call) => call.kind === 'send')
  expect(sends).toHaveLength(1)
  expect(sends[0]?.dest).toMatchObject({ host: 'smtp.example.com', port: 465 })
  expect(sends[0]?.message).toMatchObject({ from: 'ada@example.com', subject: 'Dinner', text: 'Seven works.' })

  await expect(mailSend(store, { draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 't3' }))
    .rejects
    .toMatchObject({ statusCode: 404 })
})

it('keeps a Wake draft for the Schedule person to confirm in Chat', async () => {
  const { store, owner, bot } = seed()
  const calls: Call[] = []
  const base = { turnBotId: bot.id, lookup: publicLookup, mailTransport: fakeTransport(calls) }
  const composed = await mailSend(store, DRAFT, { ...base, personId: owner.id, turnKey: 'wake-1', wake: true }) as { draftId: string }
  await expect(mailSend(store, { draftId: composed.draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 'wake-1', wake: true }))
    .rejects
    .toMatchObject({ statusCode: 403 })
  const sent = await mailSend(store, { draftId: composed.draftId, confirm: true }, { ...base, personId: owner.id, turnKey: 'chat-2' })
  expect(sent).toMatchObject({ status: 'sent' })
})

it('validates recipients, subject header injection, and Message-ID on a draft', async () => {
  const { store, owner, bot } = seed()
  const ctx = { turnBotId: bot.id, personId: owner.id, turnKey: 't1', lookup: publicLookup, mailTransport: fakeTransport([]) }
  await expect(mailSend(store, { ...DRAFT, to: ['not-an-address'] }, ctx)).rejects.toThrow('invalid address')
  await expect(mailSend(store, { ...DRAFT, to: ['a@b.co', 'Bcc: x@y.co'] }, ctx)).rejects.toThrow('invalid address')
  await expect(mailSend(store, { ...DRAFT, subject: 'Hi\r\nBcc: x@y.co' }, ctx)).rejects.toThrow('one line')
  await expect(mailSend(store, { ...DRAFT, inReplyTo: 'no brackets' }, ctx)).rejects.toThrow('Message-ID')
  await expect(mailSend(store, { ...DRAFT, to: Array.from({ length: 11 }, (_, i) => `p${i}@example.org`) }, ctx))
    .rejects
    .toThrow('at most 10')
})

it('lets a Member draft mail on a Wake turn', async () => {
  const { store, member, bot } = seed()
  const result = await invokeChatMcpTool({
    name: 'dostigus_mail_send',
    args: DRAFT,
    store,
    role: 'member',
    personId: member.id,
    turnBotId: bot.id,
    wake: true,
    allowedTools: ['dostigus_mail_list', 'dostigus_mail_get', 'dostigus_mail_send'],
    lookup: publicLookup,
    mailTransport: fakeTransport([]),
    turnKey: 'w1',
  })
  expect(result.ok).toBe(true)
  expect(JSON.parse(result.content)).toMatchObject({ status: 'draft' })
})

it('reports each side of a test connection without leaking the login', async () => {
  const { store, bot } = seed()
  const calls: Call[] = []
  const { getBotMailBinding } = await import('@dostigus/db')
  const result = await testMailBinding(store, getBotMailBinding(store, bot.id)!, {
    lookup: publicLookup,
    mailTransport: fakeTransport(calls),
  })
  expect(result.imap).toEqual({ ok: true, error: null, statusCode: null })
  expect(result.smtp).toEqual({ ok: false, error: 'SMTP sign-in was rejected', statusCode: 401 })
  expect(JSON.stringify(result)).not.toContain('app-password-1234')

  setMailAllowlist(store, ['imap.example.com:993'])
  const blocked = await testMailBinding(store, getBotMailBinding(store, bot.id)!, {
    lookup: publicLookup,
    mailTransport: fakeTransport([]),
  })
  expect(blocked.smtp).toMatchObject({ ok: false, statusCode: 403 })
})

it('flattens HTML mail to text', () => {
  expect(htmlToText('<style>p{}</style><p>Hi&nbsp;<b>Ada</b></p><p>Bye &amp; thanks</p>'))
    .toBe('Hi Ada\nBye & thanks')
})

it('decodes HTML entities once, not twice', () => {
  expect(htmlToText('<p>&amp;lt;b&amp;gt; &amp;amp; &lt;i&gt;</p>')).toBe('&lt;b&gt; &amp; <i>')
  expect(htmlToText('&#60;&#x3E;&QUOT;&apos;&#169; &bogus; &#0; &#xD800;')).toBe('<>"\'© &bogus; &#0; &#xD800;')
})
