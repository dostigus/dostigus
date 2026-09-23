import type { AssistantReplyVia } from '@dostigus/shared'

/**
 * Preview-only wait before a no-key Chat reply is stored.
 * Long enough to screenshot the in-flight flock mark. Production never
 * uses this. See AGENTS.md and ADR 0021.
 */
export const PREVIEW_QUIET_HOLD_MS = 12_000

/** `?hold=1` on the Chat page or the message POST. h3 may parse `1` as a number. */
export function previewHoldRequested(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => item === '1' || item === 1)
  }
  return value === '1' || value === 1
}

/** Chat location after preview seed. `hold` stays on the page so the next send waits. */
export function previewChatLocation(botId: string, hold: unknown): string {
  const path = `/bots/${botId}`
  return previewHoldRequested(hold) ? `${path}?hold=1` : path
}

/**
 * Milliseconds to wait before storing a quiet stub.
 * Zero unless the preview seed gate is open, the request asked for `hold`,
 * and the reply is the no-key stub. A configured gateway is not delayed.
 */
export function previewQuietHoldMs(input: {
  allowed: boolean
  hold: unknown
  via: AssistantReplyVia
}): number {
  if (!input.allowed || !previewHoldRequested(input.hold) || input.via !== 'stub') {
    return 0
  }
  return PREVIEW_QUIET_HOLD_MS
}

/** No-ops when `ms` is 0 so a production reply is not delayed. */
export function waitPreviewQuietHold(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
