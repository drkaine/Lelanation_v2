import 'dotenv/config'
import { prisma } from '../db.js'

type CountRow = { c: bigint | number }

async function scalarCount(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  return Number(rows[0]?.c ?? 0)
}

async function main(): Promise<void> {
  const beforeMissingPuuidKey = await scalarCount(`
    SELECT COUNT(*)::bigint AS c
    FROM players
    WHERE puuid_key_version IS NULL OR BTRIM(puuid_key_version) = ''
  `)
  const beforeMissingRank = await scalarCount(`
    SELECT COUNT(*)::bigint AS c
    FROM players
    WHERE rank_tier IS NULL OR rank_tier = 'UNRANKED'
  `)

  const puuidKeyUpdated = await prisma.$executeRawUnsafe(`
    UPDATE players
    SET puuid_key_version = 'unknown'
    WHERE puuid_key_version IS NULL OR BTRIM(puuid_key_version) = ''
  `)

  const rankUpdated = await prisma.$executeRawUnsafe(`
    WITH ranked_rows AS (
      SELECT
        imp.player_id,
        imp.rank_tier,
        imp.rank_division,
        im.game_date,
        ROW_NUMBER() OVER (
          PARTITION BY imp.player_id
          ORDER BY COALESCE(im.game_date, NOW()) DESC, imp.id DESC
        ) AS rn
      FROM ingest_match_players imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      WHERE imp.rank_tier IS NOT NULL
        AND imp.rank_tier <> 'UNRANKED'
    ),
    latest_rank AS (
      SELECT player_id, rank_tier, rank_division, game_date
      FROM ranked_rows
      WHERE rn = 1
    )
    UPDATE players p
    SET
      rank_tier = lr.rank_tier,
      rank_division = lr.rank_division,
      rank_snapshot_game_date = COALESCE(lr.game_date, NOW())
    FROM latest_rank lr
    WHERE p.id = lr.player_id
      AND (p.rank_tier IS NULL OR p.rank_tier = 'UNRANKED')
  `)

  const afterMissingPuuidKey = await scalarCount(`
    SELECT COUNT(*)::bigint AS c
    FROM players
    WHERE puuid_key_version IS NULL OR BTRIM(puuid_key_version) = ''
  `)
  const afterMissingRank = await scalarCount(`
    SELECT COUNT(*)::bigint AS c
    FROM players
    WHERE rank_tier IS NULL OR rank_tier = 'UNRANKED'
  `)

  console.log('[repair-players] before missing puuid_key_version:', beforeMissingPuuidKey)
  console.log('[repair-players] before missing rank_tier:', beforeMissingRank)
  console.log('[repair-players] updated puuid_key_version rows:', puuidKeyUpdated)
  console.log('[repair-players] updated rank rows:', rankUpdated)
  console.log('[repair-players] after missing puuid_key_version:', afterMissingPuuidKey)
  console.log('[repair-players] after missing rank_tier:', afterMissingRank)
}

void main()
  .catch((err) => {
    console.error('[repair-players] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
