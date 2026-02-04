/**
 * Recompute Match.rank (average rank of players) for all matches from participants.
 * Usage: npm run riot:refresh-match-ranks (from backend/)
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { refreshMatchRanks } from '../services/StatsPlayersRefreshService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

async function main(): Promise<void> {
  console.log('[riot:refresh-match-ranks] Refreshing Match.rank from participants...')
  const { matchesUpdated } = await refreshMatchRanks()
  console.log('[riot:refresh-match-ranks] Matches updated: %d', matchesUpdated)
  console.log('[riot:refresh-match-ranks] Done.')
}

main().catch((err) => {
  console.error('[riot:refresh-match-ranks]', err)
  process.exit(1)
})
