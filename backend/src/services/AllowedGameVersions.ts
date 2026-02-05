/**
 * Load allowed game versions from backend/data/game/versions.json and version.json.
 * Used by match collection to only ingest matches from patches we have data for.
 */
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

const DATA_GAME_DIR = join(process.cwd(), 'data', 'game')

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

/**
 * Load allowed game versions from data/game/versions.json and version.json (currentVersion).
 * Returns a set of version strings and the oldest release date for time-window filtering.
 */
export async function loadAllowedGameVersions(): Promise<AllowedGameVersionsResult> {
  const allowed = new Set<string>()
  let oldestReleaseEpochSec: number | null = null

  const versionsPath = join(DATA_GAME_DIR, 'versions.json')
  const versionsResult = await FileManager.readJson<VersionsJson>(versionsPath)
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

  const versionPath = join(DATA_GAME_DIR, 'version.json')
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
