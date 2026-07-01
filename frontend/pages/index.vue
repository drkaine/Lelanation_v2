<template>
  <div class="home-page text-center text-text">
    <!-- Hero (pleine largeur) -->
    <section
      class="home-hero home-section mb-2 w-full border-y border-primary/30 bg-surface/40 px-3 pb-3 pt-3 sm:px-5 sm:pt-4"
    >
      <div class="mx-auto w-full max-w-[1600px]">
        <h1 class="text-2xl font-bold leading-tight text-text-accent sm:text-3xl lg:text-4xl">
          {{ t('home.heroTitle') }}
        </h1>
        <p class="mx-auto mt-2 max-w-2xl text-sm text-text/80 sm:text-base">
          {{ t('home.heroSubtitle') }}
        </p>
        <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
          <NuxtLink
            :to="localePath('/builds/create')"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dark"
          >
            {{ t('home.ctaCreateBuild') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/builds/discover')"
            class="ui-build-card-button inline-flex items-center px-5 py-2.5 text-sm font-semibold transition"
          >
            {{ t('home.ctaDiscoverBuilds') }}
          </NuxtLink>
        </div>

        <p class="home-section-eyebrow mb-1.5 mt-4 text-center">
          {{ t('home.followUs') }}
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <a
            v-for="link in socialLinks"
            :key="link.href"
            class="ui-build-card-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon :name="link.icon" size="18px" />
            <span>{{ link.text }}</span>
          </a>
        </div>
      </div>
    </section>

    <template v-for="item in homeRenderItems" :key="homeRenderItemKey(item)">
      <section
        v-if="item.kind === 'appContact'"
        class="home-section home-section--app-contact mb-2 w-full"
      >
        <div class="home-section-inner">
          <div class="grid gap-3 lg:grid-cols-2 lg:items-stretch">
            <div
              v-for="sectionId in item.order"
              :key="sectionId"
              :class="homeAppContactCardClass(sectionId)"
            >
              <HomeAppContactCardContent :section="sectionId" />
            </div>
          </div>
        </div>
      </section>

      <section v-else :class="homeSectionClass(item.id)">
        <template v-if="item.id === 'recentBuilds'">
          <div class="home-section-inner">
            <div class="home-section-header mb-2">
              <h2 class="home-section-title text-xl font-bold sm:text-2xl">
                {{ t('home.recentBuildsTitle') }}
              </h2>
              <NuxtLink
                :to="localePath('/builds/discover')"
                class="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
              >
                {{ t('home.seeAllBuilds') }}
              </NuxtLink>
            </div>
            <div v-if="pending" class="py-8 text-center text-sm text-text/60">
              {{ t('home.loading') }}
            </div>
            <div
              v-else-if="recentBuilds.length === 0"
              class="ui-build-card-surface rounded-xl px-4 py-8 text-center text-sm text-text/70"
            >
              {{ t('home.noBuildsYet') }}
            </div>
          </div>
          <div v-if="!pending && recentBuilds.length > 0" class="home-builds-grid-wrap">
            <BuildGrid
              :custom-builds="recentBuilds"
              :show-comparison-buttons="false"
              :hide-bottom-actions="true"
              :show-all-custom-builds="true"
            />
          </div>
        </template>
        <div v-else class="home-section-inner">
          <div
            v-if="item.id === 'customize'"
            class="home-customize-block flex w-full flex-col items-center text-center"
          >
            <h2 class="home-section-title text-lg font-bold sm:text-xl">
              {{ t('home.customizeTitle') }}
            </h2>

            <div class="ui-build-card-surface mt-3 w-full rounded-lg p-4 text-center sm:p-5">
              <div class="grid justify-items-center gap-6 sm:grid-cols-2 xl:grid-cols-3">
                <div class="w-full max-w-xs text-center sm:max-w-none">
                  <h3 class="text-xs font-bold uppercase tracking-wide text-accent">
                    {{ t('home.customizeDisplayTitle') }}
                  </h3>
                  <p class="mt-1 text-[11px] leading-snug text-text/55 sm:text-xs">
                    {{ t('home.customizeDisplayHint') }}
                  </p>
                  <ul class="mx-auto mt-2 inline-block space-y-1 text-left text-xs text-text/80">
                    <li v-for="feature in customizeDisplayFeatures" :key="feature">
                      • {{ feature }}
                    </li>
                  </ul>
                </div>

                <div class="w-full max-w-xs text-center sm:max-w-none">
                  <h3 class="text-xs font-bold uppercase tracking-wide text-accent">
                    {{ t('home.customizeStatsTitle') }}
                  </h3>
                  <p class="mt-1 text-[11px] leading-snug text-text/55 sm:text-xs">
                    {{ t('home.customizeStatsHint') }}
                  </p>
                  <ul class="mx-auto mt-2 inline-block space-y-1 text-left text-xs text-text/80">
                    <li v-for="feature in customizeStatsFeatures" :key="feature">
                      • {{ feature }}
                    </li>
                  </ul>
                </div>

                <div class="w-full max-w-xs text-center sm:col-span-2 sm:max-w-none xl:col-span-1">
                  <h3 class="text-xs font-bold uppercase tracking-wide text-accent">
                    {{ t('home.dataTransferTitle') }}
                  </h3>
                  <p class="mt-1 text-[11px] leading-snug text-text/55 sm:text-xs">
                    {{ t('home.dataTransferHint') }}
                  </p>
                  <p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-text/80">
                    {{ t('home.dataTransferDescription') }}
                  </p>
                  <NuxtLink
                    :to="localePath('/settings?tab=dataTransfer')"
                    class="mt-3 inline-flex items-center text-xs font-semibold text-accent hover:underline"
                  >
                    {{ t('home.dataTransferLink') }}
                  </NuxtLink>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  class="ui-build-card-button inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition"
                  @click="openCustomizePanel()"
                >
                  {{ t('home.customizeOpenPanel') }}
                  <kbd class="home-shortcut-kbd">Alt + H</kbd>
                </button>
                <NuxtLink
                  :to="localePath('/settings')"
                  class="ui-build-card-button inline-flex items-center px-3 py-1.5 text-xs font-semibold transition"
                >
                  {{ t('home.customizeSettingsLink') }}
                </NuxtLink>
              </div>
            </div>
          </div>

          <template v-if="item.id === 'tierList'">
            <div class="home-section-header mb-2">
              <h2 class="home-section-title text-xl font-bold sm:text-2xl">
                {{ t('home.tierListTitle') }}
              </h2>
              <NuxtLink
                :to="localePath('/statistics/tier-list')"
                class="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
              >
                {{ t('home.fullTierList') }}
              </NuxtLink>
            </div>
            <div class="grid gap-4 text-left lg:grid-cols-5">
              <div
                v-for="roleBlock in tierByRole"
                :key="roleBlock.role"
                class="home-tier-role-card p-3"
              >
                <div class="mb-3 flex items-center gap-2 border-b border-primary/15 pb-2">
                  <img
                    :src="roleBlock.icon"
                    :alt="roleBlock.label"
                    width="20"
                    height="20"
                    class="h-5 w-5"
                  />
                  <h3 class="text-sm font-bold text-text">{{ roleBlock.label }}</h3>
                </div>
                <ul v-if="roleBlock.champions.length" class="space-y-2">
                  <li
                    v-for="row in roleBlock.champions"
                    :key="`${roleBlock.role}-${row.championId}`"
                  >
                    <NuxtLink
                      :to="
                        championStatsDetailPath(
                          row.championId,
                          localePath,
                          championsStore.champions
                        )
                      "
                      class="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-black/20"
                    >
                      <img
                        v-if="tierChampionImage(row)"
                        :src="tierChampionImage(row)"
                        :alt="tierChampionName(row)"
                        width="28"
                        height="28"
                        class="h-7 w-7 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                      <span class="min-w-0 flex-1 truncate text-xs font-medium text-text">
                        {{ tierChampionName(row) }}
                      </span>
                      <span class="shrink-0" :class="uiStatisticsTierBadgeClass(row.tier)">
                        {{ homeTierLabel(row.tier) }}
                      </span>
                    </NuxtLink>
                  </li>
                </ul>
                <p v-else class="text-xs text-text/50">{{ t('home.tierNoData') }}</p>
              </div>
            </div>
          </template>

          <template v-if="item.id === 'latestVideos'">
            <div class="home-section-header mb-2">
              <h2 class="home-section-title text-xl font-bold sm:text-2xl">
                {{ t('home.latestVideosTitle') }}
              </h2>
              <NuxtLink
                :to="localePath('/videos')"
                class="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
              >
                {{ t('home.allVideos') }}
              </NuxtLink>
            </div>
            <div
              v-if="latestVideos.length === 0"
              class="ui-build-card-surface rounded-xl px-4 py-8 text-center text-sm text-text/70"
            >
              {{ t('home.noVideosYet') }}
            </div>
            <div v-else class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <VideoGridCard
                v-for="(video, index) in latestVideos"
                :key="video.id"
                :video="video"
                compact
                :fetch-priority="index === 0 ? 'high' : undefined"
              />
            </div>
          </template>

          <template v-if="item.id === 'app' || item.id === 'contact'">
            <HomeAppContactCardContent :section="item.id" />
          </template>

          <div v-if="item.id === 'globalStats'" class="grid gap-2 sm:grid-cols-3">
            <div class="ui-build-card-surface rounded-lg px-3 py-2 text-center">
              <p class="text-lg font-bold leading-tight text-accent">
                {{ formatStat(stats.builds) }}
              </p>
              <p class="mt-0.5 text-xs text-text/70">{{ t('home.statBuilds') }}</p>
            </div>
            <div class="ui-build-card-surface rounded-lg px-3 py-2 text-center">
              <p class="text-lg font-bold leading-tight text-accent">
                {{ formatStat(stats.matches) }}
              </p>
              <p class="mt-0.5 text-xs text-text/70">
                {{ t('home.statPatchMatches', { patch: stats.patch }) }}
              </p>
            </div>
            <div class="ui-build-card-surface rounded-lg px-3 py-2 text-center">
              <p class="text-lg font-bold leading-tight text-accent">
                {{ formatStat(stats.videos) }}
              </p>
              <p class="mt-0.5 text-xs text-text/70">{{ t('home.statVideos') }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { championStatsDetailPath } from '~/utils/championStatsRoutes'
import { useChampionsStore } from '~/stores/ChampionsStore'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import HomeAppContactCardContent from '~/components/home/HomeAppContactCardContent.vue'
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { usePageOgImage } from '~/composables/usePageOgImage'
import { uiStatisticsTierBadgeClass } from '~/utils/uiColorClasses'
import { useHomeUiStore, type HomeSectionId } from '~/stores/HomeUiStore'

const championsStore = useChampionsStore()
const homeUiStore = useHomeUiStore()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { pending, recentBuilds, tierByRole, latestVideos, stats, championForId } = useHomePage()

const visibleHomeSections = computed(() => homeUiStore.visibleSections)

type HomeRenderItem =
  | { kind: 'section'; id: HomeSectionId }
  | { kind: 'appContact'; order: ['app', 'contact'] | ['contact', 'app'] }

const homeRenderItems = computed((): HomeRenderItem[] => {
  const sections = visibleHomeSections.value
  const showApp = sections.includes('app')
  const showContact = sections.includes('contact')
  const pairAppContact = showApp && showContact
  const pairedHandled = { app: false, contact: false }
  const items: HomeRenderItem[] = []

  for (const id of sections) {
    if (id === 'app' || id === 'contact') {
      if (!pairAppContact) {
        items.push({ kind: 'section', id })
        continue
      }
      if (pairedHandled.app || pairedHandled.contact) continue

      const appIndex = sections.indexOf('app')
      const contactIndex = sections.indexOf('contact')
      items.push({
        kind: 'appContact',
        order: appIndex < contactIndex ? ['app', 'contact'] : ['contact', 'app'],
      })
      pairedHandled.app = true
      pairedHandled.contact = true
      continue
    }
    items.push({ kind: 'section', id })
  }

  return items
})

function homeRenderItemKey(item: HomeRenderItem): string {
  return item.kind === 'appContact' ? `app-contact-${item.order.join('-')}` : item.id
}

function homeAppContactCardClass(_sectionId: 'app' | 'contact'): string[] {
  return [
    'ui-build-card-surface',
    'flex',
    'h-full',
    'flex-col',
    'rounded-2xl',
    'p-4',
    'sm:p-5',
    'text-center',
  ]
}

function homeSectionClass(sectionId: HomeSectionId): string[] {
  const base = ['home-section', 'mb-2', 'w-full']
  switch (sectionId) {
    case 'customize':
      return [...base, 'home-customize-section', 'border-y', 'border-primary/30', 'bg-surface/40']
    case 'recentBuilds':
      return [...base, 'home-section--builds', 'border-y', 'border-primary/30', 'bg-surface/40']
    case 'tierList':
      return [...base, 'home-section--tier-list', 'border-y', 'border-primary/30', 'bg-surface/40']
    case 'latestVideos':
      return [...base, 'home-section--videos', 'border-y', 'border-primary/30', 'bg-surface/40']
    case 'globalStats':
      return [...base, 'home-section--stats', 'border-y', 'border-primary/30', 'bg-surface/40']
    case 'app':
      return [...base, 'ui-build-card-surface', 'rounded-2xl', 'p-4', 'sm:p-5']
    case 'contact':
      return [...base, 'ui-build-card-surface', 'rounded-2xl', 'p-4', 'sm:p-5']
    default:
      return base
  }
}

const commandsModalOpen = useState<boolean>('commands-modal-open', () => false)

const customizeDisplayFeatures = computed(() => [
  t('home.customizeFeatureTooltips'),
  t('home.customizeFeatureStreamer'),
  t('home.customizeFeatureZoom'),
  t('home.customizeFeatureSplash'),
  t('home.customizeFeatureSimplified'),
  t('home.customizeFeatureSplitTransform'),
])

const customizeStatsFeatures = computed(() => [
  t('home.customizeFeatureTabs'),
  t('home.customizeFeatureDefaultTab'),
  t('home.customizeFeatureWatchlist'),
  t('home.customizeFeatureAlerts'),
])

function openCustomizePanel(): void {
  commandsModalOpen.value = true
}

useHead({
  title: () => t('seo.homeTitle'),
  meta: [{ name: 'description', content: () => t('seo.homeDescription') }],
})

useSeoMeta({
  ogTitle: () => t('seo.homeTitle'),
  ogDescription: () => t('seo.homeDescription'),
  ogType: 'website',
})
usePageOgImage({
  title: () => t('seo.homeTitle'),
  subtitle: () => t('seo.homeDescription'),
})

interface SocialLink {
  href: string
  icon: string
  text: string
}

const socialLinks = computed((): SocialLink[] => [
  { href: 'https://discord.gg/RrXCpsFGrw', icon: 'mdi:discord', text: t('home.links.discord') },
  {
    href: 'https://www.instagram.com/lelariva_fr/',
    icon: 'mdi:instagram',
    text: t('home.links.instagram'),
  },
  {
    href: 'https://www.facebook.com/lelariva/',
    icon: 'mdi:facebook',
    text: t('home.links.facebook'),
  },
  {
    href: 'https://www.patreon.com/Lelariva',
    icon: 'mdi:patreon',
    text: t('home.links.patreon'),
  },
  {
    href: 'https://www.youtube.com/@Lelariva_LoL/featured',
    icon: 'mdi:youtube',
    text: t('home.links.youtube'),
  },
  { href: 'https://www.twitch.tv/lelariva', icon: 'mdi:twitch', text: t('home.links.twitch') },
  { href: 'https://x.com/Lelariva_fr', icon: 'mdi:twitter', text: t('home.links.twitter') },
  {
    href: 'https://www.tiktok.com/@lelariva_fr',
    icon: 'mdi:music-note',
    text: t('home.links.tiktok'),
  },
  { href: 'https://www.lelariva.fr/', icon: 'mdi:web', text: t('home.links.website') },
])

function tierChampionName(row: { championId: number; championName?: string }): string {
  return row.championName ?? championForId(row.championId)?.name ?? '—'
}

function tierChampionImage(row: { championId: number; championImage?: string }): string {
  const imageName = row.championImage ?? championForId(row.championId)?.image?.full
  if (!imageName) return ''
  return getChampionImageUrl('latest', imageName)
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toLocaleString(locale.value === 'en' ? 'en-US' : 'fr-FR')
}

function homeTierLabel(tier: string): string {
  if (tier === 'D' || tier === 'F') return t('statisticsPage.tierF')
  const labels: Record<string, string> = {
    'S+': t('statisticsPage.tierS+'),
    S: t('statisticsPage.tierS'),
    A: t('statisticsPage.tierA'),
    B: t('statisticsPage.tierB'),
    C: t('statisticsPage.tierC'),
  }
  return labels[tier] ?? tier
}
</script>

<style scoped>
.home-page {
  width: 100%;
}

.home-section-inner {
  width: 100%;
  max-width: 1600px;
  margin-inline: auto;
  padding: 0.75rem 10px;
}

@media (min-width: 640px) {
  .home-section-inner {
    padding-inline: 1.25rem;
  }
}

.home-section--builds {
  width: 100%;
  min-width: 0;
  text-align: left;
}

/* Même conteneur horizontal que builds-page (px-[10px], pleine largeur) */
.home-builds-grid-wrap {
  width: 100%;
  padding-inline: 10px;
  box-sizing: border-box;
}

.home-section-title {
  color: var(--color-gold-300);
}

.home-section-subtitle {
  color: rgb(125 211 252 / 0.88);
}

.home-section-eyebrow {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

.home-shortcut-kbd {
  display: inline-block;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 6px;
  background: rgb(0 0 0 / 0.25);
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-gold-300);
  white-space: nowrap;
}

.home-tier-role-card {
  --card-border-gradient-strong: var(--card-border-gradient-default-strong);
  border: 2px solid transparent;
  border-radius: 0.75rem;
  background-image:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)),
    var(--card-border-gradient-strong);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.5);
}
</style>
