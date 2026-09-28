/** Role SQL of the item daily snapshot charts (role bucket columns of `item_tier_daily_snapshots`). */
import { itemTierRoleBucket, type ItemTierRoleBucket } from '../parsers/itemTierDailySnapshotRole.js'

/** `champion_tier_daily_snapshots.role` of each item role bucket. */
const BUCKET_SNAPSHOT_ROLE: Record<ItemTierRoleBucket, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MIDDLE',
  adc: 'BOTTOM',
  support: 'UTILITY',
}

const bucketOf = (role: string | null | undefined) => (role ? itemTierRoleBucket(role) : null)

/** Role filter of the champion snapshot cohort (`TRUE` without a known role). */
export function itemCohortRoleFilter(role: string | null | undefined, alias: string): string {
  const bucket = bucketOf(role)
  return bucket ? `${alias}.role = '${BUCKET_SNAPSHOT_ROLE[bucket]}'` : 'TRUE'
}

/** Sum of the role bucket games / wins column, or of the total without role. */
export function itemRoleSum(role: string | null | undefined, alias: string, measure: 'games' | 'wins'): string {
  const bucket = bucketOf(role)
  const column = bucket ? `${bucket}_${measure === 'games' ? 'game' : 'win'}` : measure
  return `COALESCE(SUM(${alias}.${column}), 0)`
}
