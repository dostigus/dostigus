export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    'nuxt-auth-utils',
  ],

  runtimeConfig: {
    databaseUrl: '',
    session: {
      password: '',
      cookie: {
        secure: import.meta.env?.NODE_ENV === 'production',
      },
    },
    public: {
      dostigusCloud: false,
    },
  },

  site: {
    url: 'https://dostigus.ru',
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en', file: 'en.json', name: 'English' },
      { code: 'ru', language: 'ru', file: 'ru.json', name: 'Русский' },
    ],
    defaultLocale: 'ru',
    langDir: 'locales',
    strategy: 'prefix_except_default',
  },

  colorMode: {
    preference: 'system',
    fallback: 'light',
  },

  css: ['~/assets/css/main.css'],

  icon: {
    clientBundle: {
      scan: {
        globInclude: ['app/**/*.{vue,ts}'],
        globExclude: ['node_modules', 'dist', 'build', 'coverage', 'test', 'tests', '.*'],
      },
      includeCustomCollections: true,
    },
    serverBundle: 'local',
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
