/**
 * Sanity totals on live `agg_*` tables (materialized views were removed).
 * Run: npm run script:verify-agg-parity
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const ALLOWED_ROLES_SQL = "'TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT'"

const CHECKS: { name: string; sql: string }[] = [
  {
    name: 'agg_champion_core_stats',
    sql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_core_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_vs_stats',
    sql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_vs_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_match_outcome_stats',
    sql: `SELECT COALESCE(SUM(count_match), 0) AS v FROM agg_match_outcome_stats WHERE rank_tier <> 'UNRANKED'`,
  },
  {
    name: 'agg_team_core_stats',
    sql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_team_core_stats WHERE rank_tier <> 'UNRANKED'`,
  },
  {
    name: 'agg_champion_bans_by_banner',
    sql: `SELECT COALESCE(SUM(ban_count), 0) AS v FROM agg_champion_bans_by_banner WHERE rank_tier <> 'UNRANKED' AND UPPER(banner_role_norm) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_side_stats',
    sql: `SELECT COALESCE(SUM(count_game), 0) AS v FROM agg_champion_side_stats WHERE rank_tier <> 'UNRANKED' AND UPPER(role_norm) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_team_bucket',
    sql: `SELECT COALESCE(SUM(tb.count_game), 0) AS v FROM agg_team_bucket tb INNER JOIN agg_team_core_stats tc ON tc.id = tb.team_stat_id WHERE tc.rank_tier <> 'UNRANKED'`,
  },
  {
    name: 'agg_champion_bucket',
    sql: `SELECT COALESCE(SUM(cb.count_game), 0) AS v FROM agg_champion_bucket cb INNER JOIN agg_champion_core_stats cc ON cc.id = cb.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_summoner_spells',
    sql: `SELECT COALESCE(SUM(ss.count_game), 0) AS v FROM agg_champion_summoner_spells ss INNER JOIN agg_champion_core_stats cc ON cc.id = ss.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_runes_stats',
    sql: `SELECT COALESCE(SUM(rs.count_game), 0) AS v FROM agg_champion_runes_stats rs INNER JOIN agg_champion_core_stats cc ON cc.id = rs.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_runes_solo_stats',
    sql: `SELECT COALESCE(SUM(rs.count_game), 0) AS v FROM agg_champion_runes_solo_stats rs INNER JOIN agg_champion_core_stats cc ON cc.id = rs.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_shard_solo_stats',
    sql: `SELECT COALESCE(SUM(ss.count_game), 0) AS v FROM agg_champion_shard_solo_stats ss INNER JOIN agg_champion_core_stats cc ON cc.id = ss.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_item_stats',
    sql: `SELECT COALESCE(SUM(isx.count_game), 0) AS v FROM agg_champion_item_stats isx INNER JOIN agg_champion_core_stats cc ON cc.id = isx.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_item_solo_stats',
    sql: `SELECT COALESCE(SUM(isx.count_game), 0) AS v FROM agg_champion_item_solo_stats isx INNER JOIN agg_champion_core_stats cc ON cc.id = isx.champion_stat_id WHERE cc.rank_tier <> 'UNRANKED' AND UPPER(cc.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_summoner_spell_pair_stats',
    sql: `SELECT COALESCE(SUM(s.count_game), 0) AS v FROM agg_champion_summoner_spell_pair_stats s WHERE s.rank_tier <> 'UNRANKED' AND UPPER(s.role) IN (${ALLOWED_ROLES_SQL})`,
  },
  {
    name: 'agg_champion_item_starter_set_stats',
    sql: `SELECT COALESCE(SUM(s.count_game), 0) AS v FROM agg_champion_item_starter_set_stats s WHERE s.rank_tier <> 'UNRANKED' AND UPPER(s.role_norm) IN (${ALLOWED_ROLES_SQL})`,
  },
]

async function scalar(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ v: bigint | number | null }>>(sql)
  const v = rows[0]?.v
  return Number(v ?? 0)
}

async function main(): Promise<void> {
  for (const c of CHECKS) {
    const v = await scalar(c.sql)
    console.log(`[verify-agg] ${c.name} total_count_game=${v}`)
  }
}

void main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
