/**
 * One-off script to run Riot match collection (EUW + EUNE, leagues + matches + refresh).
 * Tries the key from .env first; if Riot returns 401/403, retries with the key from Admin.
 * Loads backend/.env first so it works whether run from backend/ or project root.
 * Usage: npm run riot:collect (from backend/) or cd backend && npx tsx src/scripts/runRiotMatchCollect.ts
 */
import axios from 'axios'
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

async function main(): Promise<void> {
  const { runRiotMatchCollectOnce } = await import('../cron/riotMatchCollect.js')
  const { getRiotApiService } = await import('../services/RiotApiService.js')

  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(true)

  try {
    await runRiotMatchCollectOnce()
  } catch (err) {
    if (isRiotAuthError(err)) {
      console.warn('[riot:collect] Key from .env rejected by Riot (401/403), retrying with Admin key…')
      riotApi.invalidateKeyCache()
      riotApi.setKeyPreference(false)
      await runRiotMatchCollectOnce()
    } else {
      throw err
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[riot:collect]', err)
    process.exit(1)
  })
