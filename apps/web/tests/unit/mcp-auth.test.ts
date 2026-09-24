import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { authorizeMcpAgent, mcpToolsEnabled, readAuthorizationHeader } from '../../server/utils/mcp-auth'
import { CHAT_MCP_TOOLS, CREATOR_MEMBER_CHAT_MCP_TOOLS, KITCHEN_MCP_TOOLS, MEMBER_CHAT_MCP_TOOLS, PLATFORM_MCP_TOOLS, SCHEDULE_MCP_TOOLS, SKILL_MCP_TOOLS } from '../../server/utils/mcp-surface'

function event() {
  return { context: {} as { agentOk?: boolean } }
}

it('leaves tools disabled when the expected token is empty', () => {
  const ev = event()
  authorizeMcpAgent(ev, 'Bearer anything', '')
  expect(ev.context.agentOk).toBeUndefined()
  expect(mcpToolsEnabled(ev)).toBe(false)
})

it('does not authorize a missing or non-Bearer header', () => {
  const missing = event()
  authorizeMcpAgent(missing, undefined, 'secret')
  expect(mcpToolsEnabled(missing)).toBe(false)

  const basic = event()
  authorizeMcpAgent(basic, 'Basic secret', 'secret')
  expect(mcpToolsEnabled(basic)).toBe(false)
})

it('does not authorize a wrong Bearer token', () => {
  const ev = event()
  authorizeMcpAgent(ev, 'Bearer nope', 'secret')
  expect(mcpToolsEnabled(ev)).toBe(false)
})

it('reads Authorization from Node, Headers, and plain header maps', () => {
  expect(readAuthorizationHeader({
    node: { req: { headers: { authorization: 'Bearer node' } } },
  })).toBe('Bearer node')
  expect(readAuthorizationHeader({
    headers: { get: (name) => name === 'authorization' ? 'Bearer web' : null },
  })).toBe('Bearer web')
  expect(readAuthorizationHeader({
    req: { headers: { authorization: 'Bearer req' } },
  })).toBe('Bearer req')
  expect(readAuthorizationHeader({})).toBeUndefined()
})

it('authorizes a matching Bearer token so tools can enable', () => {
  const ev = event()
  authorizeMcpAgent(ev, 'Bearer secret', 'secret')
  expect(ev.context.agentOk).toBe(true)
  expect(mcpToolsEnabled(ev)).toBe(true)
})

it('lists the Platform MCP surface tools', () => {
  expect(PLATFORM_MCP_TOOLS).toEqual([
    'dostigus_bots_list',
    'dostigus_bots_get',
    'dostigus_bots_create',
    'dostigus_bots_update',
    'dostigus_bots_delete',
    ...SKILL_MCP_TOOLS,
    'dostigus_messages_list',
    'dostigus_messages_create',
    ...SCHEDULE_MCP_TOOLS,
    ...KITCHEN_MCP_TOOLS,
  ])
})

it('keeps delete off the Chat MCP tool list', () => {
  expect(CHAT_MCP_TOOLS).toEqual([
    'dostigus_bots_list',
    'dostigus_bots_get',
    'dostigus_bots_create',
    'dostigus_bots_update',
    ...SKILL_MCP_TOOLS,
    'dostigus_messages_list',
    'dostigus_messages_create',
    ...SCHEDULE_MCP_TOOLS,
  ])
  expect(CHAT_MCP_TOOLS).not.toContain('dostigus_bots_delete')
  for (const name of KITCHEN_MCP_TOOLS) {
    expect(CHAT_MCP_TOOLS).not.toContain(name)
  }
})

it('lets Member Chat manage Schedules and read the Cluster timezone', () => {
  expect(MEMBER_CHAT_MCP_TOOLS).toEqual([
    'dostigus_messages_list',
    'dostigus_messages_create',
    'dostigus_schedules_list',
    'dostigus_schedules_create',
    'dostigus_schedules_update',
    'dostigus_schedules_pause',
    'dostigus_schedules_resume',
    'dostigus_schedules_delete',
    'dostigus_cluster_timezone_get',
  ])
  for (const name of MEMBER_CHAT_MCP_TOOLS) {
    expect(CHAT_MCP_TOOLS).toContain(name)
  }
  expect(MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_bots_create')
  expect(MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_bots_update')
  expect(MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_bots_delete')
  expect(MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_cluster_timezone_set')
  expect(CHAT_MCP_TOOLS).toContain('dostigus_cluster_timezone_set')
  for (const name of SKILL_MCP_TOOLS) {
    expect(MEMBER_CHAT_MCP_TOOLS).not.toContain(name)
  }
})

it('gives a creator Member update and Skills tools on top of Member Chat', () => {
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).toEqual([
    ...MEMBER_CHAT_MCP_TOOLS,
    'dostigus_bots_update',
    ...SKILL_MCP_TOOLS,
  ])
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).toContain('dostigus_schedules_create')
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).toContain('dostigus_cluster_timezone_get')
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_cluster_timezone_set')
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_bots_delete')
  expect(CREATOR_MEMBER_CHAT_MCP_TOOLS).not.toContain('dostigus_bots_create')
  for (const name of CREATOR_MEMBER_CHAT_MCP_TOOLS) {
    expect(CHAT_MCP_TOOLS).toContain(name)
  }
})

it('gates every file-based MCP tool with mcpToolsEnabled', () => {
  const dir = join(import.meta.dirname, '../../server/mcp/tools')
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts')).sort()
  expect(files).toEqual([...PLATFORM_MCP_TOOLS].map((name) => `${name}.ts`).sort())
  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8')
    const name = file.replace(/\.ts$/, '')
    expect(src, file).toContain('enabled: mcpToolsEnabled')
    expect(src, file).toContain(`'${name}'`)
  }
})
