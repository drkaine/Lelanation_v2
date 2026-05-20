/**
 * Items that must never appear in build selectors or stats, even if Data Dragon
 * marks them purchasable or a stale item.json copy slipped through re-filtering.
 */
export const ALWAYS_EXCLUDED_GAME_ITEM_IDS = new Set<string>([
  '8001', // Anathema's Chains (Summoner's Rift)
  '228001', // Anathema's Chains duplicate / non-SR variant
])

export function isAlwaysExcludedGameItemId(itemId: string): boolean {
  return ALWAYS_EXCLUDED_GAME_ITEM_IDS.has(String(itemId))
}
