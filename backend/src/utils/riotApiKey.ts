/**
 * Riot API key: read from admin config file first, then fallback to RIOT_API_KEY env.
 * Path is relative to backend package so Admin and cron use the same file regardless of cwd.
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { FileManager } from './fileManager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..', '..')
/** Always backend/data/admin/riot-apikey.json, independent of process.cwd(). */
export const RIOT_API_KEY_FILE = join(BACKEND_ROOT, 'data', 'admin', 'riot-apikey.json')

interface RiotApikeyConfig {
  riotApiKey?: string
}

export function getRiotApiKey(): string | null {
  // Sync read not available from FileManager; we need async. Export async version.
  return (process.env.RIOT_API_KEY?.trim() && process.env.RIOT_API_KEY) || null
}

/**
 * Get Riot API key: by default file (admin) first, then env.
 * When preferEnv is true (e.g. in the script), try env first then file.
 */
export async function getRiotApiKeyAsync(preferEnv?: boolean): Promise<string | null> {
  const { key } = await getRiotApiKeyWithSourceAsync(preferEnv)
  return key
}

export type RiotApiKeySource = 'file' | 'env'

/** Key version for PUUID tracking (dev|perso|prod). Set via RIOT_PUUID_KEY_VERSION env. */
export const PUUID_KEY_VERSION_ENV = 'RIOT_PUUID_KEY_VERSION'

/**
 * Get the current PUUID key version (dev, perso, prod or custom).
 * Used to track which Riot API key the PUUIDs in DB are associated with.
 * Default: 'prod' if unset.
 */
export function getPuuidKeyVersion(): string {
  const v = process.env[PUUID_KEY_VERSION_ENV]?.trim()
  return v && v.length > 0 ? v : 'prod'
}

async function keyFromFile(): Promise<{ key: string; source: 'file' } | null> {
  const fileResult = await FileManager.readJson<RiotApikeyConfig>(RIOT_API_KEY_FILE)
  if (fileResult.isOk()) {
    const fromFile = fileResult.unwrap().riotApiKey
    if (typeof fromFile === 'string' && fromFile.trim() !== '') {
      return { key: fromFile.trim(), source: 'file' }
    }
  }
  return null
}

function keyFromEnv(): { key: string; source: 'env' } | null {
  const fromEnv = process.env.RIOT_API_KEY?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return { key: fromEnv, source: 'env' }
  }
  return null
}

/**
 * Get Riot API key with source. By default file first then env; when preferEnv, env first then file.
 */
export async function getRiotApiKeyWithSourceAsync(preferEnv?: boolean): Promise<{
  key: string | null
  source: RiotApiKeySource | null
}> {
  if (preferEnv) {
    const envKey = keyFromEnv()
    if (envKey) return envKey
    const fileKey = await keyFromFile()
    if (fileKey) return fileKey
    return { key: null, source: null }
  }
  const fileKey = await keyFromFile()
  if (fileKey) return fileKey
  const envKey = keyFromEnv()
  if (envKey) return envKey
  return { key: null, source: null }
}
