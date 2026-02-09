/**
 * Load allowed game versions from backend/data/game/versions.json and version.json.
 * Used by match collection to only ingest matches from patches we have data for.
 * Path is resolved relative to backend package so the same file is used regardless of process.cwd().
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { FileManager } from '../utils/fileManager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..', '..')
/** Always backend/data/game (versions.json = source of truth for which patches to collect). */
const DATA_GAME_DIR = join(BACKEND_ROOT, 'data', 'game')

interface VersionsJson {
  versions?: Array<{ version: string; releaseDate?: string }>
}

interface VersionJson {
  currentVersion?: string
}

export interface AllowedGameVersionsResult {
  /** Set of allowed version strings (e.g. "16.1.1", "16.2.1", "16.3.1") */
  allowedVersions: Set<string>
  /** Oldest release date as epoch seconds (for match startTime filter), or null */
  oldestReleaseEpochSec: number | null
}

export interface PatchTimeWindow {
  startTime: number
  endTime: number
}

/**
 * Build time windows per patch from versions.json (release dates).
 * Each window covers [releaseDate_i, releaseDate_{i+1}) and the last covers [releaseDate_last, now].
 * Used to request match IDs per patch so we get 16.1, 16.2, 16.3 matches (not only the most recent patch).
 */
export async function getPatchTimeWindows(nowEpochSec?: number): Promise<PatchTimeWindow[]> {
  const now = nowEpochSec ?? Math.floor(Date.now() / 1000)
  const windows: PatchTimeWindow[] = []
  let baseDir = DATA_GAME_DIR
  const versionsPath = join(baseDir, 'versions.json')
  let versionsResult = await FileManager.readJson<VersionsJson>(versionsPath)
  if (versionsResult.isErr()) {
    const cwdDir = join(process.cwd(), 'data', 'game')
    if (cwdDir !== baseDir) {
      const fallbackResult = await FileManager.readJson<VersionsJson>(join(cwdDir, 'versions.json'))
      if (fallbackResult.isOk()) versionsResult = fallbackResult
    }
  }
  if (versionsResult.isErr()) return windows
  const data = versionsResult.unwrap()
  const list = (data?.versions ?? []).filter(
    (v): v is { version: string; releaseDate: string } =>
      typeof v?.version === 'string' && typeof (v as { releaseDate?: string }).releaseDate === 'string'
  )
  if (list.length === 0) return windows
  const sorted = list
    .map((v) => ({ version: v.version, epoch: new Date(v.releaseDate.trim()).getTime() / 1000 }))
    .filter((v) => !Number.isNaN(v.epoch))
    .sort((a, b) => a.epoch - b.epoch)
  for (let i = 0; i < sorted.length; i++) {
    const startTime = Math.floor(sorted[i].epoch)
    const endTime = i < sorted.length - 1 ? Math.floor(sorted[i + 1].epoch) : now
    if (endTime > startTime) windows.push({ startTime, endTime })
  }
  return windows
}

/**
 * Load allowed game versions from data/game/versions.json and version.json (currentVersion).
 * Returns a set of version strings and the oldest release date for time-window filtering.
 * Source of truth: versions.json (all patches to collect); version.json adds currentVersion if missing.
 */
export async function loadAllowedGameVersions(): Promise<AllowedGameVersionsResult> {
  const allowed = new Set<string>()
  let oldestReleaseEpochSec: number | null = null

  let baseDir = DATA_GAME_DIR
  const versionsPath = join(baseDir, 'versions.json')
  let versionsResult = await FileManager.readJson<VersionsJson>(versionsPath)
  if (versionsResult.isErr()) {
    const cwdDir = join(process.cwd(), 'data', 'game')
    if (cwdDir !== baseDir) {
      const fallbackPath = join(cwdDir, 'versions.json')
      const fallbackResult = await FileManager.readJson<VersionsJson>(fallbackPath)
      if (fallbackResult.isOk()) {
        versionsResult = fallbackResult
        baseDir = cwdDir
      }
    }
  }
  if (versionsResult.isOk()) {
    const data = versionsResult.unwrap()
    const list = data?.versions ?? []
    for (const v of list) {
      if (v?.version && typeof v.version === 'string') {
        allowed.add(v.version.trim())
        if (v.releaseDate && typeof v.releaseDate === 'string') {
          const epoch = new Date(v.releaseDate.trim()).getTime() / 1000
          if (!Number.isNaN(epoch)) {
            if (oldestReleaseEpochSec == null || epoch < oldestReleaseEpochSec) {
              oldestReleaseEpochSec = epoch
            }
          }
        }
      }
    }
  }

  const versionPath = join(baseDir, 'version.json')
  const versionResult = await FileManager.readJson<VersionJson>(versionPath)
  if (versionResult.isOk()) {
    const current = versionResult.unwrap()?.currentVersion
    if (current && typeof current === 'string') {
      allowed.add(current.trim())
    }
  }

  return { allowedVersions: allowed, oldestReleaseEpochSec }
}

/**
 * Return true if the match gameVersion is allowed.
 * Riot match gameVersion is typically "major.minor.build.revision" (e.g. 16.1.123.456 for patch 16.1).
 * Allowed versions in versions.json are Data Dragon style (e.g. 16.1.1). We allow exact match,
 * or gameVersion starting with allowed + ".", or gameVersion starting with patch prefix (e.g. 16.1 from 16.1.1).
 */
export function isAllowedGameVersion(gameVersion: string, allowedVersions: Set<string>): boolean {
  if (!gameVersion || typeof gameVersion !== 'string') return false
  const v = gameVersion.trim()
  if (allowedVersions.has(v)) return true
  for (const allowed of allowedVersions) {
    if (v.startsWith(allowed + '.') || v === allowed) return true
    // Patch prefix: "16.1.1" -> "16.1" so that "16.1.123.456" (Riot format) is allowed
    const parts = allowed.split('.')
    if (parts.length >= 2) {
      const patchPrefix = `${parts[0]}.${parts[1]}.`
      if (v.startsWith(patchPrefix)) return true
    }
  }
  return false
}
