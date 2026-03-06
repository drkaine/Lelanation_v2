import 'dotenv/config'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'

/**
 * One-off script: sync ranked emblems only, then copy to frontend.
 * Usage: cd backend && npx tsx src/scripts/syncRankedEmblemsOnce.ts
 */
async function main(): Promise<void> {
  console.log('[syncRankedEmblems] Starting...')
  const communityDragonService = new CommunityDragonService()
  const staticAssetsService = new StaticAssetsService()

  const result = await communityDragonService.syncRankedEmblems()
  if (result.isErr()) {
    console.error('[syncRankedEmblems] Failed:', result.unwrapErr())
    process.exitCode = 1
    return
  }

  const data = result.unwrap()
  console.log('[syncRankedEmblems] Synced:', data.synced, 'Failed:', data.failed)
  if (data.errors.length > 0) {
    data.errors.forEach(e => console.error('  ', e.file, e.error))
  }

  const copyResult = await staticAssetsService.copyCommunityDragonDataToFrontend()
  if (copyResult.isErr()) {
    console.error('[syncRankedEmblems] Copy to frontend failed:', copyResult.unwrapErr())
    process.exitCode = 1
    return
  }

  const { copied, deleted } = copyResult.unwrap()
  console.log('[syncRankedEmblems] Done. Copied:', copied, 'Deleted from backend:', deleted)
}

main()
