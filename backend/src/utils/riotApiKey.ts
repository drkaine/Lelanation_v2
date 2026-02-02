/**
 * Riot API key: read from admin config file first, then fallback to RIOT_API_KEY env.
 * Used by RiotApiService and match collection. Never exposed to frontend.
 */
import { join } from 'path'
import { FileManager } from './fileManager.js'

const RIOT_API_KEY_FILE = join(process.cwd(), 'data', 'admin', 'riot-apikey.json')

interface RiotApikeyConfig {
  riotApiKey?: string
}

export function getRiotApiKey(): string | null {
  // Sync read not available from FileManager; we need async. Export async version.
  return (process.env.RIOT_API_KEY?.trim() && process.env.RIOT_API_KEY) || null
}

/**
 * Get Riot API key: file (admin-configured) first, then process.env.RIOT_API_KEY.
 */
export async function getRiotApiKeyAsync(): Promise<string | null> {
  const fileResult = await FileManager.readJson<RiotApikeyConfig>(RIOT_API_KEY_FILE)
  if (fileResult.isOk()) {
    const fromFile = fileResult.unwrap().riotApiKey
    if (typeof fromFile === 'string' && fromFile.trim() !== '') {
      return fromFile.trim()
    }
  }
  const fromEnv = process.env.RIOT_API_KEY?.trim()
  return (fromEnv && fromEnv.length > 0) ? fromEnv : null
}
