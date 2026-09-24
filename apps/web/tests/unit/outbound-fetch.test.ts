import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Agent, ProxyAgent } from 'undici'
import { expect, it } from 'vitest'
import {
  createOutboundDispatcher,
  formatOutboundProxyLog,
  logClusterOutboundProxies,
  parseOutboundProxyUrl,
  resolveBotHttpOutboundProxy,
  resolveLlmOutboundProxy,
  warnIfNodeUseEnvProxy,
} from '../../server/utils/outbound-fetch'

it('parses unset, empty, usable, and invalid proxy URLs', () => {
  expect(parseOutboundProxyUrl(undefined)).toEqual({ kind: 'unset' })
  expect(parseOutboundProxyUrl('')).toEqual({ kind: 'unset' })
  expect(parseOutboundProxyUrl('   ')).toEqual({ kind: 'unset' })
  expect(parseOutboundProxyUrl('http://proxy.example:8080')).toEqual({
    kind: 'proxy',
    href: 'http://proxy.example:8080/',
    hostname: 'proxy.example',
  })
  expect(parseOutboundProxyUrl('http://user:s3cret@127.0.0.1:8888')).toEqual({
    kind: 'proxy',
    href: 'http://user:s3cret@127.0.0.1:8888/',
    hostname: '127.0.0.1',
  })
  expect(parseOutboundProxyUrl('not-a-url')).toEqual({ kind: 'invalid' })
  expect(parseOutboundProxyUrl('socks5://proxy.example')).toEqual({ kind: 'invalid' })
  expect(parseOutboundProxyUrl('ftp://proxy.example')).toEqual({ kind: 'invalid' })
})

it('picks LLM proxy env by target scheme and never reads DOSTIGUS_HTTP_PROXY', () => {
  const both = {
    HTTPS_PROXY: 'http://https-proxy.example:8080',
    HTTP_PROXY: 'http://http-proxy.example:8080',
    DOSTIGUS_HTTP_PROXY: 'http://bot-proxy.example:8080',
  }
  expect(resolveLlmOutboundProxy('https://openrouter.ai/api/v1', both)).toMatchObject({
    kind: 'proxy',
    hostname: 'https-proxy.example',
  })
  expect(resolveLlmOutboundProxy('http://gateway.local/v1', both)).toMatchObject({
    kind: 'proxy',
    hostname: 'http-proxy.example',
  })
  expect(resolveLlmOutboundProxy('http://gateway.local/v1', {
    HTTPS_PROXY: 'http://https-proxy.example:8080',
    DOSTIGUS_HTTP_PROXY: 'http://bot-proxy.example:8080',
  })).toEqual({ kind: 'unset' })
  expect(resolveLlmOutboundProxy('https://openrouter.ai/api/v1', {
    HTTP_PROXY: 'http://http-proxy.example:8080',
  })).toMatchObject({
    kind: 'proxy',
    hostname: 'http-proxy.example',
  })
  expect(resolveLlmOutboundProxy('https://openrouter.ai/api/v1', {
    HTTPS_PROXY: '::::',
    HTTP_PROXY: 'http://http-proxy.example:8080',
  })).toEqual({ kind: 'invalid' })
})

it('reads only DOSTIGUS_HTTP_PROXY for Bot HTTP egress', () => {
  expect(resolveBotHttpOutboundProxy({
    HTTPS_PROXY: 'http://llm-proxy.example:8080',
    HTTP_PROXY: 'http://llm-proxy.example:8080',
  })).toEqual({ kind: 'unset' })
  expect(resolveBotHttpOutboundProxy({
    DOSTIGUS_HTTP_PROXY: '  ',
    HTTPS_PROXY: 'http://llm-proxy.example:8080',
  })).toEqual({ kind: 'unset' })
  expect(resolveBotHttpOutboundProxy({
    DOSTIGUS_HTTP_PROXY: 'http://bot-proxy.example:8080',
    HTTPS_PROXY: 'http://llm-proxy.example:8080',
  })).toMatchObject({
    kind: 'proxy',
    hostname: 'bot-proxy.example',
  })
  expect(resolveBotHttpOutboundProxy({
    DOSTIGUS_HTTP_PROXY: 'not-a-url',
  })).toEqual({ kind: 'invalid' })
})

it('builds ProxyAgent or Agent and never EnvHttpProxyAgent', () => {
  expect(createOutboundDispatcher(null)).toBeInstanceOf(Agent)
  expect(createOutboundDispatcher(null)).not.toBeInstanceOf(ProxyAgent)
  expect(createOutboundDispatcher('http://127.0.0.1:8888')).toBeInstanceOf(ProxyAgent)
  const src = readFileSync(join(import.meta.dirname, '../../server/utils/outbound-fetch.ts'), 'utf8')
  expect(src).toContain('new ProxyAgent')
  expect(src).toContain('new Agent(')
  expect(src).not.toContain('EnvHttpProxyAgent')
})

it('logs set or unset plus hostname and never userinfo', () => {
  const lines: string[] = []
  logClusterOutboundProxies({
    HTTPS_PROXY: 'http://user:s3cret@llm-proxy.example:8080',
    DOSTIGUS_HTTP_PROXY: 'http://bot:pass@127.0.0.1:8888',
  }, (message) => {
    lines.push(message)
  })
  const logged = lines.join('\n')
  expect(logged).toContain('Cluster outbound LLM proxy: set (llm-proxy.example)')
  expect(logged).toContain('Cluster outbound Bot HTTP proxy: set (127.0.0.1)')
  expect(logged).not.toContain('user')
  expect(logged).not.toContain('s3cret')
  expect(logged).not.toContain('bot:')
  expect(logged).not.toContain('pass')
  expect(logged).not.toContain('http://')
  expect(formatOutboundProxyLog('Cluster outbound LLM proxy', { kind: 'unset' }))
    .toBe('Cluster outbound LLM proxy: unset')
  expect(formatOutboundProxyLog('Cluster outbound Bot HTTP proxy', { kind: 'invalid' }))
    .toBe('Cluster outbound Bot HTTP proxy: invalid')
})

it('warns once when NODE_USE_ENV_PROXY is set', () => {
  const lines: string[] = []
  warnIfNodeUseEnvProxy({ NODE_USE_ENV_PROXY: '1' }, (message) => {
    lines.push(message)
  })
  warnIfNodeUseEnvProxy({ NODE_USE_ENV_PROXY: '' }, (message) => {
    lines.push(message)
  })
  warnIfNodeUseEnvProxy({}, (message) => {
    lines.push(message)
  })
  expect(lines).toEqual([
    'NODE_USE_ENV_PROXY is set; it is ignored for Host-owned fetch',
  ])
})

it('starts the Host with one NODE_USE_ENV_PROXY warn', () => {
  const src = readFileSync(join(import.meta.dirname, '../../server/plugins/store.ts'), 'utf8')
  expect(src).toContain('warnIfNodeUseEnvProxy')
  expect(src).toContain('logClusterOutboundProxies')
})
