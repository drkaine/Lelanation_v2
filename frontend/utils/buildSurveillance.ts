import type { DeltaDirectionFlags } from './surveillanceDeltaDirection'
import {
  defaultDeltaDirectionFlags,
  normalizeDeltaDirectionFlags,
  normalizeSurveillanceDeltaDirection,
  passesDeltaDirectionFlags,
} from './surveillanceDeltaDirection'

export const BUILD_SURVEILLANCE_DISPLAY_LIMIT = 20
export const BUILD_SURVEILLANCE_MIN_ITEMS = 3

export type BuildSurveillanceMetricId = 'winrate' | 'pickrate'

export interface BuildRowLike {
  items: number[]
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface BuildMetricSnapshot {
  winrate: number
  pickrate: number
  games: number
}

export interface BuildSurveillanceThresholds {
  winrateMin: number | null
  winrateMax: number | null
  pickrateMin: number | null
  pickrateMax: number | null
  minGames: number | null
  maxBuilds: number | null
  winrateDeltaPct: number | null
  pickrateDeltaPct: number | null
  winrateDeltaDirection: DeltaDirectionFlags
  pickrateDeltaDirection: DeltaDirectionFlags
}

export type BuildSurveillanceTriggerKind = 'min' | 'max' | 'delta' | 'new'

export interface BuildSurveillanceTrigger {
  kind: BuildSurveillanceTriggerKind
  metric?: BuildSurveillanceMetricId
  fingerprint: string
  items: number[]
  threshold: number
  current: number
  reference?: number
  delta?: number
}

const METRIC_KEYS: BuildSurveillanceMetricId[] = ['winrate', 'pickrate']

export function defaultBuildSurveillanceThresholds(): BuildSurveillanceThresholds {
  return {
    winrateMin: null,
    winrateMax: null,
    pickrateMin: null,
    pickrateMax: null,
    minGames: 10,
    maxBuilds: 10,
    winrateDeltaPct: null,
    pickrateDeltaPct: null,
    winrateDeltaDirection: defaultDeltaDirectionFlags(),
    pickrateDeltaDirection: defaultDeltaDirectionFlags(),
  }
}

export function normalizeBuildSurveillanceThresholds(
  raw: Partial<BuildSurveillanceThresholds> | null | undefined
): BuildSurveillanceThresholds {
  const defaults = defaultBuildSurveillanceThresholds()
  const parse = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  const parseInteger = (value: unknown): number | null => {
    const n = parse(value)
    if (n === null) return null
    return Math.max(0, Math.floor(n))
  }
  const legacyGlobal =
    raw && typeof raw === 'object' && 'deltaDirection' in raw
      ? normalizeSurveillanceDeltaDirection((raw as { deltaDirection?: unknown }).deltaDirection)
      : undefined
  return {
    winrateMin: parse(raw?.winrateMin) ?? defaults.winrateMin,
    winrateMax: parse(raw?.winrateMax) ?? defaults.winrateMax,
    pickrateMin: parse(raw?.pickrateMin) ?? defaults.pickrateMin,
    pickrateMax: parse(raw?.pickrateMax) ?? defaults.pickrateMax,
    minGames: parseInteger(raw?.minGames) ?? defaults.minGames,
    maxBuilds: parseInteger(raw?.maxBuilds) ?? defaults.maxBuilds,
    winrateDeltaPct: parse(raw?.winrateDeltaPct) ?? defaults.winrateDeltaPct,
    pickrateDeltaPct: parse(raw?.pickrateDeltaPct) ?? defaults.pickrateDeltaPct,
    winrateDeltaDirection: normalizeDeltaDirectionFlags(raw?.winrateDeltaDirection, legacyGlobal),
    pickrateDeltaDirection: normalizeDeltaDirectionFlags(raw?.pickrateDeltaDirection, legacyGlobal),
  }
}

export function buildFingerprint(items: readonly number[]): string {
  return [...items].sort((a, b) => a - b).join('-')
}

export function buildMetricValue(
  build: BuildMetricSnapshot,
  metric: BuildSurveillanceMetricId
): number {
  return build[metric]
}

function thresholdMin(
  thresholds: BuildSurveillanceThresholds,
  metric: BuildSurveillanceMetricId
): number | null {
  return metric === 'winrate' ? thresholds.winrateMin : thresholds.pickrateMin
}

function thresholdMax(
  thresholds: BuildSurveillanceThresholds,
  metric: BuildSurveillanceMetricId
): number | null {
  return metric === 'winrate' ? thresholds.winrateMax : thresholds.pickrateMax
}

function thresholdDelta(
  thresholds: BuildSurveillanceThresholds,
  metric: BuildSurveillanceMetricId
): number | null {
  return metric === 'winrate' ? thresholds.winrateDeltaPct : thresholds.pickrateDeltaPct
}

function thresholdDeltaDirection(
  thresholds: BuildSurveillanceThresholds,
  metric: BuildSurveillanceMetricId
): DeltaDirectionFlags {
  return metric === 'winrate' ? thresholds.winrateDeltaDirection : thresholds.pickrateDeltaDirection
}

export function effectiveMinGames(thresholds: BuildSurveillanceThresholds): number {
  const min = thresholds.minGames
  if (min === null || min === undefined || !Number.isFinite(min)) return 10
  return Math.max(1, Math.floor(min))
}

export function effectiveMaxBuilds(thresholds: BuildSurveillanceThresholds): number {
  const max = thresholds.maxBuilds
  if (max === null || max === undefined || !Number.isFinite(max)) return 10
  return Math.min(BUILD_SURVEILLANCE_DISPLAY_LIMIT, Math.max(1, Math.floor(max)))
}

export function buildItemCount(build: BuildRowLike): number {
  return build.items.filter(id => Number(id) > 0).length
}

export function passesBuildItemCountFilter(build: BuildRowLike): boolean {
  return buildItemCount(build) >= BUILD_SURVEILLANCE_MIN_ITEMS
}

export function passesBuildGamesFilter(
  build: BuildRowLike,
  thresholds: BuildSurveillanceThresholds
): boolean {
  return build.games >= effectiveMinGames(thresholds)
}

export function isEligibleBuild(
  build: BuildRowLike,
  thresholds: BuildSurveillanceThresholds
): boolean {
  return passesBuildItemCountFilter(build) && passesBuildGamesFilter(build, thresholds)
}

export function hasConfiguredBuildSurveillanceThresholds(
  thresholds: BuildSurveillanceThresholds
): boolean {
  return (
    thresholds.winrateMin !== null ||
    thresholds.winrateMax !== null ||
    thresholds.pickrateMin !== null ||
    thresholds.pickrateMax !== null ||
    thresholds.winrateDeltaPct !== null ||
    thresholds.pickrateDeltaPct !== null
  )
}

export function buildSurveillanceScopeKey(input: {
  championKey: number
  rankTiers: readonly string[]
  role: string
  patch: string
}): string {
  const ranks = [...input.rankTiers]
    .map(t => String(t).trim().toUpperCase())
    .filter(Boolean)
    .sort()
  const role = String(input.role ?? '')
    .trim()
    .toUpperCase()
  const patch = String(input.patch ?? '').trim()
  return `${input.championKey}::${ranks.join(',') || 'ALL'}::${role || 'ALL'}::${patch || 'ALL'}`
}

export function evaluateBuildSurveillanceAlerts(input: {
  build: BuildRowLike
  fingerprint: string
  baseline: BuildMetricSnapshot | null
  thresholds: BuildSurveillanceThresholds
  isNewBuild: boolean
}): BuildSurveillanceTrigger[] {
  const { build, fingerprint, baseline, thresholds, isNewBuild } = input
  if (!isEligibleBuild(build, thresholds)) return []

  const triggers: BuildSurveillanceTrigger[] = []
  const current: BuildMetricSnapshot = {
    winrate: build.winrate,
    pickrate: build.pickrate,
    games: build.games,
  }

  if (isNewBuild) {
    triggers.push({
      kind: 'new',
      fingerprint,
      items: [...build.items],
      threshold: 0,
      current: build.winrate,
    })
  }

  for (const metric of METRIC_KEYS) {
    const value = buildMetricValue(current, metric)
    const min = thresholdMin(thresholds, metric)
    const max = thresholdMax(thresholds, metric)
    const delta = thresholdDelta(thresholds, metric)

    if (min !== null && value < min) {
      triggers.push({
        kind: 'min',
        metric,
        fingerprint,
        items: [...build.items],
        threshold: min,
        current: value,
      })
    }
    if (max !== null && value > max) {
      triggers.push({
        kind: 'max',
        metric,
        fingerprint,
        items: [...build.items],
        threshold: max,
        current: value,
      })
    }
    if (delta !== null && baseline) {
      const reference = buildMetricValue(baseline, metric)
      const diff = value - reference
      if (
        Math.abs(diff) >= delta &&
        passesDeltaDirectionFlags(diff, thresholdDeltaDirection(thresholds, metric))
      ) {
        triggers.push({
          kind: 'delta',
          metric,
          fingerprint,
          items: [...build.items],
          threshold: delta,
          current: value,
          reference,
          delta: diff,
        })
      }
    }
  }

  return triggers
}

export function buildSurveillanceAlertTone(
  trigger: BuildSurveillanceTrigger
): 'positive' | 'negative' | 'neutral' {
  if (trigger.kind === 'new') return 'positive'
  if (trigger.kind === 'min') return 'negative'
  if (trigger.kind === 'max') return 'negative'
  if (trigger.kind === 'delta' && trigger.delta !== undefined) {
    if (trigger.metric === 'winrate' || trigger.metric === 'pickrate') {
      return trigger.delta >= 0 ? 'positive' : 'negative'
    }
  }
  return 'neutral'
}

export function stableBuildAlertsFingerprint(
  alerts: Record<string, BuildSurveillanceTrigger[]>
): string {
  const parts = Object.keys(alerts)
    .sort()
    .flatMap(key =>
      (alerts[key] ?? []).map(trigger =>
        [
          key,
          trigger.kind,
          trigger.metric ?? '',
          trigger.fingerprint,
          trigger.current,
          trigger.reference ?? '',
          trigger.delta ?? '',
        ].join(':')
      )
    )
  return parts.join('|')
}
