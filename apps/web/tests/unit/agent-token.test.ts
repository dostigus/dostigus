import { expect, it } from 'vitest'
import { agentToken, catalogPublicOrigin, catalogPublishToken } from '../../server/utils/env'

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

it('reads the Catalog Store publish token', () => {
  expect(catalogPublishToken({})).toBe('')
  expect(catalogPublishToken({ DOSTIGUS_CATALOG_PUBLISH_TOKEN: 'nick' })).toBe('nick')
  expect(catalogPublishToken({
    NUXT_CATALOG_PUBLISH_TOKEN: 'primary',
    DOSTIGUS_CATALOG_PUBLISH_TOKEN: 'alias',
  })).toBe('primary')
  expect(catalogPublicOrigin({ CATALOG_PUBLIC_ORIGIN: 'https://host.example/' })).toBe(
    'https://host.example/',
  )
})
