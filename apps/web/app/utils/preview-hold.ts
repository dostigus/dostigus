import type { AssistantReplyVia } from '@dostigus/shared'
import { parseChatActivityKind } from './chat-activity'

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

/**
 * Short connect name on the preview Chat URL. Matches the activity row
 * cap in `connectActivityLabel` so a long query cannot grow the redirect.
 */
const PREVIEW_CONNECT_TARGET_MAX = 48

/** Allowlisted `?activity=` on the Chat page. Anything else is dropped. */
function previewActivityKind(value: unknown): string | null {
  return parseChatActivityKind(value)
}

/** ASCII controls, including CR/LF, must not land in the redirect header. */
function hasAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1F || code === 0x7F) {
      return true
    }
  }
  return false
}

/**
 * `target` is only meaningful for `activity=connect`. Control characters
 * are dropped so the redirect location stays a single header value.
 */
function previewConnectTarget(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || hasAsciiControl(raw)) {
    return null
  }
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) {
    return null
  }
  return name.length > PREVIEW_CONNECT_TARGET_MAX
    ? name.slice(0, PREVIEW_CONNECT_TARGET_MAX).trimEnd()
    : name
}

/**
 * Chat location after preview seed.
 * `hold` stays on the page so the next send waits.
 * An allowlisted `activity` stays too (`thinking`, `tool`, `typing`,
 * `command`, `connect`). `target` is kept only for `connect`.
 * Members, threads, and rooms redirects do not use this helper.
 */
export function previewChatLocation(
  botId: string,
  hold: unknown,
  activity?: unknown,
  target?: unknown,
): string {
  const params: string[] = []
  if (previewHoldRequested(hold)) {
    params.push('hold=1')
  }
  const kind = previewActivityKind(activity)
  if (kind) {
    params.push(`activity=${kind}`)
    if (kind === 'connect') {
      const name = previewConnectTarget(target)
      if (name) {
        params.push(`target=${encodeURIComponent(name)}`)
      }
    }
  }
  const path = `/bots/${botId}`
  return params.length > 0 ? `${path}?${params.join('&')}` : path
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
