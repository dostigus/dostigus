import type { ChatPart } from '@dostigus/shared'

/**
 * Sheets a Chat button may open. Unknown ids stay off the bubble.
 * Day-1 registers `demo`. A Kitchen Module adds its id here later.
 * See ADR 0025.
 */
export type HostSheetEntry = {
  id: string
  title: string
  body: string
}

export const HOST_DEMO_SHEET_ID = 'demo'

const HOST_SHEETS: Record<string, HostSheetEntry> = {
  [HOST_DEMO_SHEET_ID]: {
    id: HOST_DEMO_SHEET_ID,
    title: 'Demo sheet',
    body: 'This Sheet is a Kit drawer. A later Kitchen Module can hang here.',
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
