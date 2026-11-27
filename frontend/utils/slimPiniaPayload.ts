/**
 * Catalogues statiques (items ~190 Ko, champions ~145 Ko, runes ~35 Ko) retirés du `__NUXT_DATA__` :
 * le client les recharge avant l'hydratation depuis `/data/game/<patch>/…` (cache HTTP immuable).
 */
export type SlimStoreId = 'items' | 'champions' | 'runes'

export const SLIM_STORES: ReadonlyArray<{ id: SlimStoreId; key: string }> = [
  { id: 'items', key: 'items' },
  { id: 'champions', key: 'champions' },
  { id: 'runes', key: 'runePaths' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function slimPiniaPayload(state: Record<string, unknown>): {
  state: Record<string, unknown>
  stripped: SlimStoreId[]
} {
  const slim: Record<string, unknown> = { ...state }
  const stripped: SlimStoreId[] = []
  for (const { id, key } of SLIM_STORES) {
    const store = state[id]
    if (!isRecord(store)) continue
    const list = store[key]
    if (!Array.isArray(list) || list.length === 0) continue
    const emptied: Record<string, unknown> = { ...store, [key]: [], status: 'idle', error: null }
    if ('loadedLanguage' in store) emptied.loadedLanguage = null
    slim[id] = emptied
    stripped.push(id)
  }
  return { state: slim, stripped }
}

export interface SlimMarker {
  lang: string
  stores: SlimStoreId[]
}

function isSlimStoreId(value: unknown): value is SlimStoreId {
  return SLIM_STORES.some(s => s.id === value)
}

/** Marque `payload.slimStores` posée au rendu serveur. */
export function readSlimMarker(value: unknown): SlimMarker | null {
  if (!isRecord(value) || typeof value.lang !== 'string' || !Array.isArray(value.stores))
    return null
  return { lang: value.lang, stores: value.stores.filter(isSlimStoreId) }
}
