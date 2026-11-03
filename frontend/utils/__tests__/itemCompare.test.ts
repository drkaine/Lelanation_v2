import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import { compareItems } from '../itemCompare'

const item = (id: string, total: number, stats: Record<string, number>, from: string[] = []) =>
  ({
    id,
    name: id,
    gold: { total, base: total, sell: total * 0.7, purchasable: true },
    stats,
    from,
  }) as unknown as Item

const a = item('A', 3000, { FlatPhysicalDamageMod: 40, FlatHPPoolMod: 300 }, ['1036', '1028'])
const b = item('B', 2800, { FlatPhysicalDamageMod: 55, PercentAttackSpeedMod: 0.25 }, [
  '1036',
  '1042',
])

describe('compareItems', () => {
  it('prix : valeurs et écart B − A', () => {
    expect(compareItems(a, b).price).toEqual({ a: 3000, b: 2800, diff: -200 })
  })

  it('stats : union des stats des deux objets, écart B − A, pourcentages ramenés à 100', () => {
    const rows = compareItems(a, b).stats
    expect(rows.map(row => row.id)).toEqual(['hp', 'ad', 'attackSpeed'])
    expect(rows.find(row => row.id === 'ad')).toMatchObject({ a: 40, b: 55, diff: 15 })
    expect(rows.find(row => row.id === 'hp')).toMatchObject({ a: 300, b: 0, diff: -300 })
    expect(rows.find(row => row.id === 'attackSpeed')).toMatchObject({ a: 0, b: 25, percent: true })
  })

  it('composants : communs, propres à A, propres à B (doublons comptés)', () => {
    const twice = item('C', 1100, {}, ['1036', '1036'])
    expect(compareItems(a, b).components).toEqual({
      shared: ['1036'],
      onlyA: ['1028'],
      onlyB: ['1042'],
    })
    expect(compareItems(twice, a).components).toEqual({
      shared: ['1036'],
      onlyA: ['1036'],
      onlyB: ['1028'],
    })
  })

  it('rentabilité en or : écart en points, null si non calculable', () => {
    const result = compareItems(a, b)
    expect(typeof result.efficiency.a).toBe('number')
    expect(result.efficiency.diff).toBeCloseTo(
      (result.efficiency.b ?? 0) - (result.efficiency.a ?? 0)
    )
    const free = item('F', 0, { FlatPhysicalDamageMod: 10 })
    expect(compareItems(free, a).efficiency).toMatchObject({ a: null, diff: null })
  })
})
