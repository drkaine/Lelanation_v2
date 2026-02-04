/**
 * Long-running worker: crawl Riot match data + enrich summoner_name in a loop, respecting rate limits.
 * Retries: (1) 401/403 → retry once with Admin key; (2) other errors → retry with backoff then next cycle.
 * Run under PM2/systemd with autorestart so that process crash = restart.
 *
 * Usage: npm run riot:worker (from backend/) or cd backend && npx tsx src/scripts/runRiotMatchCollectWorker.ts
 * Stop: Ctrl+C (SIGINT) or kill (SIGTERM).
 *
 * Env:
 *   RIOT_MATCH_CYCLE_DELAY_MS     - Pause between cycles (default 60_000 = 1 min).
 *   RIOT_MATCH_ENRICH_PASSES      - Extra enrich passes per cycle (default 3).
 *   RIOT_MATCH_ENRICH_PER_PASS    - Players to enrich per pass (default 150).
 *   RIOT_MATCH_CRAWL_RETRIES      - Retries for crawl on transient error (default 3).
 *   RIOT_MATCH_CRAWL_BACKOFF_MS   - Initial backoff between retries (default 30_000).
 */
import axios from 'axios'
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { runRiotMatchCollectOnce } from '../cron/riotMatchCollect.js'
import { enrichPlayers } from '../services/StatsPlayersRefreshService.js'
import { getRiotApiService } from '../services/RiotApiService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const CYCLE_DELAY_MS = Math.max(0, parseInt(process.env.RIOT_MATCH_CYCLE_DELAY_MS ?? '60000', 10) || 60000)
const ENRICH_PASSES_AFTER_CYCLE = Math.max(0, parseInt(process.env.RIOT_MATCH_ENRICH_PASSES ?? '3', 10) || 3)
const ENRICH_PER_PASS = Math.max(10, parseInt(process.env.RIOT_MATCH_ENRICH_PER_PASS ?? '150', 10) || 150)
const CRAWL_RETRIES = Math.max(1, parseInt(process.env.RIOT_MATCH_CRAWL_RETRIES ?? '3', 10) || 3)
const CRAWL_BACKOFF_MS = Math.max(5000, parseInt(process.env.RIOT_MATCH_CRAWL_BACKOFF_MS ?? '30000', 10) || 30000)

const LOG = '[riot:worker]'

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Run crawl with retries: auth error → retry with Admin key once; other errors → backoff and retry up to CRAWL_RETRIES. */
async function runCrawlWithRetry(riotApi: ReturnType<typeof getRiotApiService>): Promise<void> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= CRAWL_RETRIES; attempt++) {
    try {
      await runRiotMatchCollectOnce()
      return
    } catch (err) {
      lastErr = err
      if (isRiotAuthError(err)) {
        console.warn(`${LOG} Key rejected (401/403), retrying with Admin key…`)
        riotApi.invalidateKeyCache()
        riotApi.setKeyPreference(true)
        try {
          await runRiotMatchCollectOnce()
          return
        } catch (retryErr) {
          if (isRiotAuthError(retryErr)) {
            console.error(`${LOG} Riot API key invalid or expired. Set RIOT_API_KEY or Admin key.`)
            throw retryErr
          }
          lastErr = retryErr
        }
      }
      if (attempt < CRAWL_RETRIES) {
        const backoff = CRAWL_BACKOFF_MS * Math.pow(2, attempt - 1)
        console.warn(`${LOG} Crawl failed (attempt ${attempt}/${CRAWL_RETRIES}), retry in ${backoff / 1000}s:`, err)
        await sleep(backoff)
      } else {
        console.error(`${LOG} Crawl failed after ${CRAWL_RETRIES} attempts:`, lastErr)
      }
    }
  }
}

async function main(): Promise<void> {
  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(false)

  let running = true
  const onStop = () => {
    console.log(`${LOG} Stop requested, finishing current cycle then exit.`)
    running = false
  }
  process.on('SIGINT', onStop)
  process.on('SIGTERM', onStop)

  console.log(
    `${LOG} Starting worker (cycle delay=${CYCLE_DELAY_MS}ms, enrich passes=${ENRICH_PASSES_AFTER_CYCLE}, per pass=${ENRICH_PER_PASS}, crawl retries=${CRAWL_RETRIES}). Stop with Ctrl+C.`
  )

  let cycle = 0
  while (running) {
    cycle++
    const cycleStart = Date.now()
    try {
      await runCrawlWithRetry(riotApi)
    } catch (err) {
      if (isRiotAuthError(err)) {
        console.error(`${LOG} Riot API key invalid or expired. Exiting.`)
        process.exit(1)
      }
      console.error(`${LOG} Crawl error (will retry next cycle):`, err)
    }

    if (!running) break

    for (let p = 0; p < ENRICH_PASSES_AFTER_CYCLE && running; p++) {
      try {
        const { enriched } = await enrichPlayers(ENRICH_PER_PASS)
        if (enriched === 0) break
      } catch (e) {
        console.warn(`${LOG} Enrich pass failed:`, e)
      }
    }

    if (!running) break

    const elapsed = Math.round((Date.now() - cycleStart) / 1000)
    console.log(`${LOG} Cycle ${cycle} done in ${elapsed}s, sleeping ${CYCLE_DELAY_MS / 1000}s…`)
    await sleep(CYCLE_DELAY_MS)
  }

  console.log(`${LOG} Stopped after ${cycle} cycle(s).`)
}

main().catch((err) => {
  console.error(`${LOG}`, err)
  process.exit(1)
})
