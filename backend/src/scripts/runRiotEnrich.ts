/**
 * One-off script to enrich players missing summoner_name (Riot ID via Account-V1).
 * Loads backend/.env first so it works whether run from backend/ or project root.
 * Usage: npm run riot:enrich (from backend/) or cd backend && npx tsx src/scripts/runRiotEnrich.ts
 * Optional: ENRICH_LIMIT=200 npm run riot:enrich
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

async function main(): Promise<void> {
  const { enrichPlayers } = await import('../services/StatsPlayersRefreshService.js')
  const limit = process.env.ENRICH_LIMIT ? parseInt(process.env.ENRICH_LIMIT, 10) : 150
  if (Number.isNaN(limit) || limit < 1) {
    console.error('[riot:enrich] Invalid ENRICH_LIMIT, using 150')
  }
  const effectiveLimit = Number.isNaN(limit) || limit < 1 ? 150 : limit
  const { enriched } = await enrichPlayers(effectiveLimit)
  console.log(`[riot:enrich] Done. Enriched ${enriched} player(s).`)
}

main().catch((err) => {
  console.error('[riot:enrich]', err)
  process.exit(1)
})
