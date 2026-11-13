import { describe, expect, it } from 'vitest'
import { CHAMPION_TAB_GROUPS, championTabGroupOf, championTabsInGroup } from '../championTabGroups'

describe('championTabGroups', () => {
  it('lists the six groups in mockup order', () => {
    expect(CHAMPION_TAB_GROUPS.map(g => g.id)).toEqual([
      'overview',
      'build',
      'matchups',
      'stats',
      'jungle',
      'builds',
    ])
  })
  it('covers every champion tab exactly once', () => {
    const all = CHAMPION_TAB_GROUPS.flatMap(g => g.tabs)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(13)
  })
  it('finds the group of a tab', () => {
    expect(championTabGroupOf('spells')).toBe('build')
    expect(championTabGroupOf('synergy')).toBe('matchups')
    expect(championTabGroupOf('vision')).toBe('stats')
    expect(championTabGroupOf('builds')).toBe('builds')
    expect(championTabGroupOf('jungle')).toBe('jungle')
  })
  it('gives the sub tabs of a group, first is default', () => {
    expect(championTabsInGroup('build')[0]).toBe('runes')
    expect(championTabsInGroup('overview')).toEqual(['overview'])
  })
  it('stats = maquette 27 : combat & rôles, objectifs, vision & pings, soins & dégâts', () => {
    expect(championTabsInGroup('stats')).toEqual([
      'dashboard',
      'objectives',
      'vision',
      'maps',
      'misc',
    ])
    expect(championTabGroupOf('pings')).toBe('stats')
    expect(championTabGroupOf('maps')).toBe('stats')
  })
})
