import { describe, expect, it } from 'vitest'
import { computeTheorycraftItemProcLines } from '../theorycraftItemProcs'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

const stats: TheorycraftBuildStats = {
  level: 18,
  totalAD: 250,
  bonusAD: 150,
  AP: 400,
  totalHP: 2000,
  bonusHP: 500,
  armor: 100,
  magicResist: 60,
  maxMana: 800,
  critChance: 0.25,
  critDamage: 1.75,
}

describe('theorycraftItemProcs', () => {
  it('computes Sheen proc from base AD', () => {
    const lines = computeTheorycraftItemProcLines({
      items: [{ id: '3057', name: 'Brillance' } as never],
      buildStats: stats,
      labels: {},
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]!.damage).toBe(100)
    expect(lines[0]!.damageType).toBe('physical')
  })

  it('computes Nashor on-hit with AP scaling', () => {
    const lines = computeTheorycraftItemProcLines({
      items: [{ id: '3115', name: 'Dent de Nashor' } as never],
      buildStats: stats,
      labels: {},
    })
    expect(lines[0]!.damage).toBeCloseTo(80, 0)
    expect(lines[0]!.damageType).toBe('magic')
  })
})
