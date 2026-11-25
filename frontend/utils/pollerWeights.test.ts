import { describe, expect, it } from 'vitest'
import { rebalanceWeights, weightsTotal } from './pollerWeights'

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
