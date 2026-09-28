import { describe, expect, it } from 'vitest'
import { cohortSqlWhere } from '../../../../src/stats/cohortSqlWhere.js'

describe('cohortSqlWhere', () => {
  it('is always true without filters', () => {
    expect(cohortSqlWhere('ac', {})).toBe('1=1')
  })

  it('filters champion, tiers, patch prefix and role on the alias', () => {
    expect(
      cohortSqlWhere('vs', { championId: 266, rankTier: ['gold', 'PLATINUM'], version: '16.18.1', role: 'MID' })
    ).toBe(
      "vs.champion_id = 266 AND vs.rank_tier IN ('GOLD','PLATINUM') AND vs.game_version LIKE '16.18%' AND vs.role = 'MIDDLE'"
    )
  })

  it('uses equality for a single tier and escapes quotes', () => {
    expect(cohortSqlWhere('duo', { rankTier: "o'k" })).toBe("1=1 AND duo.rank_tier = 'O''K'")
  })
})
