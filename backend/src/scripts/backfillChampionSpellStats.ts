/**
 * Reconstruit `champion_spell_stats` depuis participants (spell_history.order).
 * Utile après correction du filtre durée ou quand les agrégats spell sont obsolètes
 * (ex. ordres legacy 1-4-2-3 sans sum_timestamp_ms).
 *
 * Usage: DATABASE_URL=... tsx src/scripts/backfillChampionSpellStats.ts
 */
import { sql } from '../db/client.js'
import { loadIngestionPayloadFromNormalizedTables } from '../services/normalizedMatchLoader.js'
import { rehydrateParticipantRanksForIngestion } from '../services/matchIngestionPayload.js'
import { upsertSpellOrderStats } from '../workers/ingestion.worker.js'

async function listMatchIds(): Promise<string[]> {
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id FROM matchs ORDER BY created_at, riot_match_id
  `
  return rows.map(row => String(row.riot_match_id ?? '').trim()).filter(Boolean)
}

async function main(): Promise<void> {
  console.log('[backfill-spell-stats] truncating champion_spell_stats…')
  await sql`TRUNCATE champion_spell_stats`

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
      const hasSpellOrder = payload.participants.some(
        p => String(p.spellOrder ?? '').trim().length > 0
      )
      if (!hasSpellOrder) {
        skipped += 1
        continue
      }
      await sql.begin(async tx => {
        await upsertSpellOrderStats(tx, payload.participants)
      })
      upserted += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[backfill-spell-stats] failed matchId=${matchId} error=${message}`)
    }

    if (processed % 500 === 0 || processed === matchIds.length) {
      console.log(
        `[backfill-spell-stats] progress=${processed}/${matchIds.length} upserted=${upserted} skipped=${skipped} failed=${failed}`
      )
    }
  }

  console.log(
    `[backfill-spell-stats] done processed=${processed} upserted=${upserted} skipped=${skipped} failed=${failed}`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
