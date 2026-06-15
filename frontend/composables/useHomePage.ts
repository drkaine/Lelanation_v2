import type { Build } from '@lelanation/shared-types'
import type { YouTubeVideo } from '~/types/youtube'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import { useVersionStore } from '~/stores/VersionStore'
import { apiUrl } from '~/utils/apiUrl'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'

export type HomeTierListRow = {
  rank: number
  championId: number
  tier: string
  mainRole: string
  winrate: number
  pickrate: number
}

export type HomeTierByRole = {
  role: string
  label: string
  icon: string
  champions: HomeTierListRow[]
}

const HOME_ROLES = [
  { role: 'TOP', labelKey: 'home.tierRoles.top', icon: '/icons/roles/top.png' },
  { role: 'JUNGLE', labelKey: 'home.tierRoles.jungle', icon: '/icons/roles/jungle.png' },
  { role: 'MIDDLE', labelKey: 'home.tierRoles.mid', icon: '/icons/roles/mid.png' },
  { role: 'BOTTOM', labelKey: 'home.tierRoles.adc', icon: '/icons/roles/bot.png' },
  { role: 'SUPPORT', labelKey: 'home.tierRoles.support', icon: '/icons/roles/support.png' },
] as const

function normalizeRole(role: string): string {
  const r = role.trim().toUpperCase()
  return r === 'UTILITY' ? 'SUPPORT' : r
}

function pickLatestVideo(videos: YouTubeVideo[]): YouTubeVideo | null {
  if (videos.length === 0) return null
  return [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )[0]!
}

async function loadVideosForHome(): Promise<YouTubeVideo[]> {
  if (import.meta.server) {
    const { listAllYouTubeVideosFromDisk, resolveFrontendRoot } =
      await import('~/utils/youtubeCatalog')
    return listAllYouTubeVideosFromDisk(resolveFrontendRoot())
  }
  const youtube = useYouTubeStore()
  await youtube.loadStatus()
  await youtube.loadAllChannelsData()
  const byId = new Map<string, YouTubeVideo>()
  for (const data of Object.values(youtube.channelDataById)) {
    for (const video of data?.videos ?? []) {
      if (video?.id) byId.set(video.id, video)
    }
  }
  return [...byId.values()]
}

export function useHomePage() {
  const { t, locale } = useI18n()
  const localePath = useLocalePath()
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || 'https://lelanation.fr')
  const versionStore = useVersionStore()
  const championsStore = useChampionsStore()

  const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))

  const { data: homeData, pending } = useAsyncData(
    () => `home-page-${locale.value}`,
    async () => {
      await versionStore.loadCurrentVersion()
      const patch = versionStore.currentVersion || '16.12.1'

      const [popularPayload, tierPayload, overviewPayload, videos] = await Promise.all([
        $fetch<{ totalBuilds: number; builds: unknown[] }>(
          apiUrl('/api/builds/popular?limit=6')
        ).catch(() => ({ totalBuilds: 0, builds: [] as unknown[] })),
        $fetch<{ patch?: string; rows?: HomeTierListRow[] }>(
          apiUrl(`/api/stats/tier-list?patch=${encodeURIComponent(patch)}&rankTier=all`)
        ).catch(() => ({ rows: [] as HomeTierListRow[] })),
        $fetch<{ playerCount?: number; totalMatches?: number }>(
          apiUrl(`/api/stats/overview?version=${encodeURIComponent(patch)}`)
        ).catch(() => ({ playerCount: 0, totalMatches: 0 })),
        loadVideosForHome().catch(() => [] as YouTubeVideo[]),
      ])

      await championsStore.loadChampions(riotLocale.value)

      const popularBuilds = (popularPayload.builds ?? [])
        .map(raw => (isStoredBuild(raw) ? hydrateBuild(raw) : (raw as Build)))
        .filter((b): b is Build => Boolean(b?.id))

      const tierRows = tierPayload.rows ?? []
      const tierByRole: HomeTierByRole[] = HOME_ROLES.map(def => {
        const champions = tierRows
          .filter(row => normalizeRole(row.mainRole) === def.role)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 5)
        return {
          role: def.role,
          label: t(def.labelKey),
          icon: def.icon,
          champions,
        }
      })

      return {
        patch: tierPayload.patch ?? patch,
        season: lolSeasonFromGameVersion(patch),
        popularBuilds,
        totalBuilds: popularPayload.totalBuilds ?? popularBuilds.length,
        tierByRole,
        playerCount: overviewPayload.playerCount ?? 0,
        totalMatches: overviewPayload.totalMatches ?? 0,
        videoCount: videos.length,
        latestVideo: pickLatestVideo(videos),
      }
    },
    { watch: [riotLocale] }
  )

  const popularBuilds = computed(() => homeData.value?.popularBuilds ?? [])
  const tierByRole = computed(() => homeData.value?.tierByRole ?? [])
  const latestVideo = computed(() => homeData.value?.latestVideo ?? null)
  const stats = computed(() => ({
    builds: homeData.value?.totalBuilds ?? 0,
    players: homeData.value?.playerCount ?? 0,
    videos: homeData.value?.videoCount ?? 0,
    patch: homeData.value?.patch ?? '',
    season: homeData.value?.season ?? lolSeasonFromGameVersion('16.12.1'),
  }))

  function championForId(championId: number) {
    return championsStore.champions.find(c => Number(c.key) === championId) ?? null
  }

  return {
    pending,
    popularBuilds,
    tierByRole,
    latestVideo,
    stats,
    localePath,
    siteUrl,
    t,
    championForId,
  }
}
