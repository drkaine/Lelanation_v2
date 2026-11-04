import { describe, expect, it } from 'vitest'
import { championColumnFlags, championColumnMode } from '../championColumnGroups'

describe('championColumnFlags', () => {
  it('all shows every group', () => {
    expect(championColumnFlags('all')).toEqual({ heal: true, dealt: true, taken: true })
  })
  it('a single group shows only that group', () => {
    expect(championColumnFlags('dealt')).toEqual({ heal: false, dealt: true, taken: false })
  })
})

describe('championColumnMode', () => {
  it('detects all and single groups', () => {
    expect(championColumnMode({ heal: true, dealt: true, taken: true })).toBe('all')
    expect(championColumnMode({ heal: false, dealt: false, taken: true })).toBe('taken')
  })
  it('returns null for a custom mix', () => {
    expect(championColumnMode({ heal: true, dealt: false, taken: true })).toBeNull()
  })
})
