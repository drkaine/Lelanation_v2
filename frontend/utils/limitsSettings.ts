/** Seuils réglables depuis Gestion (miroir des specs backend StatsLimitsService / AdminLimitsService). */
export interface LimitFieldSpec<K extends string> {
  key: K
  min: number
  max?: number
  integer?: boolean
  step: number
}

export type StatsLimitKey =
  | 'tierListMinGames'
  | 'tierListMinPickPct'
  | 'botlaneMinGames'
  | 'regionWinrateMinGames'
  | 'otpWinrateMinGames'
  | 'compareTopLimit'
  | 'regionSpreadLimit'
  | 'dashboardPopulationMinGames'
  | 'synergyMinPeerGames'
  | 'matchupScoreMax'

export type AdminLimitKey =
  | 'voteMinTotal'
  | 'voteMinUpvotePct'
  | 'pollTargetNewGames'
  | 'pollMinDelayDays'
  | 'pollMaxDelayDays'
  | 'pollWindowHours'
  | 'rankHistoryRetentionDays'
  | 'patchRetentionDays'

export const DEFAULT_STATS_LIMITS: Record<StatsLimitKey, number> = {
  tierListMinGames: 10,
  tierListMinPickPct: 0.5,
  botlaneMinGames: 10,
  regionWinrateMinGames: 20,
  otpWinrateMinGames: 10,
  compareTopLimit: 10,
  regionSpreadLimit: 15,
  dashboardPopulationMinGames: 30,
  synergyMinPeerGames: 3,
  matchupScoreMax: 10,
}

const games = (key: StatsLimitKey): LimitFieldSpec<StatsLimitKey> => ({
  key,
  min: 1,
  integer: true,
  step: 1,
})

export const STATS_LIMIT_SPECS: ReadonlyArray<LimitFieldSpec<StatsLimitKey>> = [
  games('tierListMinGames'),
  { key: 'tierListMinPickPct', min: 0, max: 100, step: 0.1 },
  games('botlaneMinGames'),
  games('regionWinrateMinGames'),
  games('otpWinrateMinGames'),
  { key: 'compareTopLimit', min: 1, max: 100, integer: true, step: 1 },
  { key: 'regionSpreadLimit', min: 1, max: 100, integer: true, step: 1 },
  games('dashboardPopulationMinGames'),
  games('synergyMinPeerGames'),
  { key: 'matchupScoreMax', min: 0.1, max: 100, step: 0.5 },
]

export const ADMIN_LIMIT_SPECS: ReadonlyArray<LimitFieldSpec<AdminLimitKey>> = [
  { key: 'voteMinTotal', min: 1, integer: true, step: 1 },
  { key: 'voteMinUpvotePct', min: 0, max: 100, step: 1 },
  { key: 'pollTargetNewGames', min: 0.1, max: 100, step: 0.5 },
  { key: 'pollMinDelayDays', min: 0.01, max: 365, step: 0.25 },
  { key: 'pollMaxDelayDays', min: 0.01, max: 365, step: 1 },
  { key: 'pollWindowHours', min: 1, max: 168, integer: true, step: 1 },
  { key: 'rankHistoryRetentionDays', min: 1, max: 365, integer: true, step: 1 },
  { key: 'patchRetentionDays', min: 0, max: 90, integer: true, step: 1 },
]

function fieldValid<K extends string>(spec: LimitFieldSpec<K>, v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false
  if (spec.integer && !Number.isInteger(v)) return false
  return v >= spec.min && (spec.max === undefined || v <= spec.max)
}

/** Contrôles croisés connus (poller : délai max ≥ délai min). */
function crossValid(values: Record<string, number>): boolean {
  const { pollMinDelayDays: min, pollMaxDelayDays: max } = values
  return min === undefined || max === undefined || max >= min
}

export function limitsValid<K extends string>(
  specs: ReadonlyArray<LimitFieldSpec<K>>,
  values: Record<K, number>
): boolean {
  return specs.every(s => fieldValid(s, values[s.key])) && crossValid(values)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function isComplete<K extends string>(
  out: Partial<Record<K, number>>,
  specs: ReadonlyArray<LimitFieldSpec<K>>
): out is Record<K, number> {
  return specs.every(s => typeof out[s.key] === 'number')
}

/** Réponse `{ settings }` des routes GET/PUT ; null si incomplète ou invalide. */
export function parseLimitsResponse<K extends string>(
  specs: ReadonlyArray<LimitFieldSpec<K>>,
  body: unknown
): Record<K, number> | null {
  if (!isRecord(body) || !isRecord(body.settings)) return null
  const raw = body.settings
  const out: Partial<Record<K, number>> = {}
  for (const spec of specs) {
    const v = raw[spec.key]
    if (!fieldValid(spec, v)) return null
    out[spec.key] = v
  }
  if (!isComplete(out, specs)) return null
  return crossValid(out) ? out : null
}
