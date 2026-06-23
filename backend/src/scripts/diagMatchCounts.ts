/**
 * Compare matchs / match_aggregated vs match_outcome_stats (avec / sans UNRANKED).
 * Usage: npx tsx src/scripts/diagMatchCounts.ts
 */
import 'dotenv/config'
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js'
import { sqlAggUnionAllLiveAndArchives } from '../services/statsAggArchive.js'

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('DATABASE_URL non configurée')
    return
  }
  const moUnion = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')
  const patch = '16.10'
  const [pm, aggAll, aggNoUnr, aggUnr] = await Promise.all([
    queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM matchs WHERE patch LIKE '${patch}%'`
    ),
    queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS c FROM ${moUnion} WHERE mo.game_version LIKE '${patch}%'`
    ),
    queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS c FROM ${moUnion} WHERE mo.game_version LIKE '${patch}%' AND mo.rank_tier <> 'UNRANKED'`
    ),
    queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS c FROM ${moUnion} WHERE mo.game_version LIKE '${patch}%' AND mo.rank_tier = 'UNRANKED'`
    ),
  ])
  console.log({
    matchs: Number(pm[0]?.c ?? 0),
    outcome_all_tiers: Number(aggAll[0]?.c ?? 0),
    outcome_excl_unranked: Number(aggNoUnr[0]?.c ?? 0),
    outcome_unranked_only: Number(aggUnr[0]?.c ?? 0),
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
