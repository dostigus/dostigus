import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gooseFavicon } from '@dostigus/ui-kit/brand'

const brandDir = fileURLToPath(new URL('../../packages/ui-kit/assets/brand', import.meta.url))

export default defineNuxtConfig({
  telemetry: false,
  // `pnpm preview:host` sets DOSTIGUS_PREVIEW_SEED=1. Nuxt otherwise mounts
  // `nuxt-devtools-frame`, which covers the Invite URL field and the Chat
  // composer. A normal `nuxt dev` leaves devtools on.
  devtools: process.env.DOSTIGUS_PREVIEW_SEED === '1'
    ? { enabled: false }
    : undefined,
  compatibilityDate: '2026-09-21',
  future: {
    compatibilityVersion: 4,
  },
  css: ['~/assets/css/main.css'],
  build: {
    transpile: ['@dostigus/ui-kit'],
  },
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
          content: 'Dostigus Host — Bots and Chat.',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: gooseFavicon.ico },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: gooseFavicon.png32 },
        { rel: 'icon', type: 'image/png', sizes: '620x620', href: gooseFavicon.source },
        { rel: 'apple-touch-icon', sizes: '180x180', href: gooseFavicon.appleTouch },
      ],
    },
  },
  nitro: {
    publicAssets: [
      {
        dir: brandDir,
        baseURL: '/brand',
      },
    ],
    prerender: {
      crawlLinks: false,
    },
    externals: {
      inline: ['@dostigus/db', '@dostigus/shared', '@dostigus/ui-kit'],
      external: ['node:sqlite'],
    },
  },
})
