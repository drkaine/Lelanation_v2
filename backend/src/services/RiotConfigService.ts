/**
 * Load Riot poller config: match-filters, current version, rate-limit.
 */
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'

const DATA_RIOT = join(process.cwd(), 'data', 'riot')
const DATA_GAME = join(process.cwd(), 'data', 'game')

export interface MatchFilterVersion {
  version: string
  start: number
  maxMatches: number | null
  completed: boolean
}

export interface MatchFiltersConfig {
  queue: number
  count: number
  currentVersionSource?: string
  versions: MatchFilterVersion[]
}

export interface VersionInfo {
  currentVersion: string
  lastSyncDate: string
  lastSyncTimestamp: number
  releaseDate?: string
}

export async function loadMatchFilters(): Promise<Result<MatchFiltersConfig, AppError>> {
  const path = join(DATA_RIOT, 'match-filters.json')
  const r = await FileManager.readJson<MatchFiltersConfig>(path)
  if (r.isErr()) return r
  const data = r.unwrap()
  if (!data?.versions || !Array.isArray(data.versions)) {
    return Result.err(new AppError('match-filters.json: missing or invalid versions', 'FILE_ERROR'))
  }
  return Result.ok(data)
}

/** Recap des patches avec dates de release (data/game/versions.json). */
export interface GameVersionRecapEntry {
  version: string
  releaseDate: string
  patchLabel: string
}

export interface GameVersionsRecap {
  updatedAt?: string
  description?: string
  versions: GameVersionRecapEntry[]
}

export async function loadGameVersionsRecap(): Promise<Result<GameVersionsRecap, AppError>> {
  const path = join(DATA_GAME, 'versions.json')
  const r = await FileManager.readJson<GameVersionsRecap>(path)
  if (r.isErr()) return r
  const data = r.unwrap()
  if (!data?.versions || !Array.isArray(data.versions)) {
    return Result.err(new AppError('versions.json: missing or invalid versions', 'FILE_ERROR'))
  }
  return Result.ok(data)
}

/** releaseDate "YYYY-MM-DD" → début du jour en UTC (00:00:00), epoch secondes (Riot match-v5 ids). */
export function releaseDateToStartOfDayUtcSeconds(releaseDate: string): number {
  const trimmed = (releaseDate ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!m) return NaN
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN
  return Math.floor(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) / 1000)
}

/** Compare deux libellés de patch "major.minor" (ordre croissant : 16.1 < 16.2 < 16.10). */
export function comparePatchLabelsAsc(a: string, b: string): number {
  const pa = (a ?? '').trim().split('.')
  const pb = (b ?? '').trim().split('.')
  const aMaj = Number(pa[0])
  const aMin = Number(pa[1])
  const bMaj = Number(pb[0])
  const bMin = Number(pb[1])
  const aM = Number.isFinite(aMaj) ? aMaj : -1
  const aN = Number.isFinite(aMin) ? aMin : -1
  const bM = Number.isFinite(bMaj) ? bMaj : -1
  const bN = Number.isFinite(bMin) ? bMin : -1
  if (aM !== bM) return aM - bM
  return aN - bN
}

/**
 * Fenêtre startTime / endTime pour GET match-v5 by-puuid ids :
 * - startTime : min des releaseDate (00:00 UTC) des patches listés dans match-filters et présents dans versions.json
 * - endTime : date de release du premier patch **strictement plus récent** que le max autorisé (exclut ce patch), sinon maintenant
 */
export function computeMatchIdsTimeWindow(
  filters: MatchFiltersConfig,
  recap: GameVersionsRecap
): { startTime: number; endTime: number } | null {
  const allowed = filters.versions.map((v) => (v.version ?? '').trim()).filter(Boolean)
  if (allowed.length === 0) return null

  const allowedSet = new Set(allowed)
  const matched = recap.versions.filter((e) => allowedSet.has((e.patchLabel ?? '').trim()))
  if (matched.length === 0) return null

  const starts = matched
    .map((e) => releaseDateToStartOfDayUtcSeconds(e.releaseDate))
    .filter((s) => Number.isFinite(s))
  if (starts.length === 0) return null
  const startTime = Math.min(...starts)

  const matchedLabels = matched.map((e) => (e.patchLabel ?? '').trim()).filter(Boolean)
  let maxAllowed = matchedLabels[0]
  for (const p of matchedLabels) {
    if (comparePatchLabelsAsc(p, maxAllowed) > 0) maxAllowed = p
  }

  const strictlyNewer = recap.versions.filter(
    (e) => comparePatchLabelsAsc((e.patchLabel ?? '').trim(), maxAllowed) > 0
  )
  let endTime: number
  if (strictlyNewer.length === 0) {
    endTime = Math.floor(Date.now() / 1000)
  } else {
    const nextStarts = strictlyNewer
      .map((e) => releaseDateToStartOfDayUtcSeconds(e.releaseDate))
      .filter((s) => Number.isFinite(s))
    if (nextStarts.length === 0) {
      endTime = Math.floor(Date.now() / 1000)
    } else {
      endTime = Math.min(...nextStarts)
    }
  }

  if (endTime <= startTime) {
    return null
  }

  return { startTime, endTime }
}

export async function loadCurrentGameVersion(): Promise<Result<VersionInfo | null, AppError>> {
  const path = join(DATA_GAME, 'version.json')
  const exists = await FileManager.exists(path)
  if (!exists) return Result.ok(null)
  const r = await FileManager.readJson<VersionInfo>(path)
  if (r.isErr()) return r
  const data = r.unwrap()
  if (!data?.currentVersion || typeof data.currentVersion !== 'string') return Result.ok(null)
  return Result.ok(data)
}

export function getPatchFromVersion(version: string): string {
  return version.replace(/\.\d+$/, '')
}
