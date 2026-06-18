import { describe, expect, it } from 'vitest'
import {
  aggregateTrendPoints,
  buildDemoAlertScenario,
  buildDemoReferenceSnapshot,
  buildSurveillanceBaselineKey,
  buildSurveillanceChampionStatsQuery,
  computePatchStartMetrics,
  defaultSurveillanceAlertThresholds,
  evaluateSurveillanceAlerts,
  formatSurveillanceCohortLabel,
  hasConfiguredSurveillanceThresholds,
  migrateSurveillanceThresholdsStorage,
  normalizeSurveillanceCohortProfiles,
  resolveSurveillanceReference,
  surveillanceCohortKey,
  SURVEILLANCE_GLOBAL_COHORT_KEY,
} from './statisticsSurveillanceAlerts'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'

function point(
  partial: Partial<DailyTrendSnapshotPoint> & Pick<DailyTrendSnapshotPoint, 'dateOfGame'>
): DailyTrendSnapshotPoint {
  return {
    rankTier: 'GOLD',
    role: 'TOP',
    games: 100,
    wins: 55,
    banRatePct: 5,
    pickRatePct: 8,
    ...partial,
  }
}

describe('surveillance cohort helpers', () => {
  it('uses GLOBAL for empty rank tiers', () => {
    expect(surveillanceCohortKey([])).toBe(SURVEILLANCE_GLOBAL_COHORT_KEY)
    expect(buildSurveillanceChampionStatsQuery({ rankTiers: [] })).toBe('?otp=oui')
  })

  it('builds stable keys for division groups', () => {
    expect(surveillanceCohortKey(['PLATINUM', 'GOLD'])).toBe('GOLD,PLATINUM')
    expect(buildSurveillanceBaselineKey(166, 'GOLD,PLATINUM')).toBe('166::GOLD,PLATINUM')
  })

  it('formats cohort labels', () => {
    expect(formatSurveillanceCohortLabel(SURVEILLANCE_GLOBAL_COHORT_KEY)).toBe('Global')
    expect(formatSurveillanceCohortLabel('GOLD,PLATINUM')).toBe('Gold + Platinum')
  })

  it('migrates legacy flat thresholds to global profile', () => {
    const profiles = migrateSurveillanceThresholdsStorage({
      winrateMin: 40,
      winrateMax: null,
    })
    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.cohortKey).toBe(SURVEILLANCE_GLOBAL_COHORT_KEY)
    expect(profiles[0]?.thresholds.winrateMin).toBe(40)
  })

  it('deduplicates cohort profiles', () => {
    const profiles = normalizeSurveillanceCohortProfiles([
      { cohortKey: 'GOLD', rankTiers: ['GOLD'], thresholds: { winrateMin: 1 } },
      { cohortKey: 'GOLD', rankTiers: ['GOLD'], thresholds: { winrateMin: 2 } },
    ])
    expect(profiles.filter(p => p.cohortKey === 'GOLD')).toHaveLength(1)
  })

  it('always includes otp=oui in champion stats query', () => {
    expect(buildSurveillanceChampionStatsQuery()).toBe('?otp=oui')
    const q = buildSurveillanceChampionStatsQuery({
      version: '16.12',
      rankTiers: ['GOLD', 'PLATINUM'],
    })
    expect(q).toContain('otp=oui')
    expect(q).toContain('version=16.12')
    expect(q).toContain('rankTier=GOLD')
    expect(q).toContain('rankTier=PLATINUM')
  })

  it('resolves reference from settings', () => {
    const catalog = [
      { patchLabel: '16.11', releaseDate: '2026-05-01' },
      { patchLabel: '16.12', releaseDate: '2026-06-01' },
    ]
    expect(
      resolveSurveillanceReference(
        { mode: 'current_patch', referenceDate: null, referencePatchLabel: null },
        catalog
      )
    ).toEqual({ releaseDate: '2026-06-01', label: '16.12' })
    expect(
      resolveSurveillanceReference(
        { mode: 'date', referenceDate: '2026-05-15', referencePatchLabel: null },
        catalog
      )
    ).toEqual({ releaseDate: '2026-05-15', label: '15/05/2026' })
    expect(
      resolveSurveillanceReference(
        { mode: 'patch', referenceDate: null, referencePatchLabel: '16.11' },
        catalog
      )
    ).toEqual({ releaseDate: '2026-05-01', label: '16.11' })
  })
})

describe('aggregateTrendPoints', () => {
  it('aggregates weighted pick and ban rates', () => {
    const result = aggregateTrendPoints([
      point({ games: 100, wins: 60, pickRatePct: 10, banRatePct: 4 }),
      point({ games: 50, wins: 20, pickRatePct: 4, banRatePct: 8 }),
    ])
    expect(result).toEqual({
      winrate: 53.33,
      pickrate: 8,
      banrate: 5.33,
    })
  })
})

describe('computePatchStartMetrics', () => {
  it('uses the earliest day on or after patch release', () => {
    const result = computePatchStartMetrics(
      [
        point({ dateOfGame: '2026-06-10', wins: 40, games: 100, pickRatePct: 5 }),
        point({ dateOfGame: '2026-06-18', wins: 65, games: 100, pickRatePct: 7 }),
        point({ dateOfGame: '2026-06-21', wins: 90, games: 100, pickRatePct: 9 }),
      ],
      '2026-06-18'
    )
    expect(result?.winrate).toBe(65)
    expect(result?.pickrate).toBe(7)
  })
})

describe('evaluateSurveillanceAlerts', () => {
  const thresholds = {
    ...defaultSurveillanceAlertThresholds(),
    winrateMin: 60,
    winrateMax: 70,
    winrateDeltaPct: 10,
  }

  it('triggers min, max and patch delta alerts', () => {
    const triggers = evaluateSurveillanceAlerts({
      current: { winrate: 90, pickrate: 5, banrate: 2 },
      patchStart: { winrate: 65, pickrate: 5, banrate: 2 },
      thresholds,
      patchLabel: '26.12',
    })

    expect(triggers).toEqual(
      expect.arrayContaining([
        {
          kind: 'max',
          metric: 'winrate',
          threshold: 70,
          current: 90,
          cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY,
        },
        {
          kind: 'delta',
          metric: 'winrate',
          threshold: 10,
          current: 90,
          reference: 65,
          patchLabel: '26.12',
          cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY,
        },
      ])
    )
  })

  it('triggers min when winrate drops below threshold', () => {
    const triggers = evaluateSurveillanceAlerts({
      current: { winrate: 55, pickrate: 5, banrate: 2 },
      patchStart: { winrate: 65, pickrate: 5, banrate: 2 },
      thresholds,
    })
    expect(triggers).toContainEqual({
      kind: 'min',
      metric: 'winrate',
      threshold: 60,
      current: 55,
      cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY,
    })
  })

  it('skips delta when patch baseline is missing', () => {
    const triggers = evaluateSurveillanceAlerts({
      current: { winrate: 90, pickrate: 5, banrate: 2 },
      patchStart: null,
      thresholds,
    })
    expect(triggers.some(trigger => trigger.kind === 'delta')).toBe(false)
  })
})

describe('buildDemoAlertScenario', () => {
  it('creates values that trigger configured min, max and delta thresholds', () => {
    const thresholds = {
      ...defaultSurveillanceAlertThresholds(),
      winrateMin: 10,
      winrateMax: 15,
      winrateDeltaPct: 1,
      pickrateMin: 1,
      pickrateMax: 2,
      pickrateDeltaPct: 1,
      banrateMin: 1,
      banrateMax: 2,
      banrateDeltaPct: 1,
    }
    const { current, reference } = buildDemoAlertScenario(thresholds)
    const triggers = evaluateSurveillanceAlerts({
      current,
      patchStart: reference,
      thresholds,
      patchLabel: 'demo',
    })
    expect(triggers.some(trigger => trigger.kind === 'max' && trigger.metric === 'winrate')).toBe(
      true
    )
    expect(triggers.some(trigger => trigger.kind === 'delta')).toBe(true)
  })
})

describe('buildDemoReferenceSnapshot', () => {
  it('offsets metrics to trigger configured delta thresholds', () => {
    const current = { winrate: 52, pickrate: 8, banrate: 3 }
    const reference = buildDemoReferenceSnapshot(current, {
      ...defaultSurveillanceAlertThresholds(),
      winrateDeltaPct: 10,
      pickrateDeltaPct: 5,
    })
    expect(current.winrate - reference.winrate).toBeGreaterThan(10)
    expect(current.pickrate - reference.pickrate).toBeGreaterThan(5)
    expect(reference.banrate).toBe(current.banrate)
  })
})

describe('hasConfiguredSurveillanceThresholds', () => {
  it('returns false for empty thresholds', () => {
    expect(hasConfiguredSurveillanceThresholds(defaultSurveillanceAlertThresholds())).toBe(false)
  })

  it('returns true when any threshold is set', () => {
    expect(
      hasConfiguredSurveillanceThresholds({
        ...defaultSurveillanceAlertThresholds(),
        banrateMax: 15,
      })
    ).toBe(true)
  })
})
