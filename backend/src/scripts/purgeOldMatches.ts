import 'dotenv/config'
import { prisma } from '../db.js'

const MIN_MAJOR = 16
const MIN_MINOR = 1

async function main(): Promise<void> {
  const whereSql = `
    (
      CAST(split_part(game_version, '.', 1) AS int) < ${MIN_MAJOR}
      OR (
        CAST(split_part(game_version, '.', 1) AS int) = ${MIN_MAJOR}
        AND CAST(split_part(game_version, '.', 2) AS int) < ${MIN_MINOR}
      )
    )
  `

  const before = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*)::int AS c FROM matchs WHERE ${whereSql}`
  )
  const deleted = await prisma.$executeRawUnsafe(`DELETE FROM matchs WHERE ${whereSql}`)
  const after = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*)::int AS c FROM matchs WHERE ${whereSql}`
  )

  console.log(
    JSON.stringify({
      minAllowed: `${MIN_MAJOR}.${MIN_MINOR}`,
      before: before[0]?.c ?? 0,
      deleted,
      after: after[0]?.c ?? 0,
    })
  )
}

void main()
  .catch(err => {
    console.error('[purgeOldMatches] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

