import { describe, expect, it } from 'vitest'
import {
  initRegionWeights,
  rebalanceWeights,
  selectedClusters,
  settingsBody,
  weightsTotal,
} from './pollerWeights'

describe('rebalanceWeights', () => {
  it('total ≤ 100 : les autres réduits au prorata', () => {
    const w = rebalanceWeights({ GOLD: 50, IRON: 50 }, 'GOLD', 80)
    expect(w).toEqual({ GOLD: 80, IRON: 20 })
  })
  it('baisse : les autres inchangés (total < 100 permis)', () => {
    expect(rebalanceWeights({ GOLD: 50, IRON: 50 }, 'GOLD', 10)).toEqual({ GOLD: 10, IRON: 50 })
  })
  it('valeur bornée à [0, 100]', () => {
    expect(rebalanceWeights({ GOLD: 50, IRON: 50 }, 'GOLD', 150)).toEqual({ GOLD: 100, IRON: 0 })
    expect(rebalanceWeights({ GOLD: 50, IRON: 50 }, 'GOLD', -5)).toEqual({ GOLD: 0, IRON: 50 })
  })
  it('arrondi au dixième sans dépasser 100', () => {
    const w = rebalanceWeights({ A: 33.3, B: 33.3, C: 33.4 }, 'A', 50)
    expect(w.A).toBe(50)
    expect(weightsTotal(w)).toBeLessThanOrEqual(100)
    expect(w.B).toBeCloseTo(w.C ?? 0, 0)
  })
})

describe('initRegionWeights', () => {
  it('chaque région de limite : ses poids enregistrés, sinon copie des poids toutes régions', () => {
    const r = initRegionWeights(
      ['europe', 'asia'],
      { GOLD: 100 },
      { asia: { IRON: 100 }, sea: { GOLD: 1 } }
    )
    expect(r).toEqual({ europe: { GOLD: 100 }, asia: { IRON: 100 } })
    r.europe!.GOLD = 5
    expect(initRegionWeights(['europe'], { GOLD: 100 }, {}).europe).toEqual({ GOLD: 100 })
  })
})

describe('selectedClusters', () => {
  it('régions de limite des plateformes cochées, sans doublon, dans l’ordre des choix', () => {
    const choices = [
      { platform: 'euw1', cluster: 'europe' },
      { platform: 'eun1', cluster: 'europe' },
      { platform: 'na1', cluster: 'americas' },
      { platform: 'kr', cluster: 'asia' },
    ]
    expect(selectedClusters(choices, ['kr', 'eun1', 'euw1'])).toEqual(['europe', 'asia'])
  })
})

describe('settingsBody', () => {
  it('toutes régions : pas de poids par région', () => {
    expect(settingsBody(['kr'], ['asia'], { GOLD: 100 }, 'all', { asia: { IRON: 100 } })).toEqual({
      platforms: ['kr'],
      tierWeights: { GOLD: 100 },
    })
  })
  it('par région : poids des seules régions de limite cochées, copie des poids globaux si absents', () => {
    expect(
      settingsBody(['euw1', 'kr'], ['europe', 'asia'], { GOLD: 100 }, 'byRegion', {
        asia: { IRON: 100 },
        sea: { GOLD: 1 },
      })
    ).toEqual({
      platforms: ['euw1', 'kr'],
      tierWeights: { GOLD: 100 },
      tierWeightsByRegion: { europe: { GOLD: 100 }, asia: { IRON: 100 } },
    })
  })
})
