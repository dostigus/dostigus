import { expect, it } from 'vitest'
import { agentToken } from '../../server/utils/env'

it('is empty when neither MCP token env is set', () => {
  expect(agentToken({})).toBe('')
})

it('reads NUXT_AGENT_TOKEN', () => {
  expect(agentToken({ NUXT_AGENT_TOKEN: 'from-nuxt' })).toBe('from-nuxt')
})

it('aliases DOSTIGUS_MCP_TOKEN when NUXT_AGENT_TOKEN is empty', () => {
  expect(agentToken({ DOSTIGUS_MCP_TOKEN: 'from-alias' })).toBe('from-alias')
})

it('prefers NUXT_AGENT_TOKEN over the alias', () => {
  expect(agentToken({
    NUXT_AGENT_TOKEN: 'primary',
    DOSTIGUS_MCP_TOKEN: 'alias',
  })).toBe('primary')
})
