import type { ChatPart } from '@dostigus/shared'
import type { HostLocale } from '@dostigus/ui-kit/locale'
import { DEFAULT_HOST_LOCALE, tHost } from '@dostigus/ui-kit/locale'

/**
 * Sheets a Chat button or Chat Card may open. Unknown ids stay off the bubble.
 * `demo` is the ADR 0025 drawer. `kitchen` is the Kitchen Module Sheet
 * (ADR 0026). `schedule` is one Schedule (ADR 0030).
 */
export type HostSheetEntry = {
  id: string
  title: string
  /** `note` is a short body. `kitchen` and `schedule` mount their Sheets. */
  kind: 'note' | 'kitchen' | 'schedule'
  body: string
}

export const HOST_DEMO_SHEET_ID = 'demo'
export const HOST_KITCHEN_SHEET_ID = 'kitchen'
export const HOST_SCHEDULE_SHEET_ID = 'schedule'

function hostSheets(locale: HostLocale): Record<string, HostSheetEntry> {
  return {
    [HOST_DEMO_SHEET_ID]: {
      id: HOST_DEMO_SHEET_ID,
      title: tHost(locale, 'sheet.demo.title'),
      kind: 'note',
      body: tHost(locale, 'sheet.demo.body'),
    },
    [HOST_KITCHEN_SHEET_ID]: {
      id: HOST_KITCHEN_SHEET_ID,
      title: tHost(locale, 'sheet.kitchen.title'),
      kind: 'kitchen',
      body: '',
    },
    [HOST_SCHEDULE_SHEET_ID]: {
      id: HOST_SCHEDULE_SHEET_ID,
      title: tHost(locale, 'sheet.schedule.title'),
      kind: 'schedule',
      body: '',
    },
  }
}

export function hostSheetById(id: string, locale: HostLocale = DEFAULT_HOST_LOCALE): HostSheetEntry | undefined {
  return hostSheets(locale)[id]
}

/** Status and Card parts stay. A button or Card action renders only for a known Sheet. */
export function hostChatParts(parts: ChatPart[]): ChatPart[] {
  return parts.flatMap((part): ChatPart[] => {
    if (part.kind === 'button') {
      return hostSheetById(part.action.sheetId) ? [part] : []
    }
    if (part.kind === 'card') {
      return [{
        ...part,
        actions: part.actions.filter((action) => hostSheetById(action.action.sheetId) != null),
      }]
    }
    return [part]
  })
}
