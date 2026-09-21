/**
 * Host design kit barrel. Sheets and cards bind here — not per-bot SPAs.
 * Empty on purpose for the scaffold (ADR 0002).
 */
export const uiKitComponents = {} as const

export type UiKitComponentName = keyof typeof uiKitComponents
