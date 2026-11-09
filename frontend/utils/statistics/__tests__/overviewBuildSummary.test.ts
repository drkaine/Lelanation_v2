import { describe, expect, it } from 'vitest'
import {
  matchupExtremes,
  overviewRoleRows,
  profileColumns,
  skillPriority,
} from '../overviewBuildSummary'

describe('skillPriority (maquette 22)', () => {
  it('niveaux 1-3 et ordre de max sans R', () => {
    const p = skillPriority([1, 3, 2, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2])
    expect(p.first).toEqual(['Q', 'E', 'W'])
    expect(p.max).toEqual(['Q', 'E', 'W'])
  })
  it('ordre partiel : plus de points d’abord', () => {
    expect(skillPriority([2, 1, 2, 3, 2]).max).toEqual(['W', 'Q', 'E'])
  })
  it('ordre vide', () => {
    expect(skillPriority([])).toEqual({ first: [], max: [] })
  })
})

describe('overviewRoleRows', () => {
  it('trie par parties, part du total, peu fiable sous le seuil', () => {
    const rows = overviewRoleRows(
      [
        { role: 'TOP', games: 90, winrate: 42.2 },
        { role: 'SUPPORT', games: 39161, winrate: 51 },
      ],
      100
    )
    expect(rows.map(r => r.role)).toEqual(['SUPPORT', 'TOP'])
    expect(rows[0]!.lowSample).toBe(false)
    expect(rows[0]!.pct).toBeCloseTo(99.77, 1)
    expect(rows[1]!.lowSample).toBe(true)
    expect(rows[1]!.pct).toBeCloseTo(0.23, 1)
  })
})

describe('profileColumns', () => {
  it('3 colonnes combat / survie / vision & éco', () => {
    const cols = profileColumns({
      kills: 1.5,
      deaths: 6.1,
      assists: 15.9,
      kda: 2.86,
      damage: 3268.5,
      heal: 4640,
      tanked: 6521,
      mitigated: 7514,
      visionScore: 61.1,
      wardsPlaced: 26.7,
      gold: 8593,
    })
    expect(cols.map(c => c.id)).toEqual(['combat', 'survival', 'visionEco'])
    expect(cols[0]!.rows[0]!.value).toBe('1,5 / 6,1 / 15,9')
    expect(cols[0]!.rows[2]!.value).toBe('3 269')
    expect(cols[2]!.rows[0]!.value).toBe('61,1')
  })
  it('valeur absente → tiret', () => {
    expect(profileColumns({})[1]!.rows[0]!.value).toBe('—')
  })
})

describe('matchupExtremes', () => {
  it('meilleurs et pires au-dessus du seuil', () => {
    const rows = [
      { opponentChampionId: 1, games: 500, winrate: 55 },
      { opponentChampionId: 2, games: 500, winrate: 45 },
      { opponentChampionId: 3, games: 20, winrate: 90 },
      { opponentChampionId: 4, games: 300, winrate: 50 },
    ]
    const r = matchupExtremes(rows, 100, 2)
    expect(r.best.map(x => x.opponentChampionId)).toEqual([1, 4])
    expect(r.worst.map(x => x.opponentChampionId)).toEqual([2, 4])
  })
})
