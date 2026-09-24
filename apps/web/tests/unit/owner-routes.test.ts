import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const apiRoot = join(import.meta.dirname, '../../server/api')

function walkTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walkTs(path)
    }
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

it('wraps requireUserSession for Host Owner routes', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/utils/owner-session.ts'),
    'utf8',
  )
  expect(src).toContain('requireUserSession')
  expect(src).toContain('setUserSession')
  expect(src).toContain('clearUserSession')
})

it('lets Owner and Member sessions read Bots and Chat', () => {
  const files = [
    'bots/index.get.ts',
    'bots/index.post.ts',
    'bots/[id].get.ts',
    'bots/[id].patch.ts',
    'bots/[id].delete.ts',
    'bots/[id]/messages.get.ts',
    'bots/[id]/messages.post.ts',
    'bots/[id]/grants/index.get.ts',
    'bots/[id]/grants/index.post.ts',
    'bots/[id]/grants/[personId].delete.ts',
    'chat/ready.get.ts',
    'kitchen/index.get.ts',
    'kitchen/pantry.post.ts',
    'kitchen/cooked.post.ts',
    'kitchen/recipe.put.ts',
    'people/index.get.ts',
    'threads/index.get.ts',
    'threads/index.post.ts',
    'threads/room-access.get.ts',
    'threads/[id].get.ts',
    'threads/[id]/messages.post.ts',
  ]
  for (const file of files) {
    const src = readFileSync(join(apiRoot, file), 'utf8')
    const gated = src.includes('requireHostSession') || src.includes('withHostStore')
    expect(gated, file).toBe(true)
    expect(src, file).not.toContain('withOwnerStore')
  }
})

it('keeps Bot writes, Settings, and Members with the Owner', () => {
  const files = [
    'settings/llm-gateway.get.ts',
    'settings/llm-gateway.put.ts',
    'settings/llm-gateway/ping.post.ts',
    'members/index.get.ts',
    'members/index.post.ts',
    'members/[id]/disable.post.ts',
    'members/invites/index.get.ts',
    'members/invites/index.post.ts',
    'members/invites/[id]/revoke.post.ts',
    'members/invites/[id]/rotate.post.ts',
  ]
  for (const file of files) {
    const src = readFileSync(join(apiRoot, file), 'utf8')
    const gated = src.includes('requireOwnerSession') || src.includes('withOwnerStore')
    expect(gated, file).toBe(true)
    expect(src, file).not.toContain('withHostStore')
    expect(src, file).not.toContain('requireHostSession')
  }
})

it('answers HEAD /health with the GET content type and no session', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../server/routes/health.head.ts'),
    'utf8',
  )
  expect(src).toContain('setResponseStatus(event, 200)')
  expect(src).toContain('content-type')
  expect(src).toContain('application/json')
  expect(src).toContain('healthBody')
  expect(src).toContain('event.node.res.end()')
  expect(src).not.toContain('return null')
  expect(src).not.toContain('requireUserSession')
  expect(src).not.toContain('useStore')
  const getSrc = readFileSync(
    join(import.meta.dirname, '../../server/routes/health.get.ts'),
    'utf8',
  )
  expect(getSrc).toContain('healthBody')
})

it('keeps auth status, register, login, and health public', () => {
  const publicFiles = [
    join(apiRoot, 'auth/status.get.ts'),
    join(apiRoot, 'auth/register.post.ts'),
    join(apiRoot, 'auth/login.post.ts'),
    join(apiRoot, 'invites/[token].get.ts'),
    join(apiRoot, 'invites/[token].post.ts'),
    join(import.meta.dirname, '../../server/routes/health.get.ts'),
    join(import.meta.dirname, '../../server/routes/health.head.ts'),
  ]
  for (const file of publicFiles) {
    const src = readFileSync(file, 'utf8')
    expect(src, file).not.toContain('requireUserSession')
    expect(src, file).not.toContain('requireOwnerSession')
    expect(src, file).not.toContain('requireHostSession')
    expect(src, file).not.toContain('withOwnerStore')
    expect(src, file).not.toContain('withHostStore')
  }
})

it('replies in a room only after an @Name mention', () => {
  const src = readFileSync(join(apiRoot, 'threads/[id]/messages.post.ts'), 'utf8')
  expect(src).toContain('mentionedRoomBot')
  expect(src).toContain('requireHostSession')
  expect(src.indexOf('mentionedRoomBot')).toBeLessThan(src.indexOf('completeAssistantReply'))
  expect(src).toContain('appendMessengerUserLine')
})

it('invokes Chat MCP tools in-process from the Host message route', () => {
  const src = readFileSync(join(apiRoot, 'bots/[id]/messages.post.ts'), 'utf8')
  expect(src).toContain('invokeChatMcpTool')
  expect(src).toContain('chatMcpToolsAsOpenAi(role)')
  expect(src).toContain('personId')
  expect(src).not.toMatch(/fetch\([^)]*\/mcp/)
  expect(src).toContain('requireHostSession')
})

it('keeps Invite links reachable while logged out', () => {
  const src = readFileSync(
    join(import.meta.dirname, '../../app/middleware/owner.global.ts'),
    'utf8',
  )
  expect(src).toContain('function isInvitePath')
  expect(src).toContain('path.startsWith(\'/invite/\')')
  expect(src).toContain('if (isInvitePath(to.path))')
})

it('does not gate the MCP surface on the Host Owner session', () => {
  const mcpRoot = join(import.meta.dirname, '../../server/mcp')
  const files = [
    join(import.meta.dirname, '../../server/utils/mcp-auth.ts'),
    join(mcpRoot, 'index.ts'),
    ...walkTs(join(mcpRoot, 'tools')),
  ]
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    expect(src, file).not.toContain('requireUserSession')
    expect(src, file).not.toContain('requireOwnerSession')
    expect(src, file).not.toContain('requireHostSession')
    expect(src, file).not.toContain('withOwnerStore')
    expect(src, file).not.toContain('withHostStore')
  }
})
