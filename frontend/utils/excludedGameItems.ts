/** Item IDs excluded from selectors and stats (must stay in sync with backend config). */
export const ALWAYS_EXCLUDED_GAME_ITEM_IDS = new Set<string>([
  '8001', // Anathema's Chains
  '228001',
])

export function isExcludedGameItemId(itemId: string): boolean {
  return ALWAYS_EXCLUDED_GAME_ITEM_IDS.has(String(itemId))
}
