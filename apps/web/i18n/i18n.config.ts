import {
  DEFAULT_HOST_LOCALE,
  isHostLocale,
  tHost,
} from '@dostigus/ui-kit/locale'

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: DEFAULT_HOST_LOCALE,
  missingWarn: false,
  fallbackWarn: false,
  missing: (locale: string, key: string) => {
    return tHost(isHostLocale(locale) ? locale : DEFAULT_HOST_LOCALE, key)
  },
}))
