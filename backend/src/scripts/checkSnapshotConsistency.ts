import 'dotenv/config'
import { prisma } from '../db.js'

function resolveSnapshotDate(): string {
  const raw = String(process.env.SNAPSHOT_DATE ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

async function main(): Promise<void> {
  const snapshotDate = resolveSnapshotDate()
  console.log(`[snapshot-check] date=${snapshotDate}`)

  const bounds = await prisma.$queryRaw<
    Array<{
      rank_tier: string
      role: string
      rows: bigint
      games_sum: bigint
      wins_sum: bigint
      pick_rate_sum: number
      weighted_ban_rate: number
      min_pick_rate: number
      max_pick_rate: number
      min_ban_rate: number
      max_ban_rate: number
    }>
  >`
    SELECT
      rank_tier,
      role,
      COUNT(*)::bigint AS rows,
      COALESCE(SUM(games), 0)::bigint AS games_sum,
      COALESCE(SUM(wins), 0)::bigint AS wins_sum,
      COALESCE(SUM(pick_rate_pct), 0)::double precision AS pick_rate_sum,
      CASE
        WHEN COALESCE(SUM(games), 0) > 0
          THEN COALESCE(SUM((ban_rate_pct::float8 * games::float8)) / SUM(games::float8), 0)::double precision
        ELSE 0::double precision
      END AS weighted_ban_rate,
      COALESCE(MIN(pick_rate_pct), 0)::double precision AS min_pick_rate,
      COALESCE(MAX(pick_rate_pct), 0)::double precision AS max_pick_rate,
      COALESCE(MIN(ban_rate_pct), 0)::double precision AS min_ban_rate,
      COALESCE(MAX(ban_rate_pct), 0)::double precision AS max_ban_rate
    FROM champion_tier_daily_snapshots
    WHERE date_of_game = ${snapshotDate}::date
    GROUP BY rank_tier, role
    ORDER BY rank_tier, role
  `

  if (bounds.length === 0) {
    console.log('[snapshot-check] no rows for requested date')
    return
  }

  let hasOutOfBounds = false
  for (const row of bounds) {
    const pickRateSum = Number(row.pick_rate_sum ?? 0)
    const weightedBanRate = Number(row.weighted_ban_rate ?? 0)
    const minPick = Number(row.min_pick_rate ?? 0)
    const maxPick = Number(row.max_pick_rate ?? 0)
    const minBan = Number(row.min_ban_rate ?? 0)
    const maxBan = Number(row.max_ban_rate ?? 0)
    const pickOk = pickRateSum >= 99.5 && pickRateSum <= 100.5
    const banOk = weightedBanRate >= 0 && weightedBanRate <= 100
    const boundsOk =
      minPick >= 0 &&
      maxPick <= 100 &&
      minBan >= 0 &&
      maxBan <= 100 &&
      Number(row.wins_sum ?? 0) <= Number(row.games_sum ?? 0)
    if (!pickOk || !banOk || !boundsOk) hasOutOfBounds = true
    console.log(
      `[snapshot-check] ${row.rank_tier}/${row.role} rows=${row.rows.toString()} games=${row.games_sum.toString()} wins=${row.wins_sum.toString()} pick_sum=${pickRateSum.toFixed(3)} weighted_ban=${weightedBanRate.toFixed(3)}`
    )
  }

  if (hasOutOfBounds) {
    throw new Error('snapshot consistency check failed (out-of-bounds values detected)')
  }
  console.log('[snapshot-check] OK')
}

void main()
  .catch((err) => {
    console.error('[snapshot-check] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
