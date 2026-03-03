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

export interface RateLimitBucketLimit {
  count: number
  windowSeconds: number
}

export interface RateLimitBucket {
  name: string
  limits: RateLimitBucketLimit[]
}

export interface RateLimitConfig {
  buckets: RateLimitBucket[]
}

export interface VersionInfo {
  currentVersion: string
  lastSyncDate: string
  lastSyncTimestamp: number
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

export async function loadRateLimitConfig(): Promise<Result<RateLimitConfig, AppError>> {
  const path = join(DATA_RIOT, 'rate-limit.json')
  const r = await FileManager.readJson<RateLimitConfig>(path)
  if (r.isErr()) return r
  const data = r.unwrap()
  if (!data?.buckets || !Array.isArray(data.buckets)) {
    return Result.err(new AppError('rate-limit.json: missing or invalid buckets', 'FILE_ERROR'))
  }
  return Result.ok(data)
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
