import { describe, expect, it } from 'vitest'
import {
  CHAMPION_MOBILE_METRICS,
  championMobileMetric,
  championMobileSubs,
  championMobileBarPct,
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
    expect(championMobileSubs('avgDamageToChamps')).toEqual([
      'avgDamageTakenTotal',
      'avgTotalHeal',
      'avgTimeCcDealt',
    ])
    expect(championMobileSubs('avgDamageTakenTotal')).toEqual([
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
