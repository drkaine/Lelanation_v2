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

/** Fusion en mémoire de deux JSON d'ordre d'achat : additionne games/wins par itemId. */
export function mergeOrderItemsJson(
  base: PurchaseOrderItemsJson,
  add: PurchaseOrderItemsJson,
): PurchaseOrderItemsJson {
  const out: PurchaseOrderItemsJson = {}
  for (const src of [base, add]) {
    for (const [itemId, slot] of Object.entries(src)) {
      const existing = out[itemId] ?? { games: 0, wins: 0 }
      out[itemId] = {
        games: existing.games + (Number(slot?.games) || 0),
        wins: existing.wins + (Number(slot?.wins) || 0),
      }
    }
  }
  return out
}

/**
 * Expression SQL générique pour fusionner order_items lors d'un upsert multi-lignes :
 * additionne games/wins par itemId entre la ligne existante (`targetRef`) et la ligne
 * entrante (`excludedRef`, ex. `EXCLUDED.order_items`). Contrairement à
 * `buildOrderItemsMergeSqlExpr`, elle ne dépend pas d'une liste d'items en dur, donc
 * une seule clause DO UPDATE convient à toutes les lignes d'un même statement.
 */
export function buildOrderItemsGenericMergeSqlExpr(targetRef: string, excludedRef: string): string {
  const target = `CASE WHEN jsonb_typeof(${targetRef}) = 'object' THEN ${targetRef} ELSE '{}'::jsonb END`
  const excluded = `CASE WHEN jsonb_typeof(${excludedRef}) = 'object' THEN ${excludedRef} ELSE '{}'::jsonb END`
  return `(
    SELECT COALESCE(
      jsonb_object_agg(
        merge_key,
        jsonb_build_object(
          'games',
          COALESCE(((${target}) -> merge_key ->> 'games')::bigint, 0)
            + COALESCE(((${excluded}) -> merge_key ->> 'games')::bigint, 0),
          'wins',
          COALESCE(((${target}) -> merge_key ->> 'wins')::bigint, 0)
            + COALESCE(((${excluded}) -> merge_key ->> 'wins')::bigint, 0)
        )
      ),
      '{}'::jsonb
    )
    FROM jsonb_object_keys((${target}) || (${excluded})) AS merge_key
  )`
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
