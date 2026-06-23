export type PurchaseOrderItemSlot = {
  games: number
  wins: number
}

export type PurchaseOrderItemsJson = Record<string, PurchaseOrderItemSlot>

/** JSON d'ordre d'achat pour une partie : chaque itemId reçoit +1 game et +wins. */
export function buildGameOrderItemsJson(
  itemIds: Iterable<number>,
  winCount: number,
): PurchaseOrderItemsJson {
  const out: PurchaseOrderItemsJson = {}
  for (const itemId of itemIds) {
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    out[String(itemId)] = { games: 1, wins: winCount }
  }
  return out
}

/** Item IDs éligibles triés par ordre d'achat (starters + légendaires). */
export function orderedEligibleItemIds(orderByItemId: Map<number, number>): number[] {
  return Array.from(orderByItemId.entries())
    .filter(([itemId, pos]) => Number.isFinite(itemId) && itemId > 0 && Number.isFinite(pos) && pos > 0)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(([itemId]) => itemId)
}

/** @deprecated Préférer `orderedEligibleItemIds` — conservé pour compat tests legacy. */
export function uniquePurchaseOrderPositions(orderByItemId: Map<number, number>): number[] {
  return orderedEligibleItemIds(orderByItemId)
}

/**
 * Expression SQL pour fusionner order_items à l'upsert (addition games/wins par itemId).
 * `columnRef` doit être qualifié (ex. champion_vs_stats.order_items).
 */
export function buildOrderItemsMergeSqlExpr(
  columnRef: string,
  itemIds: number[],
  winCount: number,
): string {
  let expr = `CASE
    WHEN jsonb_typeof(COALESCE(${columnRef}, '{}'::jsonb)) = 'object'
    THEN COALESCE(${columnRef}, '{}'::jsonb)
    ELSE '{}'::jsonb
  END`

  for (const itemId of itemIds) {
    const key = String(itemId)
    expr = `jsonb_set(
      ${expr},
      ARRAY['${key}']::text[],
      jsonb_build_object(
        'games',
        CASE
          WHEN jsonb_typeof(${columnRef}) = 'object'
          THEN COALESCE((${columnRef}->'${key}'->>'games')::bigint, 0) + 1
          ELSE 1
        END,
        'wins',
        CASE
          WHEN jsonb_typeof(${columnRef}) = 'object'
          THEN COALESCE((${columnRef}->'${key}'->>'wins')::bigint, 0) + ${winCount}
          ELSE ${winCount}
        END
      ),
      true
    )`
  }

  return expr
}
