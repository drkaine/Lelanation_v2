import 'dotenv/config'
import { prisma } from '../db.js'
import { backfillItemStarterSetsFromRaw } from './backfillAggFromIngest.js'

async function main(): Promise<void> {
  console.log('[backfill-starter-set] start')
  await backfillItemStarterSetsFromRaw()
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM agg_champion_item_starter_set_stats
  `
  console.log(`[backfill-starter-set] done rows=${rows[0]?.c?.toString() ?? '0'}`)
}

void main()
  .catch((err) => {
    console.error('[backfill-starter-set] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
