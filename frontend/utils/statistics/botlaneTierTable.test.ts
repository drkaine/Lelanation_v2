import { describe, expect, it } from 'vitest'
import {
  botlaneChampionIds,
  sortBotlaneRows,
  tierLabelKey,
  withBotlaneMetrics,
} from './botlaneTierTable'
import type { BotlaneTierRow } from '~/composables/statistics/botlanePatchDeltas'

function row(over: Partial<BotlaneTierRow>): BotlaneTierRow {
  return {
    rank: 1,
    adcId: 1,
    supportId: 2,
    oppAdcId: 3,
    oppSupportId: 4,
    games: 10,
    wins: 5,
    winrate: 0.5,
    note: 50,
    tier: 'A',
    deltaVsPeersPp: null,
    ...over,
  }
}

describe('tierLabelKey', () => {
  it('maps tiers to i18n keys, unknown and D to F', () => {
    expect(tierLabelKey('S+')).toBe('statisticsPage.tierS+')
    expect(tierLabelKey('B')).toBe('statisticsPage.tierB')
    expect(tierLabelKey('D')).toBe('statisticsPage.tierF')
    expect(tierLabelKey('?')).toBe('statisticsPage.tierF')
  })
})

describe('withBotlaneMetrics', () => {
  it('adds score from note and pickrate from share of games', () => {
    const out = withBotlaneMetrics([row({ games: 30, note: 61 }), row({ games: 10 })])
    expect(out[0]).toMatchObject({ score: 61, pickrate: 0.75 })
    expect(out[1]!.pickrate).toBe(0.25)
    expect(withBotlaneMetrics([row({ games: 0 })])[0]!.pickrate).toBe(0)
  })
})

describe('sortBotlaneRows', () => {
  const rows = withBotlaneMetrics([
    row({ rank: 2, tier: 'S+', deltaVsPeersPp: null, games: 5 }),
    row({ rank: 1, tier: 'B', deltaVsPeersPp: 1.5, games: 50 }),
    row({ rank: 3, tier: 'F', deltaVsPeersPp: -2, games: 20 }),
  ])
  const ranks = (key: Parameters<typeof sortBotlaneRows>[1], dir: 'asc' | 'desc') =>
    sortBotlaneRows(rows, key, dir).map(r => r.rank)

  it('sorts by rank, tier order, games', () => {
    expect(ranks('rank', 'asc')).toEqual([1, 2, 3])
    expect(ranks('tier', 'desc')).toEqual([2, 1, 3])
    expect(ranks('games', 'desc')).toEqual([1, 3, 2])
  })

  it('puts missing deltas last when descending', () => {
    expect(ranks('delta', 'desc')).toEqual([1, 3, 2])
  })

  it('does not mutate its input', () => {
    sortBotlaneRows(rows, 'rank', 'desc')
    expect(rows.map(r => r.rank)).toEqual([2, 1, 3])
  })
})

describe('botlaneChampionIds', () => {
  it('lists our duo, plus the enemy duo in vs mode', () => {
    expect(botlaneChampionIds(row({}), 'duo')).toEqual([1, 2])
    expect(botlaneChampionIds(row({}), 'vs')).toEqual([1, 2, 3, 4])
  })
})
