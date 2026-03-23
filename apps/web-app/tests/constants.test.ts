import { MEDIA_STATUSES, MEDIA_TYPES } from '@dostigus/database'
import { describe, expect, it } from 'vitest'

describe('database constants', () => {
  it('media types are defined', () => {
    expect(MEDIA_TYPES).toContain('book')
    expect(MEDIA_TYPES).toContain('music')
    expect(MEDIA_TYPES).toContain('movie')
    expect(MEDIA_TYPES).toContain('game')
    expect(MEDIA_TYPES).toHaveLength(4)
  })

  it('media statuses are defined', () => {
    expect(MEDIA_STATUSES).toContain('planned')
    expect(MEDIA_STATUSES).toContain('in_progress')
    expect(MEDIA_STATUSES).toContain('completed')
    expect(MEDIA_STATUSES).toHaveLength(5)
  })
})
