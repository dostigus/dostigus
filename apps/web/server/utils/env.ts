import process from 'node:process'

/** Prefer live process.env — compose injects this at container start. */
export function agentToken(env: NodeJS.ProcessEnv = process.env): string {
  return env.NUXT_AGENT_TOKEN || env.DOSTIGUS_MCP_TOKEN || ''
}
