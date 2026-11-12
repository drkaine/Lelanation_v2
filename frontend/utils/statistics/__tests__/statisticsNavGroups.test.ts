import { describe, expect, it } from 'vitest'
import {
  STATISTICS_NAV_GROUPS,
  navGroupOfTab,
  navGroupTarget,
  isCombinedNavGroup,
  tabsToLoadWith,
  visibleNavGroups,
} from '../statisticsNavGroups'

describe('statisticsNavGroups', () => {
  it('liste les 9 sections de la maquette dans l’ordre', () => {
    expect(STATISTICS_NAV_GROUPS.map(g => g.id)).toEqual([
      'overview',
      'tierList',
      'champions',
      'teamObjectives',
      'bans',
      'builds',
      'behavior',
      'patchNotes',
      'infos',
    ])
  })

  it('rattache chaque onglet à sa section', () => {
    expect(navGroupOfTab('surrender')).toBe('teamObjectives')
    expect(navGroupOfTab('spells')).toBe('builds')
    expect(navGroupOfTab('vision')).toBe('behavior')
    expect(navGroupOfTab('misc')).toBe('champions')
    expect(navGroupOfTab('overview')).toBe('overview')
  })

  it('ne garde que les onglets visibles, dans l’ordre de la section', () => {
    const groups = visibleNavGroups(['items', 'overview', 'runes', 'bans'])
    const builds = groups.find(g => g.id === 'builds')
    expect(builds?.tabs).toEqual(['runes', 'items'])
    expect(groups.some(g => g.id === 'behavior')).toBe(false)
  })

  it('garde la tier list, qui est une page à part', () => {
    const groups = visibleNavGroups(['overview'])
    expect(groups.map(g => g.id)).toEqual(['overview', 'tierList'])
    expect(groups[1]?.route).toBe('/statistics/tier-list')
  })

  it('cible d’une section : page dédiée ou /statistics?tab=', () => {
    const byId = (id: string) => STATISTICS_NAV_GROUPS.find(g => g.id === id)!
    expect(navGroupTarget(byId('tierList'))).toEqual({ path: '/statistics/tier-list' })
    expect(navGroupTarget(byId('builds'))).toEqual({
      path: '/statistics',
      query: { tab: 'runes' },
    })
    expect(navGroupTarget(byId('overview'))).toEqual({ path: '/statistics' })
  })

  it('Comportement : une seule page, sans sous-onglets', () => {
    expect(isCombinedNavGroup('behavior')).toBe(true)
    expect(isCombinedNavGroup('builds')).toBe(false)
    expect(isCombinedNavGroup(null)).toBe(false)
  })

  it('charge Pings et Vision ensemble', () => {
    expect(tabsToLoadWith('pings')).toEqual(['pings', 'vision'])
    expect(tabsToLoadWith('vision')).toEqual(['pings', 'vision'])
    expect(tabsToLoadWith('items')).toEqual(['items'])
  })
})
