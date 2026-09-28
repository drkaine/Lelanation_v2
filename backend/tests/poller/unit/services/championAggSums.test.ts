import { describe, expect, it } from 'vitest'
import {
  avgPerGame,
  championSumsQuery,
  championTableWhere,
  sumColumnsSelect,
} from '../../../../src/services/championAggSums.js'

const squash = (sql: string) => sql.replace(/\s+/g, ' ').trim()

describe('avgPerGame', () => {
  it('rounds the per-game average, 0 without games', () => {
    expect(avgPerGame(10, 3)).toBe(3.33)
    expect(avgPerGame(10, 3, 1)).toBe(3.3)
    expect(avgPerGame(5, 0)).toBe(0)
  })
})

describe('sumColumnsSelect', () => {
  it('sums each column under its own alias with the given cast', () => {
    expect(squash(sumColumnsSelect(['a', 'b'], 'bigint'))).toBe(
      'COALESCE(SUM(cs.a), 0)::bigint AS a, COALESCE(SUM(cs.b), 0)::bigint AS b'
    )
  })
})

describe('championSumsQuery', () => {
  it('groups by champion, keeps champions with games, optionally ordered', () => {
    const sql = squash(championSumsQuery({ from: 'agg cs', where: 'x = 1', sums: 'S', ordered: true }))
    expect(sql).toBe(
      'SELECT cs.champion_id::int AS champion_id, COALESCE(SUM(cs.count_game), 0)::bigint AS games, S ' +
        'FROM agg cs WHERE x = 1 GROUP BY cs.champion_id HAVING COALESCE(SUM(cs.count_game), 0) > 0 ' +
        'ORDER BY champion_id ASC'
    )
    expect(squash(championSumsQuery({ from: 'f', where: 'w', sums: 'S' }))).not.toContain('ORDER BY')
  })
})

describe('championTableWhere', () => {
  it('excludes unranked rows when no tier is selected and filters the role', () => {
    const where = championTableWhere(null, null, 'MIDDLE')
    expect(where).toContain(`cs.rank_tier <> 'UNRANKED'`)
    expect(where).toContain(`cs.role = 'MIDDLE'`)
    expect(championTableWhere(null, ['GOLD'], null)).not.toContain('UNRANKED')
  })
})
