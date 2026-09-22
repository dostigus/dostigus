import { expect, it } from 'vitest'
import {
  nextSidebar,
  SIDEBAR_COLLAPSE_AT,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from '../../app/utils/sidebar-width'

it('collapses below the rail threshold and clamps an expanded width', () => {
  expect(nextSidebar(SIDEBAR_DEFAULT, SIDEBAR_COLLAPSE_AT - 1)).toEqual({
    width: SIDEBAR_DEFAULT,
    collapsed: true,
  })
  expect(nextSidebar(SIDEBAR_DEFAULT, 200)).toEqual({
    width: SIDEBAR_MIN,
    collapsed: false,
  })
  expect(nextSidebar(240, 320)).toEqual({
    width: 320,
    collapsed: false,
  })
  expect(nextSidebar(SIDEBAR_DEFAULT, 900)).toEqual({
    width: SIDEBAR_MAX,
    collapsed: false,
  })
})
