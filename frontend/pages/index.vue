<template>
  <div class="home-page text-center text-text">
    <!-- Hero + personnalisation (pleine largeur) -->
    <section
      class="home-hero home-section home-customize-section mb-2 w-full border-y border-primary/30 bg-surface/40 px-3 pb-0 pt-3 sm:px-5 sm:pt-4"
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
            class="inline-flex items-center rounded-lg border border-accent/70 bg-surface/60 px-5 py-2.5 text-sm font-semibold text-text transition hover:border-accent hover:bg-surface"
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
            class="inline-flex items-center gap-2 rounded-lg border border-accent/50 px-4 py-2.5 text-sm font-medium text-text/90 transition hover:border-accent hover:bg-surface/60"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon :name="link.icon" size="18px" />
            <span>{{ link.text }}</span>
          </a>
        </div>

        <h2 class="home-section-title mt-4 text-center text-lg font-bold sm:text-xl">
          {{ t('home.customizeTitle') }}
        </h2>
        <p class="home-section-subtitle mx-auto mt-1 max-w-3xl text-center text-xs sm:text-sm">
          {{ t('home.customizeSubtitle') }}
        </p>

        <div class="mt-2 grid w-full gap-3 pb-0 lg:grid-cols-2">
          <div class="rounded-lg border border-primary/20 bg-background/30 p-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-accent">
              {{ t('home.customizeCommandsTitle') }}
            </h3>
            <p class="mt-1 text-xs text-text/65">{{ t('home.customizeCommandsHint') }}</p>
            <ul class="mt-2 grid gap-2 sm:grid-cols-2">
              <li v-for="toggle in commandBarToggles" :key="toggle.id" class="min-w-0">
                <label
                  v-if="toggle.tag === 'label'"
                  class="command-toggle home-toolbar-toggle w-full justify-between gap-2"
                >
                  <input
                    type="checkbox"
                    class="command-toggle-checkbox"
                    :checked="toggle.active"
                    @change="toggle.onToggle()"
                  />
                  <span class="command-toggle-track shrink-0" :class="{ active: toggle.active }">
                    <span class="command-toggle-thumb" />
                  </span>
                  <span class="min-w-0 flex-1 truncate text-left text-xs">{{ toggle.label }}</span>
                  <kbd class="home-shortcut-kbd shrink-0">{{ toggle.keys }}</kbd>
                </label>
                <button
                  v-else
                  type="button"
                  class="command-toggle command-toggle-button home-toolbar-toggle w-full justify-between gap-2"
                  :aria-pressed="toggle.active"
                  @click="toggle.onToggle()"
                >
                  <span class="command-toggle-track shrink-0" :class="{ active: toggle.active }">
                    <span class="command-toggle-thumb" />
                  </span>
                  <span class="min-w-0 flex-1 truncate text-left text-xs">{{ toggle.label }}</span>
                  <kbd class="home-shortcut-kbd shrink-0">{{ toggle.keys }}</kbd>
                </button>
                <p class="mt-0.5 text-[11px] leading-snug text-text/55">{{ toggle.description }}</p>
              </li>
              <li v-for="shortcut in extraShortcuts" :key="shortcut.id" class="min-w-0">
                <button
                  v-if="shortcut.action"
                  type="button"
                  class="home-shortcut-row w-full text-left"
                  @click="shortcut.action()"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="min-w-0 flex-1 truncate text-xs text-text/90">{{
                      shortcut.label
                    }}</span>
                    <kbd class="home-shortcut-kbd shrink-0">{{ shortcut.keys }}</kbd>
                  </span>
                  <p class="mt-0.5 text-[11px] leading-snug text-text/55">
                    {{ shortcut.description }}
                  </p>
                </button>
                <div v-else class="home-shortcut-row">
                  <span class="flex items-center justify-between gap-2">
                    <span class="min-w-0 flex-1 truncate text-xs text-text/90">{{
                      shortcut.label
                    }}</span>
                    <kbd class="home-shortcut-kbd shrink-0">{{ shortcut.keys }}</kbd>
                  </span>
                  <p class="mt-0.5 text-[11px] leading-snug text-text/55">
                    {{ shortcut.description }}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div class="rounded-lg border border-primary/20 bg-background/30 p-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-accent">
              {{ t('home.customizeStatsTitle') }}
            </h3>
            <p class="mt-1 text-xs text-text/65">{{ t('home.customizeStatsText') }}</p>
            <ul class="mt-2 space-y-1 text-xs text-text/80">
              <li v-for="feature in customizeFeatures" :key="feature">• {{ feature }}</li>
            </ul>
            <NuxtLink
              :to="localePath('/statistics/settings')"
              class="mt-2 inline-flex items-center text-xs font-semibold text-accent hover:underline"
            >
              {{ t('home.customizeSettingsLink') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <div class="max-w-8xl mx-auto px-[10px] py-3">
      <!-- Recent builds -->
      <section class="home-section mb-3">
        <div class="home-section-header mb-2">
          <h2 class="home-section-title text-xl font-bold sm:text-2xl">
            {{ t('home.recentBuildsTitle') }}
          </h2>
          <p class="home-section-subtitle mt-1 text-sm">{{ t('home.recentBuildsSubtitle') }}</p>
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
          class="rounded-xl border border-primary/25 bg-surface/40 px-4 py-8 text-center text-sm text-text/70"
        >
          {{ t('home.noBuildsYet') }}
        </div>
        <BuildGrid
          v-else
          :custom-builds="recentBuilds"
          :show-comparison-buttons="false"
          :hide-bottom-actions="true"
          :show-all-custom-builds="true"
          :six-column-grid="true"
        />
      </section>

      <!-- Quick tier list -->
      <section class="home-section mb-3">
        <div class="home-section-header mb-2">
          <h2 class="home-section-title text-xl font-bold sm:text-2xl">
            {{ t('home.tierListTitle') }}
          </h2>
          <p class="home-section-subtitle mt-1 text-sm">
            {{
              t('home.tierListSubtitle', {
                patch: stats.patch,
                season: stats.season,
              })
            }}
          </p>
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
            class="rounded-xl border border-primary/25 bg-surface/50 p-3"
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
              <li v-for="row in roleBlock.champions" :key="`${roleBlock.role}-${row.championId}`">
                <NuxtLink
                  :to="
                    championStatsDetailPath(row.championId, localePath, championsStore.champions)
                  "
                  class="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-background/30"
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
                  <span
                    class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    :class="tierBadgeClass(row.tier)"
                  >
                    {{ row.tier }}
                  </span>
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="text-xs text-text/50">{{ t('home.tierNoData') }}</p>
          </div>
        </div>
      </section>

      <!-- Latest videos -->
      <section class="home-section mb-3">
        <div class="home-section-header mb-2">
          <h2 class="home-section-title text-xl font-bold sm:text-2xl">
            {{ t('home.latestVideosTitle') }}
          </h2>
          <p class="home-section-subtitle mt-1 text-sm">{{ t('home.latestVideosSubtitle') }}</p>
          <NuxtLink
            :to="localePath('/videos')"
            class="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
          >
            {{ t('home.allVideos') }}
          </NuxtLink>
        </div>
        <div
          v-if="latestVideos.length === 0"
          class="rounded-xl border border-primary/25 bg-surface/40 px-4 py-8 text-center text-sm text-text/70"
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
      </section>

      <!-- Companion app CTA -->
      <section
        class="home-section mb-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-surface/80 to-background/40 p-4 sm:p-5"
      >
        <h2 class="home-section-title text-xl font-bold sm:text-2xl">{{ t('home.appTitle') }}</h2>
        <p class="home-section-subtitle mx-auto mt-2 max-w-xl text-sm sm:text-base">
          {{ t('home.appSubtitle') }}
        </p>
        <ul class="mx-auto mt-4 max-w-md space-y-1 text-sm text-text/70">
          <li>• {{ t('lelanationApp.features.importBuilds') }}</li>
          <li>• {{ t('lelanationApp.features.localFavorites') }}</li>
          <li>• {{ t('lelanationApp.features.settings') }}</li>
        </ul>
        <div class="mt-4 flex flex-wrap justify-center gap-3">
          <NuxtLink
            :to="localePath('/app')"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-dark"
          >
            {{ t('home.appDownload') }}
          </NuxtLink>
        </div>
      </section>

      <!-- Contact -->
      <section
        class="home-section mb-3 rounded-2xl border border-primary/30 bg-surface/40 p-4 sm:p-5"
      >
        <div class="home-section-header mb-2">
          <h2 class="home-section-title text-xl font-bold sm:text-2xl">
            {{ t('home.contactTitle') }}
          </h2>
          <p class="home-section-subtitle mt-1 text-sm">{{ t('home.contactSubtitle') }}</p>
        </div>
        <div class="mx-auto max-w-2xl text-left">
          <ContactForm id-prefix="home-contact-" />
        </div>
      </section>

      <!-- Global stats -->
      <section class="home-section mb-3">
        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded-lg border border-primary/25 bg-surface/50 px-3 py-2 text-center">
            <p class="text-lg font-bold leading-tight text-accent">
              {{ formatStat(stats.builds) }}
            </p>
            <p class="mt-0.5 text-xs text-text/70">{{ t('home.statBuilds') }}</p>
          </div>
          <div class="rounded-lg border border-primary/25 bg-surface/50 px-3 py-2 text-center">
            <p class="text-lg font-bold leading-tight text-accent">
              {{ formatStat(stats.matches) }}
            </p>
            <p class="mt-0.5 text-xs text-text/70">
              {{ t('home.statPatchMatches', { patch: stats.patch }) }}
            </p>
          </div>
          <div class="rounded-lg border border-primary/25 bg-surface/50 px-3 py-2 text-center">
            <p class="text-lg font-bold leading-tight text-accent">
              {{ formatStat(stats.videos) }}
            </p>
            <p class="mt-0.5 text-xs text-text/70">{{ t('home.statVideos') }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { championStatsDetailPath } from '~/utils/championStatsRoutes'
import { useChampionsStore } from '~/stores/ChampionsStore'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import ContactForm from '~/components/Contact/ContactForm.vue'
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { usePageOgImage } from '~/composables/usePageOgImage'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { usePresentationZoom } from '~/composables/usePresentationZoom'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { useSimplifiedStatsPreference } from '~/composables/useSimplifiedStatsPreference'
import { useStatisticsSplitTransformPreference } from '~/composables/useStatisticsSplitTransformPreference'

const championsStore = useChampionsStore()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const { pending, recentBuilds, tierByRole, latestVideos, stats, championForId } = useHomePage()

const commandsModalOpen = useState<boolean>('commands-modal-open', () => false)

const { tooltipsDisabled, toggleTooltipsDisabled } = useTooltipsPreference()
const { isStreamerMode, toggleStreamerMode } = useStreamerMode()
const { isPresentationZoom, togglePresentationZoom } = usePresentationZoom()
const { championSplashEnabled, toggleChampionSplashEnabled } = useChampionSplashPreference()
const { simplifiedStatsEnabled, toggleSimplifiedStatsEnabled } = useSimplifiedStatsPreference()
const { statsSplitTransformEnabled, toggleStatsSplitTransformEnabled } =
  useStatisticsSplitTransformPreference()

type CommandBarToggleRow = {
  id: string
  tag: 'label' | 'button'
  label: string
  keys: string
  description: string
  active: boolean
  onToggle: () => void
}

const commandBarToggles = computed((): CommandBarToggleRow[] => [
  {
    id: 'tooltips',
    tag: 'label',
    label: t('nav.disableTooltips'),
    keys: 'Alt + T',
    description: t('home.customizeToolbarTooltips'),
    active: tooltipsDisabled.value,
    onToggle: () => toggleTooltipsDisabled(),
  },
  {
    id: 'streamer',
    tag: 'button',
    label: t('footer.presentationMode'),
    keys: 'Alt + P',
    description: t('home.customizeToolbarStreamer'),
    active: isStreamerMode.value,
    onToggle: () => toggleStreamerMode(),
  },
  {
    id: 'zoom',
    tag: 'button',
    label: t('commandBar.presentationZoom'),
    keys: 'Alt + Z',
    description: t('home.customizeToolbarZoom'),
    active: isPresentationZoom.value,
    onToggle: () => togglePresentationZoom(),
  },
  {
    id: 'splash',
    tag: 'button',
    label: t('commandBar.championSplash'),
    keys: 'Alt + S',
    description: t('home.customizeToolbarSplash'),
    active: championSplashEnabled.value,
    onToggle: () => toggleChampionSplashEnabled(),
  },
  {
    id: 'simplified',
    tag: 'button',
    label: t('commandBar.simplifiedStats'),
    keys: 'Alt + C',
    description: t('home.customizeToolbarSimplified'),
    active: simplifiedStatsEnabled.value,
    onToggle: () => toggleSimplifiedStatsEnabled(),
  },
  {
    id: 'split-transform',
    tag: 'button',
    label: t('commandBar.splitTransformStats'),
    keys: 'Shift + T',
    description: t('home.customizeToolbarSplitTransform'),
    active: statsSplitTransformEnabled.value,
    onToggle: () => toggleStatsSplitTransformEnabled(),
  },
])

type ExtraShortcutRow = {
  id: string
  keys: string
  label: string
  description: string
  action?: () => void
}

const extraShortcuts = computed((): ExtraShortcutRow[] => [
  {
    id: 'open-modal',
    keys: 'Alt + H',
    label: t('commandBar.openShortcutsModal'),
    description: t('home.customizeShortcutOpenModal'),
    action: () => openCommandsModal(),
  },
  {
    id: 'builder-prev',
    keys: 'Ctrl + ←',
    label: t('home.customizeShortcutBuilderPrev'),
    description: t('home.customizeShortcutBuilder'),
  },
  {
    id: 'builder-next',
    keys: 'Ctrl + →',
    label: t('home.customizeShortcutBuilderNext'),
    description: t('home.customizeShortcutBuilder'),
  },
  {
    id: 'show-bar',
    keys: 'Ctrl + ↓',
    label: t('commandBar.showBar'),
    description: t('home.customizeShortcutShowBar'),
  },
  {
    id: 'hide-bar',
    keys: 'Ctrl + ↑',
    label: t('commandBar.hideBar'),
    description: t('home.customizeShortcutHideBar'),
  },
])

const customizeFeatures = computed(() => [
  t('home.customizeFeatureTabs'),
  t('home.customizeFeatureDefaultTab'),
])

function openCommandsModal(): void {
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

function tierBadgeClass(tier: string): string {
  const tierLabel = tier.toUpperCase()
  if (tierLabel === 'S' || tierLabel === 'S+') return 'bg-amber-500/20 text-amber-300'
  if (tierLabel === 'A' || tierLabel === 'A+') return 'bg-green-500/15 text-green-300'
  if (tierLabel === 'B' || tierLabel === 'B+') return 'bg-sky-500/15 text-sky-200'
  return 'bg-surface text-text/70'
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toLocaleString(locale.value === 'en' ? 'en-US' : 'fr-FR')
}
</script>

<style scoped>
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
  color: rgb(251 191 36 / 0.75);
}

.home-shortcut-kbd {
  display: inline-block;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 6px;
  background: rgb(var(--rgb-accent) / 0.08);
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-blue-50);
  white-space: nowrap;
}

.home-toolbar-toggle {
  border-radius: 8px;
  padding: 5px 8px;
}

.home-shortcut-row {
  display: block;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 8px;
  padding: 5px 8px;
  background: rgb(var(--rgb-background) / 0.12);
}

button.home-shortcut-row {
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

button.home-shortcut-row:hover {
  border-color: rgb(var(--rgb-accent) / 0.45);
  background: rgb(var(--rgb-accent) / 0.08);
}
</style>
