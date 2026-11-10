import { describe, expect, it } from 'vitest'
import { VISION_ROLE_QUICK, VISION_TABLE_COLUMNS, visionRoleQuickActive } from '../visionRoleQuick'

describe('visionRoleQuick', () => {
  it('lists all roles', () => {
    expect(VISION_ROLE_QUICK.map(o => o.value)).toEqual([
      '',
      'TOP',
      'JUNGLE',
      'MIDDLE',
      'BOTTOM',
      'SUPPORT',
    ])
  })
  it('matches current role, case-insensitive, UTILITY as SUPPORT', () => {
    expect(visionRoleQuickActive('')).toBe('')
    expect(visionRoleQuickActive('jungle')).toBe('JUNGLE')
    expect(visionRoleQuickActive('UTILITY')).toBe('SUPPORT')
    expect(visionRoleQuickActive('mid')).toBe('MIDDLE')
    expect(visionRoleQuickActive('ADC')).toBe('BOTTOM')
    expect(visionRoleQuickActive('top')).toBe('TOP')
  })
  it('returns null for a role outside the quick set', () => {
    expect(visionRoleQuickActive('FILL')).toBeNull()
  })
})

describe('VISION_TABLE_COLUMNS', () => {
  it('follows the mock order, stealth wards implicit', () => {
    expect(VISION_TABLE_COLUMNS).toEqual([
      'visionScore',
      'visionScorePerMinute',
      'wardsPlaced',
      'controlWardsPlaced',
      'wardsKilled',
    ])
  })
})
