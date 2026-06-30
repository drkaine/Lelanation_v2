import type { Ref } from 'vue'
import { championKeyFromRouteParam } from '~/utils/championSlug'
import { championNameFromMap, type ChampionNamesMap } from '~/composables/useChampionNames'
import { getChampionIndexUrl, getVersionUrl, fetchPublicJson } from '~/utils/staticDataUrl'

export type ChampionStatsSummary = {
  championId: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  banrate?: number
  byRole?: Record<string, { games: number; wins: number; winrate: number }>
  totalGames: number
  generatedAt: string | null
}

type ChampionIndexRow = { id: string; key: string | number; name?: string }

function defaultChampionStatsQuery(): string {
  const p = new URLSearchParams()
  p.set('otp', 'oui')
  const q = p.toString()
  return q ? `?${q}` : ''
}

type ChampionPageSsrPayload = {
  championId: number
  championName: string | null
  stats: ChampionStatsSummary | null
}

async function loadChampionIndexRows(
  requestFetch: typeof $fetch,
  language: string
): Promise<ChampionIndexRow[]> {
  try {
    const versionPayload = await fetchPublicJson<{ currentVersion?: string }>(getVersionUrl())
    const version = String(versionPayload?.currentVersion ?? '16.13.1')
    const indexPayload = await fetchPublicJson<{ champions?: ChampionIndexRow[] }>(
      getChampionIndexUrl(version, language)
    )
    const rows = indexPayload?.champions ?? []
    if (rows.length > 0) {
      return rows.map(row => ({
        id: String(row.id ?? ''),
        key: row.key ?? '',
        name: row.name,
      }))
    }
  } catch {
    // fall through to champions-lite.json
  }

  const lite = await requestFetch<{ champions?: ChampionIndexRow[] }>(
    '/data/champions-lite.json'
  ).catch(() => ({ champions: [] }))
  return (lite.champions ?? []).map(row => ({
    id: String(row.id ?? ''),
    key: row.key ?? '',
    name: row.name,
  }))
}

/** Champions index + stats API en un fetch SSR (slug résolu avant l’API). */
export function useChampionPageSsr(championSlug: Ref<string>, riotLocale: Ref<string>) {
  const requestFetch = useRequestFetch()

  return useAsyncData(
    () => `champion-page-ssr-${championSlug.value}-${riotLocale.value}`,
    async (): Promise<ChampionPageSsrPayload> => {
      const champions = await loadChampionIndexRows(requestFetch, riotLocale.value)
      const id = championKeyFromRouteParam(championSlug.value, champions)
      if (!id) {
        return { championId: 0, championName: null, stats: null }
      }
      const champ = champions.find(c => String(c.key) === String(id))
      let championName = champ?.name ?? null
      if (!championName) {
        const names = await requestFetch<ChampionNamesMap>('/data/champion-names.json').catch(
          () => ({}) as ChampionNamesMap
        )
        championName = championNameFromMap(names, id)
      }
      try {
        const stats = await requestFetch<ChampionStatsSummary>(
          `/api/stats/champions/${id}${defaultChampionStatsQuery()}`
        )
        return { championId: id, championName, stats }
      } catch {
        return { championId: id, championName, stats: null }
      }
    },
    { watch: [championSlug, riotLocale] }
  )
}
