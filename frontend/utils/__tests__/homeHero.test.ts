import { describe, expect, it } from 'vitest'
import { findChampionSlug, homePopularPicks, latestHomeBuild } from '../homeHero'

const blocks = [
  {
    role: 'TOP',
    champions: [
      { rank: 1, championId: 1, tier: 'S', pickrate: 3 },
      { rank: 2, championId: 2, tier: 'A', pickrate: 9 },
    ],
  },
  {
    role: 'MID',
    champions: [
      { rank: 1, championId: 2, tier: 'S', pickrate: 9 },
      { rank: 2, championId: 3, tier: 'B', pickrate: 5 },
    ],
  },
]

describe('homePopularPicks', () => {
  it('trie par pickrate, sans doublon', () => {
    expect(homePopularPicks(blocks, 5).map(r => r.championId)).toEqual([2, 3, 1])
  })
  it('respecte la limite', () => {
    expect(homePopularPicks(blocks, 1)).toHaveLength(1)
  })
})

describe('findChampionSlug', () => {
  const champs = [
    { id: 'MissFortune', name: 'Miss Fortune' },
    { id: 'Nunu', name: 'Nunu et Willump' },
    { id: 'KSante', name: "K'Santé" },
  ]
  it('nom exact, casse et accents ignorés', () => {
    expect(findChampionSlug('miss fortune', champs)).toBe('missfortune')
    expect(findChampionSlug('ksante', champs)).toBe('ksante')
  })
  it('début de nom', () => {
    expect(findChampionSlug('nunu', champs)).toBe('nunu')
  })
  it('rien trouvé', () => {
    expect(findChampionSlug('zzz', champs)).toBeNull()
    expect(findChampionSlug('  ', champs)).toBeNull()
  })
})

describe('latestHomeBuild', () => {
  it('rend le build créé le plus récemment', () => {
    const builds = [
      { id: 'a', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'b', createdAt: '2026-11-09T10:00:00Z' },
      { id: 'c', createdAt: '2026-11-05T10:00:00Z' },
    ]
    expect(latestHomeBuild(builds)?.id).toBe('b')
  })

  it('ignore les dates invalides et rend null sans build', () => {
    expect(latestHomeBuild([])).toBeNull()
    expect(
      latestHomeBuild([
        { id: 'x', createdAt: '' },
        { id: 'y', createdAt: '2026-01-01' },
      ])?.id
    ).toBe('y')
  })
})
