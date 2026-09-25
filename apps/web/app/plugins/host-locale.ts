import {
  DEFAULT_HOST_LOCALE,
  HOST_LOCALE_COOKIE,
  resolveHostLocale,
} from '@dostigus/ui-kit/locale'

export default defineNuxtPlugin({
  name: 'dostigus-host-locale',
  async setup() {
    const i18n = useNuxtApp().$i18n
    const config = useRuntimeConfig()
    const cookie = useCookie(HOST_LOCALE_COOKIE, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    const session = useUserSession()
    const preview = Boolean(config.public.previewSeed)
    const memberLocale = session.user.value?.role === 'member'
      ? session.user.value.locale ?? null
      : null
    const locale = resolveHostLocale({
      cookie: cookie.value,
      memberLocale,
      preview,
    })
    if (preview && cookie.value !== DEFAULT_HOST_LOCALE) {
      cookie.value = DEFAULT_HOST_LOCALE
    }
    if (i18n.locale.value !== locale) {
      await i18n.setLocale(locale)
    }
  },
})
