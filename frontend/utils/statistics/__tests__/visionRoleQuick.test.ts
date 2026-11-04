import { describe, expect, it } from 'vitest'
import { VISION_ROLE_QUICK, visionRoleQuickActive } from '../visionRoleQuick'

describe('visionRoleQuick', () => {
  it('lists all, jungle, support', () => {
    expect(VISION_ROLE_QUICK.map(o => o.value)).toEqual(['', 'JUNGLE', 'SUPPORT'])
  })
  it('matches current role, case-insensitive, UTILITY as SUPPORT', () => {
    expect(visionRoleQuickActive('')).toBe('')
    expect(visionRoleQuickActive('jungle')).toBe('JUNGLE')
    expect(visionRoleQuickActive('UTILITY')).toBe('SUPPORT')
  })
  it('returns null for a role outside the quick set', () => {
    expect(visionRoleQuickActive('TOP')).toBeNull()
  })
})
