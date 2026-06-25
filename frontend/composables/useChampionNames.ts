/** Static id → name map for SSR (tier list, JSON-LD) without versioned champion index. */
export type ChampionNamesMap = Record<string, string>

export function useChampionNames() {
  return useAsyncData<ChampionNamesMap>(
    'champ-names',
    () => $fetch<ChampionNamesMap>('/data/champion-names.json'),
    { default: () => ({}) }
  )
}

export function championNameFromMap(
  map: ChampionNamesMap | null | undefined,
  championId: number
): string | null {
  if (!map) return null
  return map[String(championId)] ?? null
}
