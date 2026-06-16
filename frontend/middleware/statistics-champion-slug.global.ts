import {
  championKeyFromRouteParam,
  championStatsSegment,
  isNumericChampionRouteParam,
} from '~/utils/championSlug'

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

  const championsStore = useChampionsStore()
  if (championsStore.champions.length === 0) {
    await championsStore.loadChampions('fr_FR').catch(() => undefined)
  }

  const key = championKeyFromRouteParam(match.param, championsStore.champions)
  if (!key) return

  const slug = championStatsSegment(key, championsStore.champions)
  if (slug === match.param) return

  return navigateTo(`${match.localePrefix}/statistics/champion/${slug}`, { redirectCode: 301 })
})
