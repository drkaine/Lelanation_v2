import { prisma } from '../db.js'

type TableStat = { table_name: string; exists: boolean; row_count: bigint }

async function main(): Promise<void> {
  const confirm = String(process.env.INGEST_DECOMMISSION_CONFIRM ?? '').trim().toUpperCase()
  if (confirm !== 'DROP') {
    console.log(
      '[decommissionIngestTables] Dry-run mode. Set INGEST_DECOMMISSION_CONFIRM=DROP to execute drops.'
    )
  }

  const stats = await prisma.$queryRaw<TableStat[]>`
    WITH targets AS (
      SELECT unnest(ARRAY['ingest_match_players'::text, 'ingest_teams'::text, 'ingest_matchs'::text]) AS table_name
    )
    SELECT
      t.table_name,
      to_regclass(t.table_name) IS NOT NULL AS "exists",
      CASE
        WHEN to_regclass(t.table_name) IS NULL THEN 0::bigint
        WHEN t.table_name = 'ingest_match_players' THEN (SELECT COUNT(*)::bigint FROM ingest_match_players)
        WHEN t.table_name = 'ingest_teams' THEN (SELECT COUNT(*)::bigint FROM ingest_teams)
        ELSE (SELECT COUNT(*)::bigint FROM ingest_matchs)
      END AS row_count
    FROM targets t
  `

  for (const row of stats) {
    console.log(
      `[decommissionIngestTables] ${row.table_name}: exists=${row.exists} rows=${row.row_count.toString()}`
    )
  }

  if (confirm !== 'DROP') return

  await prisma.$executeRawUnsafe(`
    DROP TABLE IF EXISTS ingest_match_players;
    DROP TABLE IF EXISTS ingest_teams;
    DROP TABLE IF EXISTS ingest_matchs;
  `)
  console.log('[decommissionIngestTables] ingest_* tables dropped.')
}

main()
  .catch((err) => {
    console.error('[decommissionIngestTables] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
