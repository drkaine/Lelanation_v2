<template>
  <header role="banner" class="header-shell">
    <nav class="header">
      <div class="left-header">
        <LanguageSwitcher />
        <NuxtLink
          :to="localePath('/settings')"
          class="settings-nav-link"
          :class="{ 'is-active': isSettingsSectionActive }"
          :title="t('nav.settings')"
          :aria-label="t('nav.settings')"
        >
          <Icon name="mdi:cog-outline" size="20" />
        </NuxtLink>
        <NuxtLink :to="localePath('/')" class="link" :aria-label="t('nav.home')" prefetch>
          <span>Lelanation</span>
        </NuxtLink>
      </div>

      <div v-if="!isMobileViewport" class="center-header">
        <NuxtLink
          :to="localePath('/download')"
          class="companion-app-link version"
          :class="{ 'is-active': isCompanionAppActive }"
          :title="t('nav.companionApp')"
        >
          {{ t('nav.companionApp') }}
        </NuxtLink>
      </div>

      <div class="right-header-slot">
        <NuxtLink
          v-if="isMobileViewport && isAdminLoggedIn"
          :to="localePath('/admin')"
          :title="t('nav.admin')"
          class="version mobile-admin-link"
        >
          {{ t('nav.admin') }}
        </NuxtLink>

        <div v-if="!isMobileViewport" class="right-header">
          <div
            class="builds-menu"
            @mouseenter="isBuildsMenuOpen = true"
            @mouseleave="isBuildsMenuOpen = false"
          >
            <button
              type="button"
              class="builds-menu-trigger"
              :class="{
                'is-active': isBuildsSectionActive,
                'is-open': isBuildsMenuOpen,
              }"
              :aria-expanded="isBuildsMenuOpen"
              aria-haspopup="true"
              @click="isBuildsMenuOpen = !isBuildsMenuOpen"
            >
              <span>{{ t('nav.builds') }}</span>
              <span class="builds-menu-chevron" :class="{ 'is-open': isBuildsMenuOpen }">▾</span>
            </button>
            <div v-show="isBuildsMenuOpen" class="builds-menu-dropdown">
              <NuxtLink
                :to="localePath('/builds/create')"
                :title="t('buildsPage.createBuild')"
                class="builds-submenu-link"
                :prefetch="false"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.createBuild') }}
              </NuxtLink>
              <NuxtLink
                :to="discoverBuildsLink"
                :title="t('buildsPage.discover')"
                class="builds-submenu-link"
                :class="{ 'is-active': isDiscoverBuildsActive }"
                :prefetch="false"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.discover') }}
              </NuxtLink>
              <NuxtLink
                v-if="hasUserBuilds"
                :to="myBuildsLink"
                :title="t('buildsPage.myBuilds')"
                class="builds-submenu-link"
                :class="{ 'is-active': isMyBuildsActive }"
                :prefetch="false"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.myBuilds') }}
              </NuxtLink>
              <NuxtLink
                v-if="hasFavorites"
                :to="favoriteBuildsLink"
                :title="t('buildsPage.myFavorites')"
                class="builds-submenu-link"
                :class="{ 'is-active': isFavoriteBuildsActive }"
                :prefetch="false"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.myFavorites') }}
              </NuxtLink>
            </div>
          </div>
          <div
            class="builds-menu"
            @mouseenter="isGuidesMenuOpen = true"
            @mouseleave="isGuidesMenuOpen = false"
          >
            <button
              type="button"
              class="builds-menu-trigger"
              :class="{
                'is-active': isGuidesSectionActive,
                'is-open': isGuidesMenuOpen,
              }"
              :aria-expanded="isGuidesMenuOpen"
              aria-haspopup="true"
              @click="isGuidesMenuOpen = !isGuidesMenuOpen"
            >
              <span>{{ t('nav.guides') }}</span>
              <span class="builds-menu-chevron" :class="{ 'is-open': isGuidesMenuOpen }">▾</span>
            </button>
            <div v-show="isGuidesMenuOpen" class="builds-menu-dropdown">
              <NuxtLink
                :to="createGuideLink"
                :title="t('matchupGuidePage.createGuide')"
                class="builds-submenu-link"
                :class="{ 'is-active': isCreateGuideActive }"
                @click="closeGuidesMenu"
              >
                {{ t('matchupGuidePage.createGuide') }}
              </NuxtLink>
              <NuxtLink
                :to="discoverGuidesLink"
                :title="t('buildsPage.discover')"
                class="builds-submenu-link"
                :class="{ 'is-active': isDiscoverGuidesActive }"
                @click="closeGuidesMenu"
              >
                {{ t('buildsPage.discover') }}
              </NuxtLink>
              <NuxtLink
                v-if="hasMyGuides"
                :to="myGuidesLink"
                :title="t('matchupGuidePage.myGuides')"
                class="builds-submenu-link"
                :class="{ 'is-active': isMyGuidesActive }"
                @click="closeGuidesMenu"
              >
                {{ t('matchupGuidePage.myGuides') }}
              </NuxtLink>
              <NuxtLink
                v-if="hasFavoriteGuides"
                :to="favoriteGuidesLink"
                :title="t('buildsPage.myFavorites')"
                class="builds-submenu-link"
                :class="{ 'is-active': isFavoriteGuidesActive }"
                @click="closeGuidesMenu"
              >
                {{ t('buildsPage.myFavorites') }}
              </NuxtLink>
            </div>
          </div>
          <div
            class="builds-menu"
            @mouseenter="isStatisticsMenuOpen = true"
            @mouseleave="isStatisticsMenuOpen = false"
          >
            <button
              type="button"
              class="builds-menu-trigger"
              :class="{
                'is-active': isStatisticsSectionActive,
                'is-open': isStatisticsMenuOpen,
              }"
              :aria-expanded="isStatisticsMenuOpen"
              aria-haspopup="true"
              @click="isStatisticsMenuOpen = !isStatisticsMenuOpen"
            >
              <span>{{ t('nav.statistics') }}</span>
              <span
                v-if="surveillanceAlertCount > 0"
                class="nav-alert-badge"
                :title="t('nav.statisticsSurveillanceAlerts', { count: surveillanceAlertCount })"
              >
                {{ surveillanceAlertCount }}
              </span>
              <span class="builds-menu-chevron" :class="{ 'is-open': isStatisticsMenuOpen }"
                >▾</span
              >
            </button>
            <div v-show="isStatisticsMenuOpen" class="builds-menu-dropdown">
              <NuxtLink
                :to="statisticsTierListLink"
                :title="t('nav.tierList')"
                class="builds-submenu-link"
                :class="{ 'is-active': isStatisticsTierListActive }"
                @click="closeStatisticsMenu"
              >
                {{ t('nav.tierList') }}
              </NuxtLink>
              <NuxtLink
                :to="statisticsIndexLink"
                :title="t('nav.statisticsGeneral')"
                class="builds-submenu-link"
                :class="{ 'is-active': isStatisticsGeneralActive }"
                @click="closeStatisticsMenu"
              >
                {{ t('nav.statisticsGeneral') }}
              </NuxtLink>
              <NuxtLink
                :to="statisticsChampionsLink"
                :title="t('nav.statisticsChampions')"
                class="builds-submenu-link"
                :class="{ 'is-active': isStatisticsChampionsActive }"
                @click="closeStatisticsMenu"
              >
                {{ t('nav.statisticsChampions') }}
              </NuxtLink>
              <NuxtLink
                v-if="hasWatchedChampions"
                :to="statisticsSurveillanceLink"
                :title="t('nav.statisticsSurveillance')"
                class="builds-submenu-link"
                :class="{ 'is-active': isStatisticsSurveillanceActive }"
                @click="closeStatisticsMenu"
              >
                {{ t('nav.statisticsSurveillance') }}
                <span
                  v-if="surveillanceAlertCount > 0"
                  class="nav-alert-badge nav-alert-badge--sub"
                >
                  {{ surveillanceAlertCount }}
                </span>
              </NuxtLink>
            </div>
          </div>
          <NuxtLink :to="localePath('/videos')" :title="t('nav.videos')" class="version">
            {{ t('nav.videos') }}
          </NuxtLink>
          <NuxtLink
            :to="patchSummaryLink"
            :title="t('nav.patchSummary')"
            class="version"
            :class="{ 'is-active': isPatchNotesActive }"
          >
            {{ activePatchVersion }}
          </NuxtLink>
          <NuxtLink
            v-if="isAdminLoggedIn"
            :to="localePath('/admin')"
            :title="t('nav.admin')"
            class="version"
          >
            {{ t('nav.admin') }}
          </NuxtLink>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import { getFallbackGameVersion } from '~/config/version'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useMobileViewport } from '~/composables/useMobileViewport'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useMatchupGuideFavoritesStore } from '~/stores/MatchupGuideFavoritesStore'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useVersionStore } from '~/stores/VersionStore'
import { normalizePatchNotesVersion, usePatchNotesStore } from '~/stores/PatchNotesStore'
import { pickLatestPatchVersion } from '~/utils/patchVersion'

const isBuildsMenuOpen = ref(false)
const isGuidesMenuOpen = ref(false)
const isStatisticsMenuOpen = ref(false)
const { isMobileViewport } = useMobileViewport()
const { t } = useI18n()
const { isLoggedIn: isAdminLoggedIn, checkLoggedIn } = useAdminAuth()
const localePath = useLocalePath()
const route = useRoute()
const versionStore = useVersionStore()
const patchNotesStore = usePatchNotesStore()
const gameVersion = computed(() => versionStore.currentVersion || getFallbackGameVersion())
const discoverBuildsLink = computed(() => localePath('/builds/discover'))
const myBuildsLink = computed(() => localePath('/builds/my-builds'))
const favoriteBuildsLink = computed(() => localePath('/builds/favoris'))
const discoverGuidesLink = computed(() => localePath('/matchups/sheets/discover'))
const myGuidesLink = computed(() => localePath('/matchups/sheets/my-guides'))
const favoriteGuidesLink = computed(() => localePath('/matchups/sheets/favoris'))
const createGuideLink = computed(() => localePath('/matchups/sheets/create'))
const isGuidesSectionActive = computed(() => route.path.includes('/matchups/sheets'))
const currentGuidesTab = computed(() => {
  const path = route.path
  if (!path.includes('/matchups/sheets')) return null
  if (path.includes('/matchups/sheets/create')) return 'create'
  if (path.endsWith('/matchups/sheets/my-guides')) return 'my-guides'
  if (path.endsWith('/matchups/sheets/favoris')) return 'favoris'
  if (path.endsWith('/matchups/sheets/discover') || path.endsWith('/matchups/sheets'))
    return 'discover'
  return null
})
const isDiscoverGuidesActive = computed(() => currentGuidesTab.value === 'discover')
const isMyGuidesActive = computed(() => currentGuidesTab.value === 'my-guides')
const isFavoriteGuidesActive = computed(() => currentGuidesTab.value === 'favoris')
const isCreateGuideActive = computed(() => currentGuidesTab.value === 'create')
const isBuildsSectionActive = computed(() => route.path.includes('/builds'))
const isCompanionAppActive = computed(() => {
  const appPath = localePath('/download')
  return route.path === appPath || route.path.startsWith(`${appPath}/`)
})
const currentBuildsTab = computed(() => {
  if (route.path.endsWith('/builds/discover')) return 'discover'
  if (route.path.endsWith('/builds/my-builds')) return 'my-builds'
  if (route.path.endsWith('/builds/favoris')) return 'favoris'
  if (!route.path.includes('/builds') || route.path.includes('/builds/create')) return null
  return typeof route.query.tab === 'string' ? route.query.tab : 'discover'
})
const isDiscoverBuildsActive = computed(() => currentBuildsTab.value === 'discover')
const isMyBuildsActive = computed(() => currentBuildsTab.value === 'my-builds')
const isFavoriteBuildsActive = computed(() => currentBuildsTab.value === 'favoris')
const favoritesStore = useFavoritesStore()
const buildStore = useBuildStore()
const matchupGuideStore = useMatchupGuideStore()
const matchupGuideFavoritesStore = useMatchupGuideFavoritesStore()
const statisticsUiStore = useStatisticsUiStore()
const surveillanceAlertStore = useStatisticsSurveillanceAlertStore()
const buildSurveillanceStore = useStatisticsBuildSurveillanceStore()
const { hydrated: clientHydrated } = useClientHydrated()
const hasFavorites = computed(() => favoritesStore.favoriteBuildIds.length > 0)
const hasUserBuilds = computed(
  () =>
    clientHydrated.value && filterStandaloneLibraryBuilds(buildStore.getSavedBuilds()).length > 0
)
const hasMyGuides = computed(() => {
  if (!clientHydrated.value) return false
  const version = matchupGuideStore.savedGuidesVersion
  return version >= 0 && matchupGuideStore.getSavedGuides().length > 0
})
const hasFavoriteGuides = computed(() => matchupGuideFavoritesStore.favoriteGuideIds.length > 0)
const hasWatchedChampions = computed(
  () => clientHydrated.value && statisticsUiStore.watchedChampionIds.length > 0
)
const surveillanceAlertCount = computed(() =>
  clientHydrated.value ? surveillanceAlertStore.alertCount + buildSurveillanceStore.alertCount : 0
)
const isStatisticsTierListActive = computed(
  () => route.path === localePath('/statistics/tier-list')
)
const isStatisticsSurveillanceActive = computed(
  () => route.path === localePath('/statistics/surveillance')
)
const isStatisticsChampionsActive = computed(() => route.path.includes('/statistics/champion'))
const isStatisticsGeneralActive = computed(() => {
  if (!route.path.includes('/statistics')) return false
  if (isStatisticsTierListActive.value) return false
  if (isStatisticsSurveillanceActive.value) return false
  if (isStatisticsChampionsActive.value) return false
  return (
    route.path === localePath('/statistics') ||
    route.path.startsWith(`${localePath('/statistics')}/`)
  )
})
const isSettingsSectionActive = computed(() => {
  const path = route.path
  return path === localePath('/settings') || path.startsWith(`${localePath('/settings')}/`)
})
const isStatisticsSectionActive = computed(() => route.path.includes('/statistics'))
const isPatchNotesActive = computed(() => route.path.includes('/patch-notes'))

const activePatchVersion = computed(() => {
  const fromRoute = normalizePatchNotesVersion(String(route.params.version ?? '').trim())
  if (fromRoute && route.path.includes('/patch-notes')) return fromRoute
  return (
    pickLatestPatchVersion(
      patchNotesStore.index?.latest,
      gameVersion.value,
      versionStore.currentVersion
    ) ||
    normalizePatchNotesVersion(gameVersion.value) ||
    gameVersion.value
  )
})

const patchSummaryLink = computed(() => localePath(`/patch-notes/${activePatchVersion.value}`))

/** Keep version / rank / role / OTP (and tab or sort) when switching between statistics pages. */
function pickStatisticsSharedQuery(keys: readonly string[]): Record<string, string | string[]> {
  const q = route.query as Record<string, string | string[] | undefined>
  const out: Record<string, string | string[]> = {}
  for (const key of keys) {
    const v = q[key]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[key] = v
  }
  return out
}

const statisticsIndexLink = computed(() =>
  localePath({
    path: '/statistics',
    query: pickStatisticsSharedQuery(['version', 'role', 'otp', 'rankTier', 'tab']),
  })
)

const statisticsChampionsLink = computed(() =>
  localePath({
    path: '/statistics/champion',
    query: pickStatisticsSharedQuery(['version', 'role', 'otp', 'rankTier']),
  })
)

const statisticsTierListLink = computed(() =>
  localePath({
    path: '/statistics/tier-list',
    query: pickStatisticsSharedQuery(['version', 'role', 'otp', 'rankTier', 'sort', 'view']),
  })
)

const statisticsSurveillanceLink = computed(() =>
  localePath({
    path: '/statistics/surveillance',
    query: pickStatisticsSharedQuery(['version', 'role', 'otp', 'rankTier']),
  })
)

onMounted(() => {
  checkLoggedIn()
  statisticsUiStore.init()
  surveillanceAlertStore.init()
  buildSurveillanceStore.init()
  if (!versionStore.currentVersion) {
    versionStore.loadCurrentVersion().catch(() => undefined)
  }
  patchNotesStore.loadIndex().catch(() => undefined)
  favoritesStore.init()
  matchupGuideFavoritesStore.init()
})

watch(
  () => route.path,
  () => {
    if (import.meta.client) checkLoggedIn()
    closeBuildsMenu()
    closeGuidesMenu()
    closeStatisticsMenu()
  }
)

const closeBuildsMenu = () => {
  isBuildsMenuOpen.value = false
}

const closeGuidesMenu = () => {
  isGuidesMenuOpen.value = false
}

const closeStatisticsMenu = () => {
  isStatisticsMenuOpen.value = false
}
</script>

<style scoped>
.header-shell {
  position: sticky;
  top: 0;
  z-index: 58;
}

.header {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 50px;
  padding: 0 15px;
  backdrop-filter: blur(10px);
  background: rgb(var(--rgb-chrome) / 1);
  margin-bottom: -5px;
}

.left-header .link {
  color: var(--color-accent);
}

.left-header {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: start;
}

.center-header {
  display: flex;
  justify-content: center;
  justify-self: center;
}

.companion-app-link {
  white-space: nowrap;
}

.companion-app-link.is-active {
  color: var(--color-accent);
}

.settings-nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-blue-50);
  text-decoration: none;
  transition: color 0.15s ease;
}

.settings-nav-link.is-active,
.settings-nav-link.router-link-active {
  color: var(--color-accent);
}

@media (hover: hover) {
  .settings-nav-link:hover {
    color: var(--color-accent);
  }
}

.right-header-slot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
}

.right-header {
  text-align: right;
  display: flex;
  align-items: center;
  gap: 18px;
}

.builds-menu {
  position: relative;
  padding-bottom: 8px;
  margin-bottom: -8px;
}

.header a {
  color: var(--color-blue-50);
  font-weight: 600;
  text-decoration: none;
}

.header a.router-link-active,
.header a.router-link-exact-active {
  color: var(--color-accent);
}

.link {
  color: var(--color-blue-50);
}

.version {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-blue-50);
}

.nav-alert-badge {
  display: inline-flex;
  min-width: 1.1rem;
  height: 1.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  padding: 0 0.25rem;
}

.nav-alert-badge--sub {
  margin-left: 0.35rem;
}

.builds-menu-trigger,
.mobile-builds-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.35rem 0.65rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  color: var(--color-blue-50);
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.builds-menu-trigger.is-open,
.mobile-builds-trigger.is-open {
  border-color: rgb(var(--rgb-accent) / 0.7);
  background: rgb(var(--rgb-accent) / 0.14);
  box-shadow: 0 0 0 1px rgb(var(--rgb-accent) / 0.2);
}

.builds-menu-trigger.is-active,
.mobile-builds-trigger.is-active {
  color: var(--color-accent);
}

.builds-menu-chevron {
  display: inline-flex;
  font-size: 0.72rem;
  line-height: 1;
  opacity: 0.85;
  transition: transform 0.2s ease;
}

.builds-menu-chevron.is-open {
  transform: rotate(180deg);
  opacity: 1;
}

.builds-menu-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  z-index: 60;
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 4px;
  transform: translateX(-50%);
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 10px;
  background: rgb(var(--rgb-chrome) / 1);
  padding: 8px;
  box-shadow: 0 12px 24px rgb(0 0 0 / 0.28);
}

.builds-submenu-link {
  display: block;
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--color-blue-50);
  text-align: left;
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.builds-submenu-link:hover,
.builds-submenu-link.is-active {
  background: rgb(var(--rgb-accent) / 0.14);
  color: var(--color-accent);
  text-decoration: none;
}

.builds-submenu-link.router-link-active:not(.is-active),
.builds-submenu-link.router-link-exact-active:not(.is-active) {
  background: transparent;
  color: var(--color-blue-50);
}

.mobile-admin-link {
  white-space: nowrap;
}

@media (hover: hover) {
  .header a:hover {
    text-decoration: underline;
  }

  .builds-menu-trigger:hover {
    border-color: rgb(var(--rgb-accent) / 0.55);
    background: rgb(var(--rgb-accent) / 0.1);
    color: var(--color-accent);
    text-decoration: none;
  }
}

@media (max-width: 768px) {
  .header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .left-header {
    min-width: 0;
  }

  .left-header .link span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right-header {
    display: none;
  }
}
</style>
