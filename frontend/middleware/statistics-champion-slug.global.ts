import {
  championKeyFromRouteParam,
  championStatsSegment,
  isNumericChampionRouteParam,
} from '~/utils/championSlug'
import type { ChampionSlugRef } from '~/utils/championSlug'

async function loadChampionsForSlugRedirect(): Promise<ChampionSlugRef[]> {
  const store = useChampionsStore()
  if (store.champions.length > 0) {
    return store.champions.map(c => ({ id: c.id, key: c.key }))
  }
  await store.loadChampions('fr_FR').catch(() => undefined)
  if (store.champions.length > 0) {
    return store.champions.map(c => ({ id: c.id, key: c.key }))
  }
  try {
    const lite = await $fetch<{ champions?: ChampionSlugRef[] }>('/data/champions-lite.json')
    return lite.champions ?? []
  } catch {
    return []
  }
}

function championStatsPathMatch(path: string): { localePrefix: string; param: string } | null {
  const normalized = path.replace(/\/+$/, '') || '/'
  const enMatch = normalized.match(/^\/en\/statistics\/champion\/([^/]+)$/)
  if (enMatch) return { localePrefix: '/en', param: enMatch[1] ?? '' }
  const frMatch = normalized.match(/^\/statistics\/champion\/([^/]+)$/)
  if (frMatch) return { localePrefix: '', param: frMatch[1] ?? '' }
  return null
}

export default defineNuxtRouteMiddleware(async to => {
  const match = championStatsPathMatch(to.path)
  if (!match || !isNumericChampionRouteParam(match.param)) return

  const champions = await loadChampionsForSlugRedirect()

  const key = championKeyFromRouteParam(match.param, champions)
  if (!key) return

  const slug = championStatsSegment(key, champions)
  if (slug === match.param) return

  return navigateTo(`${match.localePrefix}/statistics/champion/${slug}`, { redirectCode: 301 })
})
