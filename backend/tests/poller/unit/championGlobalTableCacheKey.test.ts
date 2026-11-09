import { describe, it, expect } from 'vitest'
import { championGlobalTableCacheKey } from '../../../src/services/championGlobalTableCacheKey.js'

describe('championGlobalTableCacheKey', () => {
  it('normalise versions et rangs (ordre, casse, espaces)', () => {
    expect(championGlobalTableCacheKey(['16.22', ' 16.21'], ['gold', 'IRON '], 'mid', false)).toBe(
      championGlobalTableCacheKey(['16.21', '16.22'], ['IRON', 'GOLD'], 'MID', false)
    )
  })
  it('distingue rang, rôle, split', () => {
    const base = championGlobalTableCacheKey('16.22', 'GOLD', null, false)
    expect(championGlobalTableCacheKey('16.22', 'IRON', null, false)).not.toBe(base)
    expect(championGlobalTableCacheKey('16.22', 'GOLD', 'TOP', false)).not.toBe(base)
    expect(championGlobalTableCacheKey('16.22', 'GOLD', null, true)).not.toBe(base)
  })
  it('null/vide/all sont équivalents pour le rang', () => {
    expect(championGlobalTableCacheKey(null, null, null)).toBe(championGlobalTableCacheKey('', 'all', ''))
  })
})
