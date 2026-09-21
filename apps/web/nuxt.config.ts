import process from 'node:process'

export default defineNuxtConfig({
  telemetry: false,
  compatibilityDate: '2026-09-21',
  future: {
    compatibilityVersion: 4,
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/fonts', '@nuxtjs/mcp-toolkit', 'nuxt-auth-utils'],
  mcp: {
    name: 'Dostigus',
    route: '/mcp',
    description: 'Cluster Store MCP surface: Bots and Chat messages.',
    instructions: 'Call dostigus_bots_* and dostigus_messages_* against the Cluster Store. The Host UI uses the same Store helpers.',
    // Cursor / IDE clients are not same-origin
    security: { allowedOrigins: '*' },
  },
  runtimeConfig: {
    // Bearer for /mcp (NUXT_AGENT_TOKEN or DOSTIGUS_MCP_TOKEN). Empty → tools stay disabled.
    agentToken: process.env.NUXT_AGENT_TOKEN || process.env.DOSTIGUS_MCP_TOKEN || '',
    // Sealed Host Owner session. NUXT_SESSION_PASSWORD (≥32 chars) is required in production.
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
    },
  },
  fonts: {
    families: [
      { name: 'Nunito', provider: 'google', weights: [400, 600, 700] },
    ],
  },
  app: {
    head: {
      title: 'Dostigus',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Self-host agent OS: portable bot packages + host UI sheets.',
        },
      ],
    },
  },
  nitro: {
    prerender: {
      crawlLinks: false,
    },
    externals: {
      inline: ['@dostigus/db', '@dostigus/shared', '@dostigus/ui-kit'],
      external: ['node:sqlite'],
    },
  },
})
