import { describe, expect, it } from 'vitest'
import {
  buildFingerprint,
  buildSurveillanceScopeKey,
  defaultBuildSurveillanceThresholds,
  evaluateBuildSurveillanceAlerts,
  passesBuildGamesFilter,
  passesBuildItemCountFilter,
} from './buildSurveillance'

const sampleBuild = {
  items: [3031, 3006, 3046],
  games: 120,
  wins: 66,
  winrate: 55,
  pickrate: 3.2,
}

describe('buildSurveillance', () => {
  it('builds stable fingerprints', () => {
    expect(buildFingerprint([3031, 3006, 3046])).toBe('3006-3031-3046')
  })

  it('filters by minGames', () => {
    const thresholds = { ...defaultBuildSurveillanceThresholds(), minGames: 50 }
    expect(passesBuildGamesFilter(sampleBuild, thresholds)).toBe(true)
    expect(passesBuildGamesFilter({ ...sampleBuild, games: 20 }, thresholds)).toBe(false)
  })

  it('filters builds with fewer than 3 items', () => {
    expect(passesBuildItemCountFilter(sampleBuild)).toBe(true)
    expect(passesBuildItemCountFilter({ ...sampleBuild, items: [3031, 3006] })).toBe(false)
    const triggers = evaluateBuildSurveillanceAlerts({
      build: { ...sampleBuild, items: [3031, 3006] },
      fingerprint: buildFingerprint([3031, 3006]),
      baseline: null,
      thresholds: defaultBuildSurveillanceThresholds(),
      isNewBuild: true,
    })
    expect(triggers).toHaveLength(0)
  })

  it('alerts on new build', () => {
    const triggers = evaluateBuildSurveillanceAlerts({
      build: sampleBuild,
      fingerprint: buildFingerprint(sampleBuild.items),
      baseline: null,
      thresholds: defaultBuildSurveillanceThresholds(),
      isNewBuild: true,
    })
    expect(triggers.some(t => t.kind === 'new')).toBe(true)
  })

  it('alerts on winrate delta gain and pickrate delta loss', () => {
    const thresholds = {
      ...defaultBuildSurveillanceThresholds(),
      winrateDeltaPct: 2,
      pickrateDeltaPct: 1,
    }
    const baseline = { winrate: 52, pickrate: 5, games: 100 }
    const triggers = evaluateBuildSurveillanceAlerts({
      build: sampleBuild,
      fingerprint: buildFingerprint(sampleBuild.items),
      baseline,
      thresholds,
      isNewBuild: false,
    })
    expect(
      triggers.some(t => t.kind === 'delta' && t.metric === 'winrate' && (t.delta ?? 0) > 0)
    ).toBe(true)
    expect(
      triggers.some(t => t.kind === 'delta' && t.metric === 'pickrate' && (t.delta ?? 0) < 0)
    ).toBe(true)
  })

  it('scopes baselines per champion and filters', () => {
    expect(
      buildSurveillanceScopeKey({
        championKey: 166,
        rankTiers: ['GOLD', 'PLATINUM'],
        role: 'TOP',
        patch: '16.4',
      })
    ).toBe('166::GOLD,PLATINUM::TOP::16.4')
  })
})
