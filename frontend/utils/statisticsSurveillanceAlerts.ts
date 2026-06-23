import { RANK_TIERS } from './rankTiers'
import type { DeltaDirectionFlags } from './surveillanceDeltaDirection'
import {
  defaultDeltaDirectionFlags,
  demoReferenceForDeltaFlags,
  normalizeDeltaDirectionFlags,
  normalizeSurveillanceDeltaDirection,
  passesDeltaDirectionFlags,
} from './surveillanceDeltaDirection'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'

export type SurveillanceMetricId = 'winrate' | 'pickrate' | 'banrate'

/** Cohorte « toutes divisions » (aucun rankTier dans l’API). */
export const SURVEILLANCE_GLOBAL_COHORT_KEY = 'GLOBAL'

/** Nombre max de cohortes personnalisées (hors global). */
export const SURVEILLANCE_MAX_CUSTOM_COHORTS = 3

export interface SurveillanceAlertThresholds {
  winrateMin: number | null
  winrateMax: number | null
  pickrateMin: number | null
  pickrateMax: number | null
  banrateMin: number | null
  banrateMax: number | null
  winrateDeltaPct: number | null
  pickrateDeltaPct: number | null
  banrateDeltaPct: number | null
  winrateDeltaDirection: DeltaDirectionFlags
  pickrateDeltaDirection: DeltaDirectionFlags
  banrateDeltaDirection: DeltaDirectionFlags
}

export interface ChampionMetricSnapshot {
  winrate: number
  pickrate: number
  banrate: number
}

export interface SurveillanceCohortProfile {
  cohortKey: string
  /** Vide = global (toutes divisions). */
  rankTiers: string[]
  /** Libellé affiché ; vide = dérivé des divisions. */
  label: string | null
  thresholds: SurveillanceAlertThresholds
}

export interface SurveillanceThresholdsStorageV2 {
  version: 2
  /** Mêmes seuils pour toutes les cohortes. */
  sharedThresholds?: boolean
  profiles: SurveillanceCohortProfile[]
}

const VALID_RANK_TIER_SET = new Set<string>(RANK_TIERS)

export function normalizeSurveillanceRankTiers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    const tier = String(raw ?? '')
      .trim()
      .toUpperCase()
      .split('_')[0]
    if (!tier || !VALID_RANK_TIER_SET.has(tier)) continue
    if (!out.includes(tier)) out.push(tier)
  }
  return out.sort(
    (a, b) =>
      (RANK_TIERS.indexOf(a as (typeof RANK_TIERS)[number]) + 1 || 999) -
      (RANK_TIERS.indexOf(b as (typeof RANK_TIERS)[number]) + 1 || 999)
  )
}

export function surveillanceCohortKey(rankTiers: readonly string[]): string {
  const normalized = normalizeSurveillanceRankTiers([...rankTiers])
  if (normalized.length === 0) return SURVEILLANCE_GLOBAL_COHORT_KEY
  return normalized.join(',')
}

export function surveillanceCohortRankTiers(cohortKey: string): string[] {
  const key = String(cohortKey ?? '').trim()
  if (!key || key === SURVEILLANCE_GLOBAL_COHORT_KEY) return []
  return normalizeSurveillanceRankTiers(key.split(','))
}

export function defaultSurveillanceCohortProfile(
  rankTiers: readonly string[] = []
): SurveillanceCohortProfile {
  const tiers = normalizeSurveillanceRankTiers([...rankTiers])
  return {
    cohortKey: surveillanceCohortKey(tiers),
    rankTiers: tiers,
    label: null,
    thresholds: defaultSurveillanceAlertThresholds(),
  }
}

export function defaultSurveillanceThresholdProfiles(): SurveillanceCohortProfile[] {
  return [defaultSurveillanceCohortProfile()]
}

export function normalizeSurveillanceCohortLabel(value: unknown): string | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  return trimmed.slice(0, 64)
}

export function formatSurveillanceCohortLabel(
  cohortKey: string,
  translate?: (key: string) => string
): string {
  const tiers = surveillanceCohortRankTiers(cohortKey)
  if (tiers.length === 0) {
    return translate?.('statisticsPage.allRanks') ?? 'Global'
  }
  return tiers.map(tier => tier.charAt(0) + tier.slice(1).toLowerCase()).join(' + ')
}

export function resolveSurveillanceCohortLabel(
  profile: Pick<SurveillanceCohortProfile, 'cohortKey' | 'label'>,
  translate?: (key: string) => string
): string {
  const custom = normalizeSurveillanceCohortLabel(profile.label)
  if (custom) return custom
  return formatSurveillanceCohortLabel(profile.cohortKey, translate)
}

export function buildSurveillanceBaselineKey(
  championKey: string | number,
  cohortKey: string
): string {
  return `${String(championKey)}::${cohortKey}`
}

export function parseSurveillanceBaselineKey(key: string): {
  championKey: string
  cohortKey: string
} {
  const raw = String(key ?? '')
  const sep = raw.indexOf('::')
  if (sep < 0) {
    return { championKey: raw, cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY }
  }
  return {
    championKey: raw.slice(0, sep),
    cohortKey: raw.slice(sep + 2) || SURVEILLANCE_GLOBAL_COHORT_KEY,
  }
}

/** Query GET /api/stats/champions/:id — otp=oui pour inclure les champions niche de la watchlist. */
export type SurveillanceChampionStatsQuery = {
  version?: string | null
  rankTiers?: readonly string[]
}

export function buildSurveillanceChampionStatsQuery(
  options: SurveillanceChampionStatsQuery = {}
): string {
  const p = new URLSearchParams()
  p.set('otp', 'oui')
  const version = String(options.version ?? '').trim()
  if (version) p.set('version', version)
  for (const tier of options.rankTiers ?? []) {
    const normalized = String(tier ?? '')
      .trim()
      .toUpperCase()
      .split('_')[0]
    if (normalized) p.append('rankTier', normalized)
  }
  const q = p.toString()
  return q ? `?${q}` : ''
}

export type SurveillanceAlertTrigger =
  | {
      kind: 'min'
      metric: SurveillanceMetricId
      threshold: number
      current: number
      cohortKey: string
      cohortLabel?: string
    }
  | {
      kind: 'max'
      metric: SurveillanceMetricId
      threshold: number
      current: number
      cohortKey: string
      cohortLabel?: string
    }
  | {
      kind: 'delta'
      metric: SurveillanceMetricId
      threshold: number
      current: number
      reference: number
      patchLabel?: string
      cohortKey: string
      cohortLabel?: string
    }

const METRIC_KEYS: SurveillanceMetricId[] = ['winrate', 'pickrate', 'banrate']

type NumericThresholdKey =
  | 'winrateMin'
  | 'winrateMax'
  | 'pickrateMin'
  | 'pickrateMax'
  | 'banrateMin'
  | 'banrateMax'
  | 'winrateDeltaPct'
  | 'pickrateDeltaPct'
  | 'banrateDeltaPct'

export function defaultSurveillanceAlertThresholds(): SurveillanceAlertThresholds {
  return {
    winrateMin: null,
    winrateMax: null,
    pickrateMin: null,
    pickrateMax: null,
    banrateMin: null,
    banrateMax: null,
    winrateDeltaPct: null,
    pickrateDeltaPct: null,
    banrateDeltaPct: null,
    winrateDeltaDirection: defaultDeltaDirectionFlags(),
    pickrateDeltaDirection: defaultDeltaDirectionFlags(),
    banrateDeltaDirection: defaultDeltaDirectionFlags(),
  }
}

export function normalizeSurveillanceAlertThresholds(
  value: Partial<SurveillanceAlertThresholds> | null | undefined
): SurveillanceAlertThresholds {
  const defaults = defaultSurveillanceAlertThresholds()
  if (!value || typeof value !== 'object') return defaults

  const legacyGlobal =
    'deltaDirection' in value
      ? normalizeSurveillanceDeltaDirection((value as { deltaDirection?: unknown }).deltaDirection)
      : undefined

  const read = (key: NumericThresholdKey): number | null => {
    const raw = value[key as keyof typeof value]
    if (raw === null || raw === undefined || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  return {
    winrateMin: read('winrateMin'),
    winrateMax: read('winrateMax'),
    pickrateMin: read('pickrateMin'),
    pickrateMax: read('pickrateMax'),
    banrateMin: read('banrateMin'),
    banrateMax: read('banrateMax'),
    winrateDeltaPct: read('winrateDeltaPct'),
    pickrateDeltaPct: read('pickrateDeltaPct'),
    banrateDeltaPct: read('banrateDeltaPct'),
    winrateDeltaDirection: normalizeDeltaDirectionFlags(
      (value as Partial<SurveillanceAlertThresholds>).winrateDeltaDirection,
      legacyGlobal
    ),
    pickrateDeltaDirection: normalizeDeltaDirectionFlags(
      (value as Partial<SurveillanceAlertThresholds>).pickrateDeltaDirection,
      legacyGlobal
    ),
    banrateDeltaDirection: normalizeDeltaDirectionFlags(
      (value as Partial<SurveillanceAlertThresholds>).banrateDeltaDirection,
      legacyGlobal
    ),
  }
}

export function normalizeSurveillanceCohortProfile(
  value: Partial<SurveillanceCohortProfile> | null | undefined
): SurveillanceCohortProfile | null {
  if (!value || typeof value !== 'object') return null
  const rankTiers = normalizeSurveillanceRankTiers(value.rankTiers)
  const cohortKey = surveillanceCohortKey(rankTiers)
  return {
    cohortKey,
    rankTiers,
    label: normalizeSurveillanceCohortLabel(value.label),
    thresholds: normalizeSurveillanceAlertThresholds(value.thresholds),
  }
}

export function normalizeSurveillanceCohortProfiles(value: unknown): SurveillanceCohortProfile[] {
  if (!Array.isArray(value)) return defaultSurveillanceThresholdProfiles()

  const profiles: SurveillanceCohortProfile[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    const profile = normalizeSurveillanceCohortProfile(entry as Partial<SurveillanceCohortProfile>)
    if (!profile || seen.has(profile.cohortKey)) continue
    seen.add(profile.cohortKey)
    profiles.push(profile)
  }

  if (profiles.length === 0) return defaultSurveillanceThresholdProfiles()
  if (!profiles.some(p => p.cohortKey === SURVEILLANCE_GLOBAL_COHORT_KEY)) {
    profiles.unshift(defaultSurveillanceCohortProfile())
  }
  return profiles
}

/** Migration v1 (seuils plats) → profils par cohorte. */
export function migrateSurveillanceThresholdsStorage(
  raw: unknown
): SurveillanceThresholdsStorageV2 {
  if (!raw || typeof raw !== 'object') {
    return serializeSurveillanceThresholdsStorage(defaultSurveillanceThresholdProfiles(), false)
  }

  const record = raw as Record<string, unknown>
  if (record.version === 2 && Array.isArray(record.profiles)) {
    return serializeSurveillanceThresholdsStorage(
      normalizeSurveillanceCohortProfiles(record.profiles),
      record.sharedThresholds === true
    )
  }

  if ('winrateMin' in record || 'winrateMax' in record || 'winrateDeltaPct' in record) {
    return serializeSurveillanceThresholdsStorage(
      [
        {
          cohortKey: SURVEILLANCE_GLOBAL_COHORT_KEY,
          rankTiers: [],
          label: null,
          thresholds: normalizeSurveillanceAlertThresholds(
            record as Partial<SurveillanceAlertThresholds>
          ),
        },
      ],
      false
    )
  }

  return serializeSurveillanceThresholdsStorage(defaultSurveillanceThresholdProfiles(), false)
}

export function serializeSurveillanceThresholdProfiles(
  profiles: readonly SurveillanceCohortProfile[]
): SurveillanceThresholdsStorageV2 {
  return serializeSurveillanceThresholdsStorage(profiles, false)
}

export function serializeSurveillanceThresholdsStorage(
  profiles: readonly SurveillanceCohortProfile[],
  sharedThresholds: boolean
): SurveillanceThresholdsStorageV2 {
  return {
    version: 2,
    sharedThresholds,
    profiles: normalizeSurveillanceCohortProfiles([...profiles]),
  }
}

export function syncProfilesSharedThresholds(
  profiles: readonly SurveillanceCohortProfile[],
  thresholds: SurveillanceAlertThresholds
): SurveillanceCohortProfile[] {
  const normalized = normalizeSurveillanceAlertThresholds(thresholds)
  return normalizeSurveillanceCohortProfiles(
    profiles.map(profile => ({
      ...profile,
      thresholds: { ...normalized },
    }))
  )
}

export function configuredSurveillanceCohortProfiles(
  profiles: readonly SurveillanceCohortProfile[]
): SurveillanceCohortProfile[] {
  return profiles.filter(profile => hasConfiguredSurveillanceThresholds(profile.thresholds))
}

export function countCustomSurveillanceCohortProfiles(
  profiles: readonly SurveillanceCohortProfile[]
): number {
  return profiles.filter(profile => profile.cohortKey !== SURVEILLANCE_GLOBAL_COHORT_KEY).length
}

export function canAddSurveillanceCohortProfile(
  profiles: readonly SurveillanceCohortProfile[]
): boolean {
  return countCustomSurveillanceCohortProfiles(profiles) < SURVEILLANCE_MAX_CUSTOM_COHORTS
}

function metricValue(snapshot: ChampionMetricSnapshot, metric: SurveillanceMetricId): number {
  return snapshot[metric]
}

function thresholdMin(
  thresholds: SurveillanceAlertThresholds,
  metric: SurveillanceMetricId
): number | null {
  if (metric === 'winrate') return thresholds.winrateMin
  if (metric === 'pickrate') return thresholds.pickrateMin
  return thresholds.banrateMin
}

function thresholdMax(
  thresholds: SurveillanceAlertThresholds,
  metric: SurveillanceMetricId
): number | null {
  if (metric === 'winrate') return thresholds.winrateMax
  if (metric === 'pickrate') return thresholds.pickrateMax
  return thresholds.banrateMax
}

function thresholdDelta(
  thresholds: SurveillanceAlertThresholds,
  metric: SurveillanceMetricId
): number | null {
  if (metric === 'winrate') return thresholds.winrateDeltaPct
  if (metric === 'pickrate') return thresholds.pickrateDeltaPct
  return thresholds.banrateDeltaPct
}

function thresholdDeltaDirection(
  thresholds: SurveillanceAlertThresholds,
  metric: SurveillanceMetricId
): DeltaDirectionFlags {
  if (metric === 'winrate') return thresholds.winrateDeltaDirection
  if (metric === 'pickrate') return thresholds.pickrateDeltaDirection
  return thresholds.banrateDeltaDirection
}

export function aggregateTrendPoints(
  points: DailyTrendSnapshotPoint[]
): ChampionMetricSnapshot | null {
  if (points.length === 0) return null

  let totalGames = 0
  let totalWins = 0
  let pickWeighted = 0
  let banWeighted = 0

  for (const point of points) {
    const games = Number(point.games ?? 0)
    if (games <= 0) continue
    totalGames += games
    totalWins += Number(point.wins ?? 0)
    pickWeighted += Number(point.pickRatePct ?? 0) * games
    banWeighted += Number(point.banRatePct ?? 0) * games
  }

  if (totalGames <= 0) return null

  return {
    winrate: Math.round((10000 * totalWins) / totalGames) / 100,
    pickrate: Math.round((100 * pickWeighted) / totalGames) / 100,
    banrate: Math.round((100 * banWeighted) / totalGames) / 100,
  }
}

export function computePatchStartMetrics(
  points: DailyTrendSnapshotPoint[],
  patchReleaseDate: string
): ChampionMetricSnapshot | null {
  return computeTrendReferenceMetrics(points, patchReleaseDate)
}

/** Stats agrégées au premier jour disponible à partir de la date de référence. */
export function computeTrendReferenceMetrics(
  points: DailyTrendSnapshotPoint[],
  referenceDate: string
): ChampionMetricSnapshot | null {
  const eligible = points.filter(
    point => String(point.dateOfGame ?? '') >= String(referenceDate ?? '')
  )
  if (eligible.length === 0) return null

  const minDate = eligible.reduce(
    (min, point) => (point.dateOfGame < min ? point.dateOfGame : min),
    eligible[0]!.dateOfGame
  )
  return aggregateTrendPoints(eligible.filter(point => point.dateOfGame === minDate))
}

export type SurveillanceReferenceMode = 'current_patch' | 'date' | 'patch'

export interface SurveillanceReferenceSettings {
  mode: SurveillanceReferenceMode
  /** YYYY-MM-DD lorsque mode = date */
  referenceDate: string | null
  /** Libellé patch (ex. 16.12) lorsque mode = patch */
  referencePatchLabel: string | null
}

export type SurveillanceVersionsCatalogEntry = { patchLabel: string; releaseDate: string }

export function defaultSurveillanceReferenceSettings(): SurveillanceReferenceSettings {
  return {
    mode: 'current_patch',
    referenceDate: null,
    referencePatchLabel: null,
  }
}

export function normalizeIsoDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

export function clampIsoDate(date: string, min: string, max: string): string {
  const iso = normalizeIsoDate(date)
  if (!iso) return min
  if (iso < min) return min
  if (iso > max) return max
  return iso
}

export function parseTypedIsoDate(value: unknown): string | null {
  return normalizeIsoDate(value)
}

export function normalizeSurveillanceReferenceSettings(
  value: Partial<SurveillanceReferenceSettings> | null | undefined
): SurveillanceReferenceSettings {
  const defaults = defaultSurveillanceReferenceSettings()
  if (!value || typeof value !== 'object') return defaults

  const modeRaw = String(value.mode ?? '').trim()
  const mode: SurveillanceReferenceMode =
    modeRaw === 'date' || modeRaw === 'patch' ? modeRaw : 'current_patch'

  return {
    mode,
    referenceDate: normalizeIsoDate(value.referenceDate),
    referencePatchLabel: String(value.referencePatchLabel ?? '').trim() || null,
  }
}

export function resolveSurveillanceReference(
  settings: SurveillanceReferenceSettings,
  catalog: readonly SurveillanceVersionsCatalogEntry[]
): { releaseDate: string; label: string } | null {
  if (settings.mode === 'date') {
    const date = normalizeIsoDate(settings.referenceDate)
    if (!date) return null
    return { releaseDate: date, label: formatSurveillanceReferenceDate(date) }
  }

  if (settings.mode === 'patch') {
    const label = String(settings.referencePatchLabel ?? '').trim()
    if (!label) return null
    const entry = catalog.find(row => row.patchLabel === label)
    if (!entry) return null
    return { releaseDate: entry.releaseDate, label: entry.patchLabel }
  }

  if (catalog.length === 0) return null
  const latest = catalog[catalog.length - 1]!
  return { releaseDate: latest.releaseDate, label: latest.patchLabel }
}

export function evaluateSurveillanceAlerts(input: {
  current: ChampionMetricSnapshot
  patchStart: ChampionMetricSnapshot | null
  thresholds: SurveillanceAlertThresholds
  patchLabel?: string
  cohortKey?: string
  cohortLabel?: string
}): SurveillanceAlertTrigger[] {
  const triggers: SurveillanceAlertTrigger[] = []
  const { current, patchStart, thresholds, patchLabel } = input
  const cohortKey = input.cohortKey ?? SURVEILLANCE_GLOBAL_COHORT_KEY
  const cohortLabel = input.cohortLabel

  for (const metric of METRIC_KEYS) {
    const value = metricValue(current, metric)
    const min = thresholdMin(thresholds, metric)
    const max = thresholdMax(thresholds, metric)
    const delta = thresholdDelta(thresholds, metric)

    if (min !== null && value < min) {
      triggers.push({ kind: 'min', metric, threshold: min, current: value, cohortKey, cohortLabel })
    }
    if (max !== null && value > max) {
      triggers.push({ kind: 'max', metric, threshold: max, current: value, cohortKey, cohortLabel })
    }
    if (delta !== null && patchStart) {
      const reference = metricValue(patchStart, metric)
      const diff = value - reference
      if (
        Math.abs(diff) >= delta &&
        passesDeltaDirectionFlags(diff, thresholdDeltaDirection(thresholds, metric))
      ) {
        triggers.push({
          kind: 'delta',
          metric,
          threshold: delta,
          current: value,
          reference,
          patchLabel,
          cohortKey,
          cohortLabel,
        })
      }
    }
  }

  return triggers
}

export function hasConfiguredSurveillanceThresholds(
  thresholds: SurveillanceAlertThresholds
): boolean {
  return (
    thresholds.winrateMin !== null ||
    thresholds.winrateMax !== null ||
    thresholds.pickrateMin !== null ||
    thresholds.pickrateMax !== null ||
    thresholds.banrateMin !== null ||
    thresholds.banrateMax !== null ||
    thresholds.winrateDeltaPct !== null ||
    thresholds.pickrateDeltaPct !== null ||
    thresholds.banrateDeltaPct !== null
  )
}

export interface SurveillanceTestBaseline {
  snapshot: ChampionMetricSnapshot
  /** Date ISO (YYYY-MM-DD) affichée comme référence historique. */
  capturedAt: string
  patchLabel?: string
  cohortKey?: string
}

function deltaThresholdForMetric(
  thresholds: SurveillanceAlertThresholds,
  metric: SurveillanceMetricId
): number | null {
  if (metric === 'winrate') return thresholds.winrateDeltaPct
  if (metric === 'pickrate') return thresholds.pickrateDeltaPct
  return thresholds.banrateDeltaPct
}

/** Scénario synthétique : déclenche tous les seuils configurés sans appel API. */
export function buildDemoAlertScenario(thresholds: SurveillanceAlertThresholds): {
  current: ChampionMetricSnapshot
  reference: ChampionMetricSnapshot
} {
  const current: ChampionMetricSnapshot = { winrate: 50, pickrate: 5, banrate: 5 }
  const reference: ChampionMetricSnapshot = { ...current }

  for (const metric of METRIC_KEYS) {
    const min = thresholdMin(thresholds, metric)
    const max = thresholdMax(thresholds, metric)
    const delta = thresholdDelta(thresholds, metric)

    if (max !== null) {
      current[metric] = Math.min(100, max + 5)
    } else if (min !== null) {
      current[metric] = Math.max(0, min - 5)
    }

    if (delta !== null) {
      reference[metric] = demoReferenceForDeltaFlags(
        current[metric],
        delta,
        thresholdDeltaDirection(thresholds, metric)
      )
    }
  }

  return { current, reference }
}

/** Référence artificielle pour déclencher les alertes d'écart en démo (à partir de stats réelles). */
export function buildDemoReferenceSnapshot(
  current: ChampionMetricSnapshot,
  thresholds: SurveillanceAlertThresholds
): ChampionMetricSnapshot {
  const reference: ChampionMetricSnapshot = { ...current }

  for (const metric of METRIC_KEYS) {
    const delta = deltaThresholdForMetric(thresholds, metric)
    if (delta === null) continue
    const value = metricValue(current, metric)
    reference[metric] = demoReferenceForDeltaFlags(
      value,
      delta,
      thresholdDeltaDirection(thresholds, metric)
    )
  }

  return reference
}

export function formatSurveillanceReferenceDate(isoDate: string): string {
  const clean = String(isoDate ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  const [year, month, day] = clean.split('-')
  return `${day}/${month}/${year}`
}

export function surveillanceReferenceDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - Math.max(0, Math.trunc(daysAgo)))
  return date.toISOString().slice(0, 10)
}

export type SurveillanceAlertTone = 'positive' | 'negative'

/** Vert = hausse / au-dessus du max ; rouge = sous le min / baisse. Banrate inversé. */
export function surveillanceAlertTone(trigger: SurveillanceAlertTrigger): SurveillanceAlertTone {
  const inverted = trigger.metric === 'banrate'

  if (trigger.kind === 'min') {
    return inverted ? 'positive' : 'negative'
  }
  if (trigger.kind === 'max') {
    return inverted ? 'negative' : 'positive'
  }

  const delta = trigger.current - trigger.reference
  if (delta > 0) return inverted ? 'negative' : 'positive'
  if (delta < 0) return inverted ? 'positive' : 'negative'
  return 'negative'
}

/** Empreinte stable pour badge / accusé de lecture (ignore les valeurs courantes qui bougent à chaque fetch). */
export function stableSurveillanceAlertsFingerprint(
  activeAlerts: Record<string, SurveillanceAlertTrigger[]>
): string {
  const keys = Object.keys(activeAlerts).sort((a, b) => a.localeCompare(b))
  return keys
    .map(championKey => {
      const triggers = activeAlerts[championKey] ?? []
      const sig = triggers
        .map(trigger => `${trigger.kind}:${trigger.metric}:${trigger.cohortKey}`)
        .sort()
        .join(',')
      return `${championKey}=[${sig}]`
    })
    .join(';')
}

export interface SurveillanceAlertCheckResult {
  alertCount: number
  watchedCount: number
  evaluatedCount: number
  unresolvedCount: number
  fetchFailedCount: number
}

export interface SurveillanceCaptureResult {
  captured: number
  watchedCount: number
  unresolvedCount: number
  fetchFailedCount: number
}
