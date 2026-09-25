import type { HostLocaleMessages } from '@dostigus/ui-kit/locale'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends HostLocaleMessages {}
}

export {}
