import { describe, expect, it } from 'vitest'
import {
  ADMIN_LIMIT_SPECS,
  DEFAULT_STATS_LIMITS,
  STATS_LIMIT_SPECS,
  limitsValid,
  parseLimitsResponse,
} from './limitsSettings'
import { gestionTabsFor } from './teamAccess'

describe('limitsSettings (Gestion > Stats, Limites admin)', () => {
  it('défauts stats = constantes backend', () => {
    expect(DEFAULT_STATS_LIMITS.tierListMinGames).toBe(10)
    expect(DEFAULT_STATS_LIMITS.tierListMinPickPct).toBe(0.5)
    expect(DEFAULT_STATS_LIMITS.compareTopLimit).toBe(10)
    expect(DEFAULT_STATS_LIMITS.matchupScoreMax).toBe(10)
    expect(Object.keys(DEFAULT_STATS_LIMITS).sort()).toEqual(
      STATS_LIMIT_SPECS.map(s => s.key).sort()
    )
  })

  it('valide bornes, entiers et contrôle croisé du poller', () => {
    expect(limitsValid(STATS_LIMIT_SPECS, DEFAULT_STATS_LIMITS)).toBe(true)
    expect(limitsValid(STATS_LIMIT_SPECS, { ...DEFAULT_STATS_LIMITS, tierListMinGames: 0 })).toBe(
      false
    )
    expect(limitsValid(STATS_LIMIT_SPECS, { ...DEFAULT_STATS_LIMITS, compareTopLimit: 1.5 })).toBe(
      false
    )
    expect(
      limitsValid(STATS_LIMIT_SPECS, { ...DEFAULT_STATS_LIMITS, tierListMinPickPct: 101 })
    ).toBe(false)
    expect(
      limitsValid(STATS_LIMIT_SPECS, { ...DEFAULT_STATS_LIMITS, botlaneMinGames: Number.NaN })
    ).toBe(false)
    const admin = {
      voteMinTotal: 10,
      voteMinUpvotePct: 30,
      pollTargetNewGames: 5,
      pollMinDelayDays: 0.25,
      pollMaxDelayDays: 30,
      pollWindowHours: 48,
      rankHistoryRetentionDays: 15,
      patchRetentionDays: 0,
    }
    expect(limitsValid(ADMIN_LIMIT_SPECS, admin)).toBe(true)
    expect(limitsValid(ADMIN_LIMIT_SPECS, { ...admin, pollMaxDelayDays: 0.1 })).toBe(false)
    expect(limitsValid(ADMIN_LIMIT_SPECS, { ...admin, patchRetentionDays: 91 })).toBe(false)
  })

  it('parse la réponse GET ; champ manquant ou invalide → null', () => {
    expect(parseLimitsResponse(STATS_LIMIT_SPECS, { settings: DEFAULT_STATS_LIMITS })).toEqual(
      DEFAULT_STATS_LIMITS
    )
    expect(parseLimitsResponse(STATS_LIMIT_SPECS, { settings: { tierListMinGames: 3 } })).toBeNull()
    expect(parseLimitsResponse(STATS_LIMIT_SPECS, null)).toBeNull()
  })

  it('onglet Limites réservé à l’admin', () => {
    expect(gestionTabsFor('admin')).toContain('limits')
    expect(gestionTabsFor('lelariva')).not.toContain('limits')
    expect(gestionTabsFor('lelariva')).toContain('stats')
  })
})
