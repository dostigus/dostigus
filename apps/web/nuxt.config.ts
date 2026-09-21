export default defineNuxtConfig({
  telemetry: false,
  compatibilityDate: '2026-09-21',
  future: {
    compatibilityVersion: 4,
  },
  css: ['~/assets/css/main.css'],
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
