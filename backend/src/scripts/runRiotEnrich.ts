/**
 * One-off script to enrich players missing summoner_name (Riot ID via Account-V1).
 * Loads backend/.env first so it works whether run from backend/ or project root.
 * Usage: npm run riot:enrich (from backend/) or cd backend && npx tsx src/scripts/runRiotEnrich.ts
 * Optional: ENRICH_LIMIT=200 npm run riot:enrich
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import {
  writeProgress,
  isStopRequested,
  clearProgressAndStopRequest,
} from '../utils/ProcessProgressWriter.js'

const SCRIPT_ID = 'riot:enrich'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  await log.start(args)
  await writeProgress(SCRIPT_ID, {
    pid: process.pid,
    phase: 'starting',
    metrics: {},
  })

  if (await isStopRequested(SCRIPT_ID)) {
    await log.info('Stop requested before start, exiting.')
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }

  const { enrichPlayers, countPlayersMissingSummonerName } = await import('../services/StatsPlayersRefreshService.js')
  const missingCount = await countPlayersMissingSummonerName()
  if (missingCount === 0) {
    await log.info('Rien à faire : 0 joueur sans summoner_name.')
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }
  const limit = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : 150
  const effectiveLimit = Number.isNaN(limit) || limit < 1 ? 150 : limit

  await writeProgress(SCRIPT_ID, {
    phase: 'enrich',
    metrics: { participantsMissingData: missingCount },
  })
  const { enriched } = await enrichPlayers(effectiveLimit, {
    shouldStop: () => isStopRequested(SCRIPT_ID),
  })
  await writeProgress(SCRIPT_ID, {
    phase: 'done',
    metrics: { newPlayersAdded: enriched, participantsProcessed: missingCount },
  })
  await log.info(`Done. Enriched ${enriched} player(s).`)
  await clearProgressAndStopRequest(SCRIPT_ID)
  await log.end(0)
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
