/**
 * Diagnostic rapide : obtention histogramme vs match_count.
 * Usage: npx tsx src/scripts/diagObjectiveHistogram.ts
 */
import 'dotenv/config'
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js'

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('DATABASE_URL non configurée')
    return
  }
  const rows = await queryRawUnsafe<
    Array<{
      objective_type: string
      win_secured: bigint
      loss_secured: bigint
      regions: number
    }>
  >(`
    SELECT objective_type,
      SUM(CASE WHEN outcome = 'win' AND obj_count >= 1 THEN count_games ELSE 0 END)::bigint AS win_secured,
      SUM(CASE WHEN outcome = 'loss' AND obj_count >= 1 THEN count_games ELSE 0 END)::bigint AS loss_secured,
      COUNT(DISTINCT region)::int AS regions
    FROM objective_outcome_histogram
    WHERE (objective_type = 'dragon' AND type_drake = 'earth' AND is_soul = FALSE)
       OR objective_type = 'firstBlood'
      AND rank_tier <> 'UNRANKED'
    GROUP BY objective_type
  `)
  const mc = await queryRawUnsafe<Array<{ m: bigint }>>(`
    SELECT SUM(count_match)::bigint AS m
    FROM match_outcome_stats
    WHERE rank_tier <> 'UNRANKED'
  `)
  const byRegion = await queryRawUnsafe<
    Array<{ region: string; objective_type: string; games: bigint }>
  >(`
    SELECT region, objective_type, SUM(count_games)::bigint AS games
    FROM objective_outcome_histogram
    WHERE objective_type = 'dragon' AND type_drake = 'earth' AND is_soul = FALSE
      AND outcome = 'win'
      AND obj_count >= 1
      AND rank_tier <> 'UNRANKED'
    GROUP BY region, objective_type
    ORDER BY games DESC
    LIMIT 15
  `)
  const matchCount = Number(mc[0]?.m ?? 0)
  console.log({ matchCount, rows, byRegion })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
