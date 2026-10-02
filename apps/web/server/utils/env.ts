import process from 'node:process'

/** Prefer live process.env — compose injects this at container start. */
export function agentToken(env: NodeJS.ProcessEnv = process.env): string {
  return env.NUXT_AGENT_TOKEN || env.DOSTIGUS_MCP_TOKEN || ''
}

/** Nick-only Catalog Store publish. Empty → publish stays disabled. Not Cluster Admin. */
export function catalogPublishToken(env: NodeJS.ProcessEnv = process.env): string {
  return env.NUXT_CATALOG_PUBLISH_TOKEN || env.DOSTIGUS_CATALOG_PUBLISH_TOKEN || ''
}

export function catalogPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return (env.CATALOG_PUBLIC_ORIGIN ?? '').trim()
}
