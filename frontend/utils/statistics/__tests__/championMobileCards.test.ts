import { describe, expect, it } from 'vitest'
import {
  CHAMPION_MOBILE_METRICS,
  championMobileMetric,
  championMobileSubs,
  championMobileBarPct,
  championMobileMetricsFor,
} from '~/utils/statistics/championMobileCards'

describe('championMobileCards', () => {
  it('tri → champ principal, dégâts infligés par défaut', () => {
    expect(championMobileMetric('dmgTotal')).toBe('avgDamageToChamps')
    expect(championMobileMetric('takenTotalDelta')).toBe('avgDamageTakenTotal')
    expect(championMobileMetric('ccTime')).toBe('avgTimeCcDealt')
    expect(championMobileMetric('champion')).toBe('avgDamageToChamps')
    expect(CHAMPION_MOBILE_METRICS.map(m => m.sort)).toContain('healTotal')
  })

  it('3 sous-stats sans le champ principal', () => {
    expect(championMobileSubs('avgDamageToChamps').map(x => x.field)).toEqual([
      'avgDamageTakenTotal',
      'avgTotalHeal',
      'avgTimeCcDealt',
    ])
    expect(championMobileSubs('avgDamageTakenTotal').map(x => x.field)).toEqual([
      'avgDamageToChamps',
      'avgTotalHeal',
      'avgTimeCcDealt',
    ])
  })

  it('barre relative au max', () => {
    expect(championMobileBarPct(50, 200)).toBe(25)
    expect(championMobileBarPct(10, 0)).toBe(0)
    expect(championMobileBarPct(300, 200)).toBe(100)
  })
})

describe('cartes Champions : suivent le mode Tout / Soins / Infligés / Reçus', () => {
  it('mode tout : métrique selon le tri, sous-stats inchangées', () => {
    expect(championMobileMetric('takenTotal')).toBe('avgDamageTakenTotal')
    expect(championMobileSubs('avgDamageToChamps').map(s => s.field)).toEqual([
      'avgDamageTakenTotal',
      'avgTotalHeal',
      'avgTimeCcDealt',
    ])
  })

  it('mode infligés : total infligé + détail phys / mag / brut', () => {
    expect(championMobileMetric('healTotal', 'dealt')).toBe('avgDamageToChamps')
    expect(championMobileSubs('avgDamageToChamps', 'dealt').map(s => s.field)).toEqual([
      'avgDamageToChampsPhys',
      'avgDamageToChampsMagic',
      'avgDamageToChampsTrue',
    ])
  })

  it('mode reçus : total reçu + détail phys / mag / brut', () => {
    expect(championMobileMetric('dmgTotal', 'taken')).toBe('avgDamageTakenTotal')
    expect(championMobileSubs('avgDamageTakenTotal', 'taken').map(s => s.field)).toEqual([
      'avgDamageTakenPhys',
      'avgDamageTakenMagic',
      'avgDamageTakenTrue',
    ])
  })

  it('mode soins : garde un tri du groupe, sous-stats du groupe', () => {
    expect(championMobileMetric('ccTime', 'heal')).toBe('avgTimeCcDealt')
    expect(championMobileMetric('dmgTotal', 'heal')).toBe('avgTotalHeal')
    const subs = championMobileSubs('avgTotalHeal', 'heal')
    expect(subs).toHaveLength(3)
    expect(subs.map(s => s.field)).not.toContain('avgTotalHeal')
    expect(subs.every(s => s.labelKey.startsWith('statisticsPage.'))).toBe(true)
  })

  it('le choix de métrique ne propose que celles du mode', () => {
    expect(championMobileMetricsFor('all')).toHaveLength(5)
    expect(championMobileMetricsFor('dealt').map(m => m.field)).toEqual(['avgDamageToChamps'])
    expect(championMobileMetricsFor('heal').map(m => m.field)).toEqual([
      'avgTotalHeal',
      'avgDamageSelfMitigated',
      'avgTimeCcDealt',
    ])
  })
})
