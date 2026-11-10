/**
 * Reconstruit `champion_item_set_stats` depuis participants (item_history).
 * Utile après correction des clés starter/core/final (itemSetKeysFromHistory) :
 * les anciennes lignes `final` contenaient tout l'historique d'achats.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/backfillChampionItemSetStats.ts
 */
import { sql } from '../db/client.js'
import { loadIngestionPayloadFromNormalizedTables } from '../services/normalizedMatchLoader.js'
import { rehydrateParticipantRanksForIngestion } from '../services/matchIngestionPayload.js'
import { upsertItemSetStats } from '../workers/ingestion.worker.js'

async function listMatchIds(): Promise<string[]> {
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id FROM matchs ORDER BY created_at, riot_match_id
  `
  return rows.map(row => String(row.riot_match_id ?? '').trim()).filter(Boolean)
}

async function main(): Promise<void> {
  console.log('[backfill-item-set-stats] truncating champion_item_set_stats…')
  await sql`TRUNCATE champion_item_set_stats`

  const matchIds = await listMatchIds()
  let processed = 0
  let upserted = 0
  let skipped = 0
  let failed = 0

  for (const matchId of matchIds) {
    processed += 1
    try {
      const payload = await loadIngestionPayloadFromNormalizedTables(matchId, { skipRankGate: true })
      if (!payload) {
        skipped += 1
        continue
      }
      await rehydrateParticipantRanksForIngestion(payload)
      const hasItems = payload.participants.some(p => p.items.length > 0)
      if (!hasItems) {
        skipped += 1
        continue
      }
      await sql.begin(async tx => {
        await upsertItemSetStats(tx, payload.participants)
      })
      upserted += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[backfill-item-set-stats] failed matchId=${matchId} error=${message}`)
    }

    if (processed % 500 === 0 || processed === matchIds.length) {
      console.log(
        `[backfill-item-set-stats] progress=${processed}/${matchIds.length} upserted=${upserted} skipped=${skipped} failed=${failed}`
      )
    }
  }

  console.log(
    `[backfill-item-set-stats] done processed=${processed} upserted=${upserted} skipped=${skipped} failed=${failed}`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
