import { describe, expect, it } from 'vitest'
import { parseRankTierQuery, rankTierSelectionsEqual } from './statisticsRankTierQuery'

describe('parseRankTierQuery', () => {
  it('parses repeated and comma-separated rank tiers', () => {
    expect(parseRankTierQuery(['DIAMOND', 'PLATINUM'])).toEqual(['DIAMOND', 'PLATINUM'])
    expect(parseRankTierQuery('DIAMOND,PLATINUM')).toEqual(['DIAMOND', 'PLATINUM'])
    expect(parseRankTierQuery(null)).toEqual([])
  })

  it('dedupes tiers', () => {
    expect(parseRankTierQuery(['DIAMOND', 'diamond'])).toEqual(['DIAMOND'])
  })
})

describe('rankTierSelectionsEqual', () => {
  it('compares order-insensitively', () => {
    expect(rankTierSelectionsEqual(['PLATINUM', 'DIAMOND'], ['DIAMOND', 'PLATINUM'])).toBe(true)
    expect(rankTierSelectionsEqual(['GOLD'], ['DIAMOND'])).toBe(false)
  })
})
