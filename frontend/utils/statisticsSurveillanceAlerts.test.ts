import { describe, expect, it } from 'vitest'
import {
  aggregateTrendPoints,
  buildDemoAlertScenario,
  buildDemoReferenceSnapshot,
  buildSurveillanceBaselineKey,
  buildSurveillanceChampionStatsQuery,
  canAddSurveillanceCohortProfile,
  clampIsoDate,
  computePatchStartMetrics,
  countCustomSurveillanceCohortProfiles,
  defaultSurveillanceAlertThresholds,
  defaultSurveillanceCohortProfile,
  defaultSurveillanceThresholdProfiles,
  evaluateSurveillanceAlerts,
  formatSurveillanceCohortLabel,
  hasConfiguredSurveillanceThresholds,
  migrateSurveillanceThresholdsStorage,
  normalizeSurveillanceCohortProfiles,
  resolveSurveillanceCohortLabel,
  resolveSurveillanceReference,
  serializeSurveillanceThresholdsStorage,
  stableSurveillanceAlertsFingerprint,
  surveillanceAlertTone,
  surveillanceCohortKey,
  syncProfilesSharedThresholds,
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

  it('limits custom cohort count to three besides global', () => {
    const profiles = [
      defaultSurveillanceCohortProfile(),
      defaultSurveillanceCohortProfile(['GOLD']),
      defaultSurveillanceCohortProfile(['PLATINUM']),
      defaultSurveillanceCohortProfile(['DIAMOND']),
    ]
    expect(countCustomSurveillanceCohortProfiles(profiles)).toBe(3)
    expect(canAddSurveillanceCohortProfile(profiles)).toBe(false)
    expect(canAddSurveillanceCohortProfile(profiles.slice(0, 3))).toBe(true)
  })

  it('uses custom cohort label when set', () => {
    expect(
      resolveSurveillanceCohortLabel({
        cohortKey: 'GOLD,PLATINUM',
        label: 'Mon duo',
      })
    ).toBe('Mon duo')
    expect(
      resolveSurveillanceCohortLabel({
        cohortKey: 'GOLD,PLATINUM',
        label: '   ',
      })
    ).toBe('Gold + Platinum')
  })

  it('clamps iso dates to snapshot bounds', () => {
    expect(clampIsoDate('2020-01-01', '2024-06-01', '2026-06-01')).toBe('2024-06-01')
    expect(clampIsoDate('2030-01-01', '2024-06-01', '2026-06-01')).toBe('2026-06-01')
    expect(clampIsoDate('2025-03-15', '2024-06-01', '2026-06-01')).toBe('2025-03-15')
  })

  it('migrates legacy flat thresholds to global profile', () => {
    const storage = migrateSurveillanceThresholdsStorage({
      winrateMin: 40,
      winrateMax: null,
    })
    expect(storage.profiles).toHaveLength(1)
    expect(storage.profiles[0]?.cohortKey).toBe(SURVEILLANCE_GLOBAL_COHORT_KEY)
    expect(storage.profiles[0]?.thresholds.winrateMin).toBe(40)
    expect(storage.sharedThresholds).toBe(false)
  })

  it('syncs shared thresholds across profiles', () => {
    const profiles = normalizeSurveillanceCohortProfiles([
      {
        cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY,
        rankTiers: [],
        label: null,
        thresholds: { winrateMin: 50 },
      },
      { cohortKey: 'GOLD', rankTiers: ['GOLD'], label: null, thresholds: { winrateMin: 40 } },
    ])
    const synced = syncProfilesSharedThresholds(profiles, profiles[0]!.thresholds)
    expect(synced[0]?.thresholds.winrateMin).toBe(50)
    expect(synced[1]?.thresholds.winrateMin).toBe(50)
  })

  it('persists shared threshold mode in storage', () => {
    const storage = serializeSurveillanceThresholdsStorage(
      defaultSurveillanceThresholdProfiles(),
      true
    )
    const loaded = migrateSurveillanceThresholdsStorage(storage)
    expect(loaded.sharedThresholds).toBe(true)
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

describe('stableSurveillanceAlertsFingerprint', () => {
  it('ignores current metric values between checks', () => {
    const a = stableSurveillanceAlertsFingerprint({
      '166': [
        {
          kind: 'min',
          metric: 'winrate',
          threshold: 50,
          current: 48.2,
          cohortKey: 'GLOBAL',
        },
      ],
    })
    const b = stableSurveillanceAlertsFingerprint({
      '166': [
        {
          kind: 'min',
          metric: 'winrate',
          threshold: 50,
          current: 47.9,
          cohortKey: 'GLOBAL',
        },
      ],
    })
    expect(a).toBe(b)
  })

  it('changes when alert kind or champion changes', () => {
    const base = stableSurveillanceAlertsFingerprint({
      '166': [{ kind: 'min', metric: 'winrate', threshold: 50, current: 48, cohortKey: 'GLOBAL' }],
    })
    const otherChampion = stableSurveillanceAlertsFingerprint({
      '267': [{ kind: 'min', metric: 'winrate', threshold: 50, current: 48, cohortKey: 'GLOBAL' }],
    })
    const otherKind = stableSurveillanceAlertsFingerprint({
      '166': [{ kind: 'max', metric: 'winrate', threshold: 70, current: 72, cohortKey: 'GLOBAL' }],
    })
    expect(base).not.toBe(otherChampion)
    expect(base).not.toBe(otherKind)
  })
})

describe('surveillanceAlertTone', () => {
  it('uses green for max and red for min on winrate', () => {
    expect(
      surveillanceAlertTone({
        kind: 'max',
        metric: 'winrate',
        threshold: 55,
        current: 60,
        cohortKey: 'GLOBAL',
      })
    ).toBe('positive')
    expect(
      surveillanceAlertTone({
        kind: 'min',
        metric: 'winrate',
        threshold: 50,
        current: 45,
        cohortKey: 'GLOBAL',
      })
    ).toBe('negative')
  })

  it('inverts colors for banrate', () => {
    expect(
      surveillanceAlertTone({
        kind: 'max',
        metric: 'banrate',
        threshold: 10,
        current: 15,
        cohortKey: 'GLOBAL',
      })
    ).toBe('negative')
    expect(
      surveillanceAlertTone({
        kind: 'delta',
        metric: 'banrate',
        threshold: 1,
        current: 3,
        reference: 5,
        cohortKey: 'GLOBAL',
      })
    ).toBe('positive')
  })
})
