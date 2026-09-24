import type { ChatPart } from '@dostigus/shared'

/**
 * Sheets a Chat button or Chat Card may open. Unknown ids stay off the bubble.
 * `demo` is the ADR 0025 drawer. `kitchen` is the Kitchen Module Sheet
 * (ADR 0026). `schedule` is one Schedule. `skill` is one Skill.
 * `bot` opens the existing Bot Параметры closet (ADR 0030).
 */
export type HostSheetEntry = {
  id: string
  title: string
  /**
   * `note` is a short body. `kitchen`, `schedule`, and `skill` mount
   * their Sheets. `bot` is the existing Параметры closet.
   */
  kind: 'note' | 'kitchen' | 'schedule' | 'skill' | 'bot'
  body: string
}

export const HOST_DEMO_SHEET_ID = 'demo'
export const HOST_KITCHEN_SHEET_ID = 'kitchen'
export const HOST_SCHEDULE_SHEET_ID = 'schedule'
export const HOST_SKILL_SHEET_ID = 'skill'
export const HOST_BOT_SHEET_ID = 'bot'

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
  [HOST_SCHEDULE_SHEET_ID]: {
    id: HOST_SCHEDULE_SHEET_ID,
    title: 'Schedule',
    kind: 'schedule',
    body: '',
  },
  [HOST_SKILL_SHEET_ID]: {
    id: HOST_SKILL_SHEET_ID,
    title: 'Skill',
    kind: 'skill',
    body: '',
  },
  [HOST_BOT_SHEET_ID]: {
    id: HOST_BOT_SHEET_ID,
    title: 'Параметры',
    kind: 'bot',
    body: '',
  },
}

export function hostSheetById(id: string): HostSheetEntry | undefined {
  return HOST_SHEETS[id]
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
