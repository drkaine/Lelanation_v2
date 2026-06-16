import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { breadcrumbJsonLd, itemListJsonLd } from '~/utils/jsonLd'
import { useSiteUrl } from '~/composables/useSiteUrl'

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')

export function championBuildsPath(slug: string): string {
  return `/champion/${slug.toLowerCase()}/builds`
}

export function useChampionBuildsPage() {
  const route = useRoute()
  const discoveryStore = useBuildDiscoveryStore()
  const championsStore = useChampionsStore()
  const localePath = useLocalePath()
  const { locale, t } = useI18n()
  const siteUrl = useSiteUrl()
  const { version: gameVersion } = useGameVersion()

  const championSlug = computed(() => {
    const raw = route.params.slug ?? route.params.id
    return String(raw ?? '').toLowerCase()
  })

  const riotLocale = computed(() => getRiotLanguage(locale.value))
  const lolSeason = computed(() => lolSeasonFromGameVersion(gameVersion.value))
  const canonicalPath = computed(() => championBuildsPath(championSlug.value))

  const championRecord = computed(() =>
    championsStore.champions.find(
      c => c.id.toLowerCase() === championSlug.value || String(c.key) === championSlug.value
    )
  )

  const championName = computed(() => championRecord.value?.name || null)
  const championImageName = computed(() => championRecord.value?.image?.full ?? '')
  const championIconUrl = computed(() =>
    championImageName.value ? getChampionImageUrl(gameVersion.value, championImageName.value) : ''
  )

  const championBuilds = computed(() => discoveryStore.filteredBuilds)

  useAsyncData(
    () => `champion-builds-${championSlug.value}-${riotLocale.value}`,
    async () => {
      await Promise.all([
        discoveryStore.loadBuilds(),
        championsStore.loadChampions(riotLocale.value),
      ])
      discoveryStore.setSelectedChampion(championSlug.value)
      return true
    },
    { watch: [championSlug, riotLocale] }
  )

  useSeoMeta({
    title: () =>
      championName.value
        ? t('championBuildsPage.metaTitle', {
            champion: championName.value,
            season: lolSeason.value,
            patch: gameVersion.value,
          })
        : t('championBuildsPage.metaTitleFallback'),
    description: () =>
      championName.value
        ? t('championBuildsPage.metaDescription', {
            champion: championName.value,
            season: lolSeason.value,
            patch: gameVersion.value,
          })
        : t('championBuildsPage.metaDescriptionFallback'),
    ogType: 'website',
    ogUrl: () => canonicalPath.value,
  })

  useHead({
    link: computed(() => {
      if (!championIconUrl.value) return []
      return [
        {
          rel: 'preload',
          as: 'image',
          href: championIconUrl.value,
          fetchpriority: 'high',
        },
      ]
    }),
  })

  useJsonLdHead(
    'champion-builds-breadcrumb',
    computed(() => {
      if (!championName.value) return null
      return breadcrumbJsonLd(siteUrl, [
        { name: 'Lelanation', path: '/' },
        { name: t('buildsPage.discover'), path: '/builds/discover' },
        {
          name: t('championBuildsPage.breadcrumb', { champion: championName.value }),
          path: canonicalPath.value,
        },
      ])
    })
  )

  useJsonLdHead(
    'champion-builds-itemlist',
    computed(() => {
      if (!championName.value || championBuilds.value.length === 0) return null
      return itemListJsonLd(siteUrl, {
        name: t('championBuildsPage.heading', { champion: championName.value }),
        description: t('championBuildsPage.metaDescription', {
          champion: championName.value,
          season: lolSeason.value,
          patch: gameVersion.value,
        }),
        path: canonicalPath.value,
        items: championBuilds.value.slice(0, 30).map((build, index) => ({
          name: build.name || `${championName.value} build`,
          url: `/builds/${build.id}`,
          position: index + 1,
        })),
      })
    })
  )

  watch(locale, () => {
    championsStore.loadChampions(riotLocale.value)
  })

  return {
    championSlug,
    championName,
    championIconUrl,
    canonicalPath,
    localePath,
    t,
  }
}
