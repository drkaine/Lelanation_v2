import { describe, expect, it } from 'vitest'
import { mainSkillOrder, skillOrderGrid } from '~/utils/statistics/skillOrderGrid'

describe('skillOrderGrid', () => {
  it('une ligne par sort Q W E R, une case par niveau (18)', () => {
    const g = skillOrderGrid([1, 3, 2, 1, 1, 4])
    expect(g.map(r => r.key)).toEqual(['Q', 'W', 'E', 'R'])
    expect(g[0]?.levels.length).toBe(18)
    expect(g[0]?.levels.slice(0, 6)).toEqual([true, false, false, true, true, false])
    expect(g[2]?.levels[1]).toBe(true)
    expect(g[3]?.levels[5]).toBe(true)
    expect(g[3]?.levels[6]).toBe(false)
  })

  it('valeurs inconnues ignorées', () => {
    const g = skillOrderGrid([0, 9, 1])
    expect(g.every(r => !r.levels[0] && !r.levels[1])).toBe(true)
    expect(g[0]?.levels[2]).toBe(true)
  })
})

describe('mainSkillOrder', () => {
  it('ordre le plus joué, à égalité le meilleur winrate', () => {
    const rows = [
      { key: 'a', games: 10, winrate: 50 },
      { key: 'b', games: 30, winrate: 48 },
      { key: 'c', games: 30, winrate: 52 },
    ]
    expect(mainSkillOrder(rows)?.key).toBe('c')
    expect(mainSkillOrder([])).toBeNull()
  })
})
