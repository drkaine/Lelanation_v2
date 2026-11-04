import { describe, expect, it } from 'vitest'
import { findMetaChartChampion, metaQuadrantList } from '../metaChartSelection'

const names: Record<number, string> = { 1: 'Miss Fortune', 2: "Kai'Sa", 3: 'Jhin', 4: 'Jax' }
const nameOf = (id: number) => names[id] ?? ''
const rows = [
  { championId: 1, winrate: 0.53, pickrate: 0.089 },
  { championId: 2, winrate: 0.48, pickrate: 0.08 },
  { championId: 3, winrate: 0.52, pickrate: 0.01 },
  { championId: 4, winrate: 0.47, pickrate: 0.012 },
]

describe('findMetaChartChampion', () => {
  it('trouve un nom exact sans casse ni ponctuation', () => {
    expect(findMetaChartChampion('kaisa', rows, nameOf)).toBe(2)
  })
  it('préfère le nom exact au préfixe', () => {
    expect(findMetaChartChampion('jax', rows, nameOf)).toBe(4)
  })
  it('accepte un début de nom', () => {
    expect(findMetaChartChampion('miss', rows, nameOf)).toBe(1)
  })
  it('renvoie null si vide ou absent', () => {
    expect(findMetaChartChampion('  ', rows, nameOf)).toBeNull()
    expect(findMetaChartChampion('zed', rows, nameOf)).toBeNull()
  })
})

describe('metaQuadrantList', () => {
  it('classe chaque quadrant par winrate décroissant', () => {
    expect(metaQuadrantList(rows, 'meta').map(r => r.championId)).toEqual([1])
    expect(metaQuadrantList(rows, 'gems').map(r => r.championId)).toEqual([3])
    expect(metaQuadrantList(rows, 'traps').map(r => r.championId)).toEqual([2])
    expect(metaQuadrantList(rows, 'niche').map(r => r.championId)).toEqual([4])
  })
  it('renvoie une liste vide sans lignes', () => {
    expect(metaQuadrantList([], 'meta')).toEqual([])
  })
})
