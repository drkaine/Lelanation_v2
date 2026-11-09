import { describe, it, expect } from 'vitest'
import {
  championDesktopColumns,
  championDesktopGroups,
  championDeltaTone,
  championDamageSegments,
} from '../championDesktopColumns'

const all = { heal: true, dealt: true, taken: true }
const none = { heal: false, dealt: false, taken: false }

describe('championDesktopColumns', () => {
  it('sans détail : colonnes principales par groupe', () => {
    const cols = championDesktopColumns(all, none)
    expect(cols.map(c => c.sort)).toEqual([
      'healTotal',
      'mitigated',
      'ccTime',
      'dmgTotal',
      'takenTotal',
    ])
    expect(cols.find(c => c.sort === 'dmgTotal')?.bar).toBe(true)
    expect(cols.find(c => c.sort === 'takenTotal')?.invert).toBe(true)
  })

  it('détail dégâts : ajoute phys/mag/brut après le total', () => {
    const cols = championDesktopColumns(
      { heal: false, dealt: true, taken: false },
      {
        ...none,
        dealt: true,
      }
    )
    expect(cols.map(c => c.sort)).toEqual(['dmgTotal', 'dmgPhys', 'dmgMagic', 'dmgTrue'])
  })

  it('groupes : spans contigus', () => {
    const groups = championDesktopGroups(championDesktopColumns(all, { ...none, heal: true }))
    expect(groups).toEqual([
      { group: 'heal', span: 6 },
      { group: 'dealt', span: 1 },
      { group: 'taken', span: 1 },
    ])
  })
})

describe('championDeltaTone', () => {
  it('hausse / baisse / neutre, inversé pour reçus', () => {
    expect(championDeltaTone(3)).toBe('up')
    expect(championDeltaTone(-3)).toBe('down')
    expect(championDeltaTone(0.01)).toBe('flat')
    expect(championDeltaTone(3, true)).toBe('down')
  })
})

describe('championDamageSegments', () => {
  it('répartit la largeur totale entre phys / mag / brut', () => {
    expect(championDamageSegments({ phys: 600, magic: 300, true: 100 }, 1000, 2000)).toEqual([
      { type: 'phys', pct: 30 },
      { type: 'magic', pct: 15 },
      { type: 'true', pct: 5 },
    ])
  })
  it('max nul ou total nul : pas de segment', () => {
    expect(championDamageSegments({ phys: 0, magic: 0, true: 0 }, 0, 100)).toEqual([])
    expect(championDamageSegments({ phys: 5, magic: 0, true: 0 }, 5, 0)).toEqual([])
  })
})
