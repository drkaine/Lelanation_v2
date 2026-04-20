import 'dotenv/config'
import { prisma } from '../db.js'

type ScopedCheck = {
  name: string
  legacySql: string
  aggSql: string
}

const ALLOWED_ROLES_SQL = "'TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT'"

const CHECKS: ScopedCheck[] = [
  {
    name: 'mv_champion_core_stats -> agg_champion_core_stats',
    legacySql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM mv_champion_core_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
    aggSql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_core_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'mv_champion_vs_stats -> agg_champion_vs_stats',
    legacySql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM mv_champion_vs_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
    aggSql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_vs_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'mv_match_outcome_stats -> agg_match_outcome_stats',
    legacySql: `SELECT COALESCE(SUM(count_match), 0) AS v FROM mv_match_outcome_stats WHERE rank_tier <> 'UNRANKED'`,
    aggSql: `SELECT COALESCE(SUM(count_match), 0) AS v FROM agg_match_outcome_stats WHERE rank_tier <> 'UNRANKED'`,
  },
  {
    name: 'mv_team_core_stats -> agg_team_core_stats',
    legacySql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM mv_team_core_stats WHERE rank_tier <> 'UNRANKED'`,
    aggSql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_team_core_stats WHERE rank_tier <> 'UNRANKED'`,
  },
  {
    name: 'mv_champion_bans_by_banner -> agg_champion_bans_by_banner',
    legacySql: `SELECT COALESCE(SUM(ban_count), 0) AS v FROM mv_champion_bans_by_banner WHERE rank_tier <> 'UNRANKED' AND UPPER(banner_role_norm) IN (${ALLOWED_ROLES_SQL})`,
    aggSql: `SELECT COALESCE(SUM(ban_count), 0) AS v FROM agg_champion_bans_by_banner WHERE rank_tier <> 'UNRANKED' AND UPPER(banner_role_norm) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'mv_champion_side_stats -> agg_champion_side_stats',
    legacySql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM mv_champion_side_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role_norm) IN (${ALLOWED_ROLES_SQL})`,
    aggSql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_side_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role_norm) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'mv_team_bucket -> agg_team_bucket',
    legacySql: `SELECT COALESCE(SUM(tb.count_game), 0) AS v FROM mv_team_bucket tb INNER JOIN mv_team_core_stats tc ON tc.id = tb.team_stat_id WHERE tc.rank_tier <> 'UNRANKED'`,
    aggSql: `SELECT COALESCE(SUM(tb.count_game), 0) AS v FROM agg_team_bucket tb INNER JOIN agg_team_core_stats tc ON tc.id = tb.team_stat_id WHERE tc.rank_tier <> 'UNRANKED'`,
  },
]

async function scalar(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ v: bigint | number | null }>>(sql)
  const v = rows[0]?.v
  return Number(v ?? 0)
}

async function main(): Promise<void> {
  let ok = true
  for (const c of CHECKS) {
    const legacy = await scalar(c.legacySql)
    const agg = await scalar(c.aggSql)
    const ratio = legacy > 0 ? (agg / legacy) * 100 : 100
    const pass = legacy === 0 ? agg === 0 : ratio >= 95 && ratio <= 105
    if (!pass) ok = false
    console.log(
      `[verify-agg] ${c.name} | legacy=${legacy} agg=${agg} ratio=${ratio.toFixed(2)}% ${pass ? 'OK' : 'MISMATCH'}`
    )
  }
  if (!ok) {
    process.exitCode = 1
    throw new Error('aggregate parity check failed')
  }
}

void main()
  .catch((err) => {
    console.error('[verify-agg] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
