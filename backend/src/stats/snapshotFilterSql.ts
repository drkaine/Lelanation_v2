import { toQueryStringArrayParam } from '../utils/statsFilters.js'

const sqlLiteral = (s: string) => s.replace(/'/g, "''")

/** League part of each requested tier (`GOLD_II` → `GOLD`). */
export function snapshotRankTiers(rankTier: string | string[] | null | undefined): string[] {
  return toQueryStringArrayParam(rankTier)
    .map((t) => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)
}

/** WHERE of the daily tier snapshot tables (unranked rows excluded when no tier is requested). */
export function snapshotFilterSql(options: {
  entity?: { column: string; id: number | null | undefined }
  rankTiers?: string[] | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  alias?: string
}): string {
  const a = options.alias ?? 's'
  const parts: string[] = ['1=1']
  const entityId = options.entity?.id
  if (entityId != null && Number.isFinite(entityId)) {
    parts.push(`${a}.${options.entity!.column} = ${entityId}`)
  }
  const tierExpr = `split_part(upper(trim(${a}.rank_tier::text)), '_', 1)`
  const tiers = snapshotRankTiers(options.rankTiers ?? [])
  if (tiers.length === 1) parts.push(`${tierExpr} = '${sqlLiteral(tiers[0]!)}'`)
  else if (tiers.length > 1) parts.push(`${tierExpr} IN (${tiers.map((t) => `'${sqlLiteral(t)}'`).join(', ')})`)
  else parts.push(`${tierExpr} <> 'UNRANKED'`)
  if (options.role) parts.push(`${a}.role::text = '${sqlLiteral(options.role.toUpperCase())}'`)
  if (options.fromDate) parts.push(`${a}.date_of_game >= '${sqlLiteral(options.fromDate)}'::date`)
  if (options.toDate) parts.push(`${a}.date_of_game <= '${sqlLiteral(options.toDate)}'::date`)
  return parts.join(' AND ')
}
