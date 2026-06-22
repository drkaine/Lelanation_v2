import { describe, expect, it } from 'vitest'
import {
  evaluateSurveillanceAlerts,
  defaultSurveillanceAlertThresholds,
} from './statisticsSurveillanceAlerts'
import {
  evaluateBuildSurveillanceAlerts,
  buildFingerprint,
  defaultBuildSurveillanceThresholds,
} from './buildSurveillance'
import {
  defaultDeltaDirectionFlags,
  passesDeltaDirectionFlags,
  toggleDeltaDirectionFlag,
} from './surveillanceDeltaDirection'

describe('surveillanceDeltaDirection', () => {
  it('filters diff by flags', () => {
    expect(passesDeltaDirectionFlags(5, { increase: true, decrease: true })).toBe(true)
    expect(passesDeltaDirectionFlags(-5, { increase: true, decrease: true })).toBe(true)
    expect(passesDeltaDirectionFlags(5, { increase: true, decrease: false })).toBe(true)
    expect(passesDeltaDirectionFlags(-5, { increase: true, decrease: false })).toBe(false)
    expect(passesDeltaDirectionFlags(-5, { increase: false, decrease: true })).toBe(true)
  })

  it('keeps at least one direction active when toggling', () => {
    const onlyUp = { increase: true, decrease: false }
    expect(toggleDeltaDirectionFlag(onlyUp, 'increase')).toEqual(onlyUp)
    expect(toggleDeltaDirectionFlag(onlyUp, 'decrease')).toEqual({ increase: true, decrease: true })
  })
})

describe('delta direction in evaluation', () => {
  it('stats: only triggers increase deltas when configured', () => {
    const thresholds = {
      ...defaultSurveillanceAlertThresholds(),
      winrateDeltaPct: 5,
      winrateDeltaDirection: { increase: true, decrease: false },
      pickrateDeltaDirection: defaultDeltaDirectionFlags(),
      banrateDeltaDirection: defaultDeltaDirectionFlags(),
    }
    const increaseTriggers = evaluateSurveillanceAlerts({
      current: { winrate: 60, pickrate: 5, banrate: 5 },
      patchStart: { winrate: 50, pickrate: 5, banrate: 5 },
      thresholds,
    })
    expect(increaseTriggers.some(t => t.kind === 'delta' && t.metric === 'winrate')).toBe(true)

    const decreaseTriggers = evaluateSurveillanceAlerts({
      current: { winrate: 40, pickrate: 5, banrate: 5 },
      patchStart: { winrate: 50, pickrate: 5, banrate: 5 },
      thresholds,
    })
    expect(decreaseTriggers.some(t => t.kind === 'delta')).toBe(false)
  })

  it('builds: only triggers decrease deltas when configured', () => {
    const build = { items: [3031, 3006, 3046], games: 120, wins: 66, winrate: 45, pickrate: 3.2 }
    const thresholds = {
      ...defaultBuildSurveillanceThresholds(),
      winrateDeltaPct: 2,
      winrateDeltaDirection: { increase: false, decrease: true },
    }
    const triggers = evaluateBuildSurveillanceAlerts({
      build,
      fingerprint: buildFingerprint(build.items),
      baseline: { winrate: 52, pickrate: 5, games: 100 },
      thresholds,
      isNewBuild: false,
    })
    expect(triggers.some(t => t.kind === 'delta' && t.metric === 'winrate')).toBe(true)
    expect(triggers.every(t => t.kind !== 'delta' || (t.delta ?? 0) < 0)).toBe(true)
  })
})
