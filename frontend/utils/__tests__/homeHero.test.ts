import { describe, expect, it } from 'vitest'
import { findChampionSlug, homePopularPicks, homeSearchQuery } from '../homeHero'

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

describe('homeSearchQuery', () => {
  const list = [
    { id: 'MissFortune', name: 'Miss Fortune' },
    { id: 'Ahri', name: 'Ahri' },
  ]
  it('rend le nom exact du champion reconnu', () => {
    expect(homeSearchQuery('miss fortune', list)).toBe('Miss Fortune')
  })
  it('complète un début de nom', () => {
    expect(homeSearchQuery('ahr', list)).toBe('Ahri')
  })
  it('garde la saisie brute si aucun champion ne correspond', () => {
    expect(homeSearchQuery('  troll  ', list)).toBe('troll')
  })
  it('rend une chaîne vide pour une saisie vide', () => {
    expect(homeSearchQuery('   ', list)).toBe('')
  })
})
