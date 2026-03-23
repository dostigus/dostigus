export const MEDIA_TYPES = ['book', 'music', 'movie', 'game'] as const
export type MediaType = typeof MEDIA_TYPES[number]

export const MEDIA_STATUSES = ['planned', 'in_progress', 'completed', 'dropped', 'on_hold'] as const
export type MediaStatus = typeof MEDIA_STATUSES[number]

export const MAX_RATING = 10
export const MIN_RATING = 1
