/**
 * Delete matches by id or by game_version (e.g. old patches not in versions.json).
 * Participants are deleted by cascade.
 * Usage (from backend/):
 *   npm run riot:cleanup-matches -- --ids=346,347,348
 *   npm run riot:cleanup-matches -- --game-version=15.22.724.5161
 */
import 'dotenv/config'
import { prisma } from '../db.js'

function parseArgs(): { ids?: bigint[]; gameVersion?: string } {
  const args = process.argv.slice(2)
  let ids: bigint[] | undefined
  let gameVersion: string | undefined
  for (const arg of args) {
    if (arg.startsWith('--ids=')) {
      const raw = arg.slice('--ids='.length).trim()
      ids = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => BigInt(s))
    } else if (arg.startsWith('--game-version=')) {
      gameVersion = arg.slice('--game-version='.length).trim() || undefined
    }
  }
  return { ids, gameVersion }
}

async function main(): Promise<void> {
  const { ids, gameVersion } = parseArgs()
  if (!ids?.length && !gameVersion) {
    console.error('Usage: npm run riot:cleanup-matches -- --ids=346,347,348')
    console.error('   or: npm run riot:cleanup-matches -- --game-version=15.22.724.5161')
    process.exit(1)
  }

  if (ids?.length) {
    const deleted = await prisma.match.deleteMany({ where: { id: { in: ids } } })
    console.log(`[cleanup-matches] Deleted ${deleted.count} match(es) by id: ${ids.join(', ')}`)
  }
  if (gameVersion) {
    const deleted = await prisma.match.deleteMany({ where: { gameVersion } })
    console.log(`[cleanup-matches] Deleted ${deleted.count} match(es) with game_version=${gameVersion}`)
  }
  console.log('[cleanup-matches] Done.')
}

main().catch((err) => {
  console.error('[cleanup-matches]', err)
  process.exit(1)
})
