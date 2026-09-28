import { describe, expect, it } from 'vitest'
import { snapshotFilterSql, snapshotRankTiers, snapshotRole } from '../../../../src/stats/snapshotFilterSql.js'

const TIER = "split_part(upper(trim(s.rank_tier::text)), '_', 1)"

describe('snapshotRankTiers', () => {
  it('keeps the league part of each tier', () => {
    expect(snapshotRankTiers(['gold_ii', 'PLATINUM'])).toEqual(['GOLD', 'PLATINUM'])
    expect(snapshotRankTiers(null)).toEqual([])
  })
})

describe('snapshotFilterSql', () => {
  it('excludes unranked without tiers', () => {
    expect(snapshotFilterSql({})).toBe(`1=1 AND ${TIER} <> 'UNRANKED'`)
  })

  it('filters entity, tiers, role and date range', () => {
    expect(
      snapshotFilterSql({
        entity: { column: 'champion_id', id: 266 },
        rankTiers: ['GOLD', 'SILVER'],
        role: 'mid',
        fromDate: '2026-09-01',
        toDate: '2026-09-10',
      })
    ).toBe(
      `1=1 AND s.champion_id = 266 AND ${TIER} IN ('GOLD', 'SILVER') AND s.role::text = 'MID'` +
        ` AND s.date_of_game >= '2026-09-01'::date AND s.date_of_game <= '2026-09-10'::date`
    )
  })

  it('uses the alias and equality for one tier', () => {
    expect(snapshotFilterSql({ alias: 'item', rankTiers: ['GOLD'] })).toBe(
      `1=1 AND split_part(upper(trim(item.rank_tier::text)), '_', 1) = 'GOLD'`
    )
  })
})

describe('snapshotRole', () => {
  it('normalizes to the snapshot role values', () => {
    expect(snapshotRole('support')).toBe('UTILITY')
    expect(snapshotRole('MID')).toBe('MIDDLE')
    expect(snapshotRole('adc')).toBe('BOTTOM')
    expect(snapshotRole('JUNGLE')).toBe('JUNGLE')
    expect(snapshotRole(null)).toBeNull()
    expect(snapshotRole('')).toBeNull()
  })
})
