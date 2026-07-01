import type { Build } from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import type { YouTubeVideo } from '~/types/youtube'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'
import { useSiteUrl } from '~/composables/useSiteUrl'

export type HomeTierListRow = {
  rank: number
  championId: number
  championName?: string
  championImage?: string
  tier: string
  mainRole: string
  winrate?: number
  pickrate?: number
}

export type HomeTierByRole = {
  role: string
  label: string
  icon: string
  champions: HomeTierListRow[]
}

const HOME_ROLE_DEFS = [
  { role: 'TOP', labelKey: 'home.tierRoles.top', icon: '/icons/roles/top.png' },
  { role: 'JUNGLE', labelKey: 'home.tierRoles.jungle', icon: '/icons/roles/jungle.png' },
  { role: 'MIDDLE', labelKey: 'home.tierRoles.mid', icon: '/icons/roles/mid.png' },
  { role: 'BOTTOM', labelKey: 'home.tierRoles.adc', icon: '/icons/roles/bot.png' },
  { role: 'SUPPORT', labelKey: 'home.tierRoles.support', icon: '/icons/roles/support.png' },
] as const

type HomeBootstrapPayload = {
  patch: string
  season: string
  recentBuilds: unknown[]
  totalBuilds: number
  tierByRole: Array<{ role: string; champions: HomeTierListRow[] }>
  patchMatchCount: number
  videoCount: number
  latestVideos: YouTubeVideo[]
}

type HomePagePayload = HomeBootstrapPayload & { recentBuilds: Build[] }

function normalizeHomeBuild(raw: unknown): Build | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Build
  if (!candidate.id) return null
  // Builds from /api/builds/recent are already display-ready (item refs with images).
  return candidate
}

async function ensureBuildChampionDetails(
  builds: Build[],
  language: string,
  championsStore: ReturnType<typeof useChampionsStore>
) {
  if (builds.length === 0) return
  if (championsStore.champions.length === 0) {
    await championsStore.loadChampions(language)
  }
  const championIds = [
    ...new Set(
      builds
        .map(build => build.champion?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]
  await Promise.all(
    championIds.map(id => championsStore.loadChampionDetails(id, language).catch(() => undefined))
  )
}

async function prefetchHomeAssets(
  builds: Build[],
  language: string,
  stores: {
    champions: ReturnType<typeof useChampionsStore>
    items: ReturnType<typeof useItemsStore>
    runes: ReturnType<typeof useRunesStore>
  }
) {
  await Promise.all([
    stores.champions.loadChampions(language).catch(() => undefined),
    stores.items.loadItems(language).catch(() => undefined),
    stores.runes.loadRunes(language).catch(() => undefined),
  ])
  await ensureBuildChampionDetails(builds, language, stores.champions)
}

export function useHomePage() {
  const { t, locale } = useI18n()
  const localePath = useLocalePath()
  const siteUrl = useSiteUrl()
  const versionStore = useVersionStore()
  const championsStore = useChampionsStore()
  const itemsStore = useItemsStore()
  const runesStore = useRunesStore()

  const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))

  const { data: homeData, pending } = useAsyncData(
    () => `home-page-${locale.value}`,
    async (): Promise<HomePagePayload> => {
      const versionPromise = versionStore.currentVersion
        ? Promise.resolve()
        : versionStore.loadCurrentVersion().catch(() => undefined)

      const bootstrap = await $fetch<HomeBootstrapPayload>('/home-data.json')
      await versionPromise

      const patch = bootstrap.patch || versionStore.currentVersion || '16.12.1'
      const recentBuilds = (bootstrap.recentBuilds ?? [])
        .map(normalizeHomeBuild)
        .filter((build): build is Build => build !== null)

      // SSR: warm stores so build cards render with full assets.
      if (import.meta.server) {
        await prefetchHomeAssets(recentBuilds, riotLocale.value, {
          champions: championsStore,
          items: itemsStore,
          runes: runesStore,
        })
      }

      return {
        ...bootstrap,
        patch,
        season: bootstrap.season || lolSeasonFromGameVersion(patch),
        recentBuilds,
        totalBuilds: bootstrap.totalBuilds ?? recentBuilds.length,
      }
    },
    {
      watch: [riotLocale],
      lazy: true,
      getCachedData(key, nuxtApp) {
        const cached = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
        if (cached && typeof cached === 'object') {
          return cached as HomePagePayload
        }
      },
    }
  )

  const recentBuilds = computed(() => homeData.value?.recentBuilds ?? [])

  if (import.meta.client) {
    watch(
      [recentBuilds, riotLocale],
      ([builds, language]) => {
        if (!builds.length) return
        prefetchHomeAssets(builds, language, {
          champions: championsStore,
          items: itemsStore,
          runes: runesStore,
        }).catch(() => undefined)
      },
      { immediate: true }
    )
  }

  const tierByRole = computed((): HomeTierByRole[] => {
    const rowsByRole = homeData.value?.tierByRole ?? []
    return HOME_ROLE_DEFS.map(def => {
      const match = rowsByRole.find(row => row.role === def.role)
      return {
        role: def.role,
        label: t(def.labelKey),
        icon: def.icon,
        champions: match?.champions ?? [],
      }
    })
  })
  const latestVideos = computed(() => homeData.value?.latestVideos ?? [])
  const stats = computed(() => ({
    builds: homeData.value?.totalBuilds ?? 0,
    matches: homeData.value?.patchMatchCount ?? 0,
    videos: homeData.value?.videoCount ?? 0,
    patch: homeData.value?.patch ?? '',
    season: homeData.value?.season ?? lolSeasonFromGameVersion('16.12.1'),
  }))

  function championForId(championId: number) {
    return championsStore.champions.find(c => Number(c.key) === championId) ?? null
  }

  return {
    pending,
    recentBuilds,
    tierByRole,
    latestVideos,
    stats,
    localePath,
    siteUrl,
    t,
    championForId,
  }
}
