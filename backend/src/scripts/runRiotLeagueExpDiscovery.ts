/**
 * Discover players from League-exp entries and store them in players table (for later polling).
 *
 * Uses endpoint:
 *   /lol/league-exp/v4/entries/{queue}/{tier}/{division}
 *
 * Env options:
 *   RIOT_LEAGUE_EXP_PLATFORM=euw1|eun1
 *   RIOT_LEAGUE_EXP_QUEUE=RANKED_SOLO_5x5
 *   RIOT_LEAGUE_EXP_TIER=GOLD
 *   RIOT_LEAGUE_EXP_DIVISION=I
 *   RIOT_LEAGUE_EXP_PAGES=3
 */
import axios from 'axios'
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getRiotApiService } from '../services/RiotApiService.js'
import { discoverPlayersFromLeagueExp } from '../services/RiotLeagueExpDiscoveryService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

async function main(): Promise<void> {
  const riotApi = getRiotApiService()
  const platform = process.env.RIOT_LEAGUE_EXP_PLATFORM === 'eun1' ? 'eun1' : 'euw1'
  const queue = process.env.RIOT_LEAGUE_EXP_QUEUE ?? 'RANKED_SOLO_5x5'
  const tier = process.env.RIOT_LEAGUE_EXP_TIER ?? 'GOLD'
  const division = process.env.RIOT_LEAGUE_EXP_DIVISION ?? 'I'
  const pages = Number(process.env.RIOT_LEAGUE_EXP_PAGES ?? '3')

  riotApi.setKeyPreference(false)
  try {
    const result = await discoverPlayersFromLeagueExp({ platform, queue, tier, division, pages })
    console.log('[riot:discover-league-exp] result:', result)
  } catch (err) {
    if (isRiotAuthError(err)) {
      console.warn('[riot:discover-league-exp] Key from .env rejected (401/403), retrying with Admin key…')
      riotApi.invalidateKeyCache()
      riotApi.setKeyPreference(true)
      const result = await discoverPlayersFromLeagueExp({ platform, queue, tier, division, pages })
      console.log('[riot:discover-league-exp] result:', result)
      return
    }
    throw err
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[riot:discover-league-exp]', err)
    process.exit(1)
  })
