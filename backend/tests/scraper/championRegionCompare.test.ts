import { describe, it, expect } from 'vitest'
import {
  applyAutoChampionRegionUpdates,
  compareChampionRegions,
} from '../../src/services/championRegionCompare.js'
import { mapUniverseFactionSlug } from '../../src/services/championRegionFactionMap.js'

describe('championRegionFactionMap', () => {
  it('maps universe faction slugs to internal region keys', () => {
    expect(mapUniverseFactionSlug('mount-targon')).toBe('targon')
    expect(mapUniverseFactionSlug('shadow-isles')).toBe('shadow_isles')
    expect(mapUniverseFactionSlug('bandle-city')).toBe('bandle')
    expect(mapUniverseFactionSlug('unaffiliated')).toBe('runeterra')
    expect(mapUniverseFactionSlug('new-region')).toBeNull()
  })
})

describe('championRegionCompare', () => {
  const lookup = new Map<string, string>([
    ['malzahar', 'Malzahar'],
    ['locke', 'Locke'],
    ['lucian', 'Lucian'],
  ])

  it('detects missing champions and explicit mismatches', () => {
    const result = compareChampionRegions(
      [
        { slug: 'malzahar', name: 'Malzahar', factionSlug: 'void' },
        { slug: 'locke', name: 'Locke', factionSlug: 'demacia' },
        { slug: 'lucian', name: 'Lucian', factionSlug: 'unaffiliated' },
      ],
      lookup,
      { Malzahar: 'void', Lucian: 'demacia' }
    )

    expect(result.diffs).toEqual([
      {
        championId: 'Locke',
        name: 'Locke',
        to: 'demacia',
        kind: 'missing',
      },
      {
        championId: 'Lucian',
        name: 'Lucian',
        from: 'demacia',
        to: 'runeterra',
        kind: 'unaffiliated_mismatch',
      },
    ])
  })

  it('auto-applies only missing and explicit mismatches', () => {
    const comparison = compareChampionRegions(
      [
        { slug: 'locke', name: 'Locke', factionSlug: 'demacia' },
        { slug: 'lucian', name: 'Lucian', factionSlug: 'unaffiliated' },
      ],
      lookup,
      { Lucian: 'demacia' }
    )

    const { mapping, applied } = applyAutoChampionRegionUpdates(
      { Lucian: 'demacia' },
      comparison.diffs
    )

    expect(mapping).toEqual({
      Lucian: 'demacia',
      Locke: 'demacia',
    })
    expect(applied).toHaveLength(1)
    expect(applied[0]?.championId).toBe('Locke')
  })
})
