export const STATS_STORE_CHUNK = 'statistics-store'

/** Stats store + per-route stats chunks. Do NOT lump all components/composables together. */
export function statsPageChunk(id: string): string | undefined {
  if (id.includes('/frontend/stores/') && id.includes('Statistics')) return STATS_STORE_CHUNK
  if (id.includes('/frontend/components/statistics/pages/StatisticsIndexPage')) {
    return 'page-stats-index'
  }
  if (id.includes('/frontend/components/statistics/pages/ChampionStatsPage')) {
    return 'page-stats-champion'
  }
  if (id.includes('/frontend/pages/statistics/')) {
    if (id.includes('/champion/')) return 'page-stats-champion-shell'
    if (id.includes('/statistics/index.')) return 'page-stats-index-shell'
    if (id.includes('/tier-list')) return 'page-stats-tier-list'
    if (id.includes('/settings')) return 'page-stats-settings'
    if (id.includes('/recap')) return 'page-stats-recap'
    if (id.includes('/item/')) return 'page-stats-item'
    return 'page-stats-misc'
  }
  return undefined
}

/**
 * Rollup pulls an unassigned dependency into the manual chunk of its importer: a module
 * used by two stats page chunks lands in one of them and the other imports it back
 * (circular chunk). Such modules go to a shared chunk instead, or to the stats store chunk
 * when the store uses them (otherwise store and shared chunk would import each other).
 */
export function createSharedStatsChunk(importersOf: (id: string) => readonly string[]) {
  const memo = new Map<string, Set<string>>()

  function pageChunksReaching(id: string, visiting: Set<string>): Set<string> {
    const cached = memo.get(id)
    if (cached) return cached
    const own = statsPageChunk(id)
    if (own) return new Set([own])
    const chunks = new Set<string>()
    visiting.add(id)
    for (const importer of importersOf(id)) {
      if (visiting.has(importer)) continue
      for (const chunk of pageChunksReaching(importer, visiting)) chunks.add(chunk)
    }
    visiting.delete(id)
    // Partial results inside a cycle are not cached.
    if (visiting.size === 0) memo.set(id, chunks)
    return chunks
  }

  return (id: string): string | undefined => {
    if (id.includes('/node_modules/') || !id.includes('/frontend/')) return undefined
    const chunks = pageChunksReaching(id, new Set())
    if (chunks.size < 2) return undefined
    return chunks.has(STATS_STORE_CHUNK) ? STATS_STORE_CHUNK : 'page-stats-shared'
  }
}
