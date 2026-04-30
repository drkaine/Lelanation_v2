import 'dotenv/config'
import { prisma } from '../db.js'
import { backfillObjectiveOutcomeFromAgg } from './backfillAggFromIngest.js'

async function main(): Promise<void> {
  console.log('[backfill-objective-outcome] start')
  await backfillObjectiveOutcomeFromAgg()
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM agg_objective_outcome_stats
  `
  console.log(`[backfill-objective-outcome] done rows=${rows[0]?.c?.toString() ?? '0'}`)
}

void main()
  .catch((err) => {
    console.error(
      '[backfill-objective-outcome] failed:',
      err instanceof Error ? err.message : String(err)
    )
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
