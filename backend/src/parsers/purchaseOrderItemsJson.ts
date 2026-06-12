export type PurchaseOrderItemSlot = {
  games: number
  wins: number
}

export type PurchaseOrderItemsJson = Record<string, PurchaseOrderItemSlot>

/** JSON d'ordre d'achat pour une partie : chaque position reçoit +1 game et +wins. */
export function buildGameOrderItemsJson(
  orderPositions: Iterable<number>,
  winCount: number,
): PurchaseOrderItemsJson {
  const out: PurchaseOrderItemsJson = {}
  for (const pos of orderPositions) {
    if (!Number.isFinite(pos) || pos <= 0) continue
    out[String(pos)] = { games: 1, wins: winCount }
  }
  return out
}

/** Positions uniques triées à partir d'une map itemId → position. */
export function uniquePurchaseOrderPositions(orderByItemId: Map<number, number>): number[] {
  const positions = new Set<number>()
  for (const pos of orderByItemId.values()) {
    if (Number.isFinite(pos) && pos > 0) positions.add(pos)
  }
  return Array.from(positions).sort((a, b) => a - b)
}

/**
 * Expression SQL pour fusionner order_items à l'upsert (addition games/wins par position).
 * `columnRef` doit être qualifié (ex. champion_vs_stats.order_items).
 */
export function buildOrderItemsMergeSqlExpr(
  columnRef: string,
  positions: number[],
  winCount: number,
): string {
  let expr = `CASE
    WHEN jsonb_typeof(COALESCE(${columnRef}, '{}'::jsonb)) = 'object'
    THEN COALESCE(${columnRef}, '{}'::jsonb)
    ELSE '{}'::jsonb
  END`

  for (const pos of positions) {
    const key = String(pos)
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
