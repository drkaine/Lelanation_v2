import { describe, expect, it } from 'vitest'
import { afkByRole, duosByRolePair } from '../teamMiscTable'
import type { TeamMiscAfkRow, TeamMiscDuoRow } from '../teamMiscTable'

const afk: TeamMiscAfkRow[] = [
  { role: 'TOP', tier: 'GOLD', side: 'BLUE', games: 60, afk: 0 },
  { role: 'TOP', tier: 'GOLD', side: 'RED', games: 40, afk: 2 },
  { role: 'TOP', tier: 'IRON', side: 'BLUE', games: 100, afk: 6 },
  { role: 'UTILITY', tier: 'GOLD', side: 'RED', games: 50, afk: 0 },
  { role: 'JUNGLE', tier: 'GOLD', side: 'BLUE', games: 0, afk: 0 },
]
const duos: TeamMiscDuoRow[] = [
  { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', side: 'BLUE', games: 10, wins: 6 },
  { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'IRON', side: 'RED', games: 10, wins: 4 },
  { roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', side: 'RED', games: 4, wins: 1 },
]

describe('afkByRole', () => {
  it('tous rangs : somme par rôle et par côté, ordre TOP→UTILITY, taux en %, rôles vides retirés', () => {
    expect(afkByRole(afk, [])).toEqual([
      {
        role: 'TOP',
        games: 200,
        afk: 8,
        rate: 4,
        blue: { games: 160, afk: 6, rate: (6 / 160) * 100 },
        red: { games: 40, afk: 2, rate: 5 },
      },
      {
        role: 'UTILITY',
        games: 50,
        afk: 0,
        rate: 0,
        blue: { games: 0, afk: 0, rate: 0 },
        red: { games: 50, afk: 0, rate: 0 },
      },
    ])
  })
  it('rangs du filtre (plusieurs possibles)', () => {
    expect(afkByRole(afk, ['IRON']).map(l => [l.role, l.games])).toEqual([['TOP', 100]])
    expect(afkByRole(afk, ['IRON', 'GOLD']).map(l => [l.role, l.games])).toEqual([
      ['TOP', 200],
      ['UTILITY', 50],
    ])
  })
})

describe('duosByRolePair', () => {
  it('tous rangs : somme par paire et par côté, plus joués d’abord, WR et part en %', () => {
    expect(duosByRolePair(duos, [])).toEqual([
      {
        roleA: 'BOTTOM',
        roleB: 'UTILITY',
        games: 20,
        wins: 10,
        winrate: 50,
        share: (20 / 24) * 100,
        blue: { games: 10, wins: 6, winrate: 60 },
        red: { games: 10, wins: 4, winrate: 40 },
      },
      {
        roleA: 'TOP',
        roleB: 'JUNGLE',
        games: 4,
        wins: 1,
        winrate: 25,
        share: (4 / 24) * 100,
        blue: { games: 0, wins: 0, winrate: 0 },
        red: { games: 4, wins: 1, winrate: 25 },
      },
    ])
  })
  it('rangs du filtre', () => {
    expect(duosByRolePair(duos, ['IRON']).map(l => [l.roleA, l.games, l.share])).toEqual([
      ['BOTTOM', 10, 100],
    ])
  })
})
