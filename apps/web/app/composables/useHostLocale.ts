import type { HostLocale } from '@dostigus/ui-kit/locale'
import {
  DEFAULT_HOST_LOCALE,
  HOST_LOCALE_COOKIE,
  isHostLocale,
} from '@dostigus/ui-kit/locale'

export function useHostLocale() {
  const { locale, setLocale, t } = useI18n()
  const config = useRuntimeConfig()
  const cookie = useCookie(HOST_LOCALE_COOKIE, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  const preview = Boolean(config.public.previewSeed)
  const saving = ref(false)
  const message = ref('')
  const messageError = ref(false)

  const current = computed<HostLocale>(() => {
    return isHostLocale(locale.value) ? locale.value : DEFAULT_HOST_LOCALE
  })

  async function choose(next: HostLocale) {
    saving.value = true
    message.value = ''
    messageError.value = false
    const localeToWrite = preview ? DEFAULT_HOST_LOCALE : next
    try {
      cookie.value = localeToWrite
      if (!preview) {
        await $fetch('/api/settings/locale', {
          method: 'PUT',
          body: { locale: localeToWrite },
        })
      }
      await setLocale(localeToWrite)
      message.value = t('settings.other.locale.saved')
    } catch {
      messageError.value = true
      message.value = t('settings.providers.saveFailed')
    } finally {
      saving.value = false
    }
  }

  return { current, cookie, preview, saving, message, messageError, choose }
}
