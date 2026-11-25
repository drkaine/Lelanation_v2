import { describe, expect, it } from 'vitest'
import { afkByRole, duoBansByPair, duoPicksByPair, duosByRolePair } from '../teamMiscTable'
import type {
  TeamMiscAfkRow,
  TeamMiscDuoBanRow,
  TeamMiscDuoPickRow,
  TeamMiscDuoRow,
} from '../teamMiscTable'

const afk: TeamMiscAfkRow[] = [
  { role: 'TOP', tier: 'GOLD', side: 'BLUE', games: 60, afk: 0 },
  { role: 'TOP', tier: 'GOLD', side: 'RED', games: 40, afk: 2 },
  { role: 'TOP', tier: 'IRON', side: 'BLUE', games: 100, afk: 6 },
  { role: 'UTILITY', tier: 'GOLD', side: 'RED', games: 50, afk: 0 },
  { role: 'JUNGLE', tier: 'GOLD', side: 'BLUE', games: 0, afk: 0 },
]
function obj(own: number, enemy: number) {
  return { own, enemy }
}
function duo(
  roleA: string,
  roleB: string,
  tier: string,
  side: 'BLUE' | 'RED',
  games: number,
  wins: number,
  extra: {
    surrenderFor?: number
    surrenderAgainst?: number
    afk?: number
    dragons?: [number, number]
  } = {}
): TeamMiscDuoRow {
  const [own, enemy] = extra.dragons ?? [0, 0]
  return {
    roleA,
    roleB,
    tier,
    side,
    games,
    wins,
    surrenderFor: extra.surrenderFor ?? 0,
    surrenderAgainst: extra.surrenderAgainst ?? 0,
    afk: extra.afk ?? 0,
    objectives: {
      dragons: obj(own, enemy),
      barons: obj(0, 0),
      towers: obj(0, 0),
      grubs: obj(0, 0),
      heralds: obj(0, 0),
    },
  }
}
const duos: TeamMiscDuoRow[] = [
  duo('BOTTOM', 'UTILITY', 'GOLD', 'BLUE', 10, 6, { surrenderFor: 1, afk: 1, dragons: [25, 15] }),
  duo('BOTTOM', 'UTILITY', 'IRON', 'RED', 10, 4, { surrenderAgainst: 3, dragons: [15, 25] }),
  duo('TOP', 'JUNGLE', 'GOLD', 'RED', 4, 1),
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
        surrenderForRate: 5,
        surrenderAgainstRate: 15,
        afkRate: 5,
        objectives: {
          dragons: obj(2, 2),
          barons: obj(0, 0),
          towers: obj(0, 0),
          grubs: obj(0, 0),
          heralds: obj(0, 0),
        },
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
        surrenderForRate: 0,
        surrenderAgainstRate: 0,
        afkRate: 0,
        objectives: {
          dragons: obj(0, 0),
          barons: obj(0, 0),
          towers: obj(0, 0),
          grubs: obj(0, 0),
          heralds: obj(0, 0),
        },
      },
    ])
  })
  it('objectifs : moyenne par partie, sur le rang filtré', () => {
    const [line] = duosByRolePair(duos, ['GOLD'])
    expect(line?.objectives.dragons).toEqual(obj(2.5, 1.5))
  })
  it('rangs du filtre', () => {
    expect(duosByRolePair(duos, ['IRON']).map(l => [l.roleA, l.games, l.share])).toEqual([
      ['BOTTOM', 10, 100],
    ])
  })
})

const picks: TeamMiscDuoPickRow[] = [
  {
    roleA: 'BOTTOM',
    roleB: 'UTILITY',
    tier: 'GOLD',
    role: 'BOTTOM',
    championId: 22,
    games: 5,
    wins: 3,
  },
  {
    roleA: 'BOTTOM',
    roleB: 'UTILITY',
    tier: 'IRON',
    role: 'BOTTOM',
    championId: 22,
    games: 5,
    wins: 1,
  },
  {
    roleA: 'BOTTOM',
    roleB: 'UTILITY',
    tier: 'GOLD',
    role: 'BOTTOM',
    championId: 51,
    games: 6,
    wins: 3,
  },
  {
    roleA: 'BOTTOM',
    roleB: 'UTILITY',
    tier: 'GOLD',
    role: 'UTILITY',
    championId: 412,
    games: 2,
    wins: 2,
  },
  {
    roleA: 'BOTTOM',
    roleB: 'UTILITY',
    tier: 'GOLD',
    role: 'UTILITY',
    championId: 117,
    games: 1,
    wins: 0,
  },
]
const bans: TeamMiscDuoBanRow[] = [
  { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', championId: 7, bans: 3 },
  { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'IRON', championId: 7, bans: 2 },
  { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', championId: 9, bans: 4 },
  { roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', championId: 9, bans: 1 },
]

describe('duoPicksByPair', () => {
  it('par paire puis par rôle : rangs sommés, plus joués d’abord, limite', () => {
    const map = duoPicksByPair(picks, [], 1)
    expect(map.get('BOTTOM|UTILITY')).toEqual({
      BOTTOM: [{ championId: 22, games: 10, winrate: 40 }],
      UTILITY: [{ championId: 412, games: 2, winrate: 100 }],
    })
  })
  it('rangs du filtre', () => {
    expect(duoPicksByPair(picks, ['GOLD'], 1).get('BOTTOM|UTILITY')?.BOTTOM).toEqual([
      { championId: 51, games: 6, winrate: 50 },
    ])
  })
})

describe('duoBansByPair', () => {
  it('par paire : rangs sommés, plus bannis d’abord, part des parties', () => {
    const games = new Map([['BOTTOM|UTILITY', 20]])
    expect(duoBansByPair(bans, [], games, 5).get('BOTTOM|UTILITY')).toEqual([
      { championId: 7, bans: 5, rate: 25 },
      { championId: 9, bans: 4, rate: 20 },
    ])
  })
})
