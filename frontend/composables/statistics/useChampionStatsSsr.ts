import type { Ref } from 'vue'
import { championKeyFromRouteParam } from '~/utils/championSlug'
import { getChampionIndexUrl, getVersionUrl } from '~/utils/staticDataUrl'

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
  const versionPayload = await requestFetch<{ currentVersion?: string }>(getVersionUrl())
  const version = String(versionPayload?.currentVersion ?? '16.12.1')
  const indexPayload = await requestFetch<{ champions?: ChampionIndexRow[] }>(
    getChampionIndexUrl(version, language)
  )
  return (indexPayload?.champions ?? []).map(row => ({
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
      const championName = champ?.name ?? null
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
