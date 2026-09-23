import type { ChatPart } from '@dostigus/shared'

/**
 * Sheets a Chat button may open. Unknown ids stay off the bubble.
 * `demo` is the ADR 0025 drawer. `kitchen` is the Kitchen Module Sheet
 * (ADR 0026).
 */
export type HostSheetEntry = {
  id: string
  title: string
  /** `note` is a short body. `kitchen` mounts the Kitchen Sheet. */
  kind: 'note' | 'kitchen'
  body: string
}

export const HOST_DEMO_SHEET_ID = 'demo'
export const HOST_KITCHEN_SHEET_ID = 'kitchen'

const HOST_SHEETS: Record<string, HostSheetEntry> = {
  [HOST_DEMO_SHEET_ID]: {
    id: HOST_DEMO_SHEET_ID,
    title: 'Demo sheet',
    kind: 'note',
    body: 'This Sheet is a Kit drawer.',
  },
  [HOST_KITCHEN_SHEET_ID]: {
    id: HOST_KITCHEN_SHEET_ID,
    title: 'Kitchen',
    kind: 'kitchen',
    body: '',
  },
}

export function hostSheetById(id: string): HostSheetEntry | undefined {
  return HOST_SHEETS[id]
}

/** Status parts stay. A button renders only when the Host knows that Sheet. */
export function hostChatParts(parts: ChatPart[]): ChatPart[] {
  return parts.filter((part) => {
    if (part.kind !== 'button') {
      return true
    }
    return hostSheetById(part.action.sheetId) != null
  })
}
