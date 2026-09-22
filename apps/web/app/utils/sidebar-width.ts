/** Wide-screen sidebar sizes, in pixels. The narrow drawer ignores these. */
export const SIDEBAR_DEFAULT = 280
export const SIDEBAR_MIN = 220
export const SIDEBAR_MAX = 440
export const SIDEBAR_RAIL = 68
/** Dragging below this width collapses the sidebar to the icon rail. */
export const SIDEBAR_COLLAPSE_AT = 168
export const SIDEBAR_STORAGE_KEY = 'dostigus.host.sidebar'

export function nextSidebar(currentWidth: number, requested: number): { width: number, collapsed: boolean } {
  if (requested < SIDEBAR_COLLAPSE_AT) {
    return { width: currentWidth, collapsed: true }
  }
  return {
    width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, requested)),
    collapsed: false,
  }
}
