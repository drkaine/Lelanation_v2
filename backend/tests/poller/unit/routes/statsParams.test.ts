import { describe, expect, it } from 'vitest'
import {
  championIdParam,
  queryString,
  queryStringArray,
  rankTierParam,
  statsFilters,
} from '../../../../src/routes/statsParams.js'

describe('queryString', () => {
  it('keeps the first string, drops empty and JSON-like values', () => {
    expect(queryString('16.18')).toBe('16.18')
    expect(queryString(['GOLD', 'SILVER'])).toBe('GOLD')
    expect(queryString('')).toBeNull()
    expect(queryString('[]')).toBeNull()
    expect(queryString(undefined)).toBeNull()
  })
})

describe('queryStringArray', () => {
  it('accepts single or repeated values', () => {
    expect(queryStringArray('a')).toEqual(['a'])
    expect(queryStringArray(['a', '', '[x]', 'b'])).toEqual(['a', 'b'])
    expect(queryStringArray(null)).toEqual([])
  })
})

describe('rankTierParam', () => {
  it('splits, upper-cases and ignores the ALL wildcard', () => {
    expect(rankTierParam(['gold', 'PLATINUM,diamond'])).toEqual(['GOLD', 'PLATINUM', 'DIAMOND'])
    expect(rankTierParam('ALL')).toBeNull()
    expect(rankTierParam(undefined)).toBeNull()
  })
})

describe('statsFilters', () => {
  it('reads version, rank tiers and role', () => {
    expect(statsFilters({ version: '16.18', rankTier: 'GOLD', role: 'MIDDLE' })).toEqual({
      version: '16.18',
      rankTier: ['GOLD'],
      role: 'MIDDLE',
    })
    expect(statsFilters({})).toEqual({ version: null, rankTier: null, role: null })
  })
})

describe('championIdParam', () => {
  it('parses the route param, null when not a number', () => {
    expect(championIdParam('266')).toBe(266)
    expect(championIdParam(['266', '1'])).toBe(266)
    expect(championIdParam('abc')).toBeNull()
    expect(championIdParam('0')).toBe(0)
  })

  it('rejects zero and negatives when positive is required', () => {
    expect(championIdParam('0', { positive: true })).toBeNull()
    expect(championIdParam('-3', { positive: true })).toBeNull()
    expect(championIdParam('7', { positive: true })).toBe(7)
  })
})
