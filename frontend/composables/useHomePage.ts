import type { Build } from '@lelanation/shared-types'
import type { YouTubeVideo } from '~/types/youtube'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'

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

export function useHomePage() {
  const { t, locale } = useI18n()
  const localePath = useLocalePath()
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || 'https://lelanation.fr')
  const versionStore = useVersionStore()
  const championsStore = useChampionsStore()
  const itemsStore = useItemsStore()
  const runesStore = useRunesStore()

  const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))

  const { data: homeData, pending } = useAsyncData(
    () => `home-page-${locale.value}`,
    async (): Promise<HomeBootstrapPayload & { recentBuilds: Build[] }> => {
      await versionStore.loadCurrentVersion()
      const bootstrap = await $fetch<HomeBootstrapPayload>('/home-data.json')

      const patch = bootstrap.patch || versionStore.currentVersion || '16.12.1'
      await Promise.all([
        championsStore.loadChampions(riotLocale.value),
        itemsStore.loadItems(riotLocale.value).catch(() => undefined),
        runesStore.loadRunes(riotLocale.value).catch(() => undefined),
      ])

      const recentBuilds = (bootstrap.recentBuilds ?? [])
        .map(normalizeHomeBuild)
        .filter((build): build is Build => build !== null)

      await ensureBuildChampionDetails(recentBuilds, riotLocale.value, championsStore)

      return {
        ...bootstrap,
        patch,
        season: bootstrap.season || lolSeasonFromGameVersion(patch),
        recentBuilds,
        totalBuilds: bootstrap.totalBuilds ?? recentBuilds.length,
      }
    },
    { watch: [riotLocale] }
  )

  const recentBuilds = computed(() => homeData.value?.recentBuilds ?? [])

  if (import.meta.client) {
    watch(
      [recentBuilds, riotLocale],
      ([builds, language]) => {
        ensureBuildChampionDetails(builds, language, championsStore).catch(() => {})
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
