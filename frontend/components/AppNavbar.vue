<template>
  <header role="banner">
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
        <NuxtLink :to="localePath('/')" class="link" :aria-label="t('nav.home')">
          <span>Lelanation</span>
        </NuxtLink>
      </div>

      <div class="center-header">
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
        <button
          v-if="isMobileViewport && isAdminLoggedIn"
          class="menu-mobile"
          :aria-label="t('nav.mobileMenu')"
          :aria-expanded="isMenuOpen"
          @click="toggleMenu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 6l16 0"></path>
            <path d="M4 12l16 0"></path>
            <path d="M4 18l16 0"></path>
          </svg>
        </button>

        <div v-if="!isMobileViewport" class="right-header">
          <div
            class="builds-menu"
            @mouseenter="isBuildsMenuOpen = true"
            @mouseleave="isBuildsMenuOpen = false"
          >
            <NuxtLink
              :to="discoverBuildsLink"
              class="version builds-menu-trigger"
              :class="{ 'is-active': isBuildsSectionActive }"
            >
              <span>{{ t('nav.builds') }}</span>
              <span class="builds-menu-chevron" :class="{ 'is-open': isBuildsMenuOpen }">▾</span>
            </NuxtLink>
            <div v-show="isBuildsMenuOpen" class="builds-menu-dropdown">
              <NuxtLink
                :to="discoverBuildsLink"
                :title="t('buildsPage.discover')"
                class="builds-submenu-link"
                :class="{ 'is-active': isDiscoverBuildsActive }"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.discover') }}
              </NuxtLink>
              <NuxtLink
                :to="myBuildsLink"
                :title="t('buildsPage.myBuilds')"
                class="builds-submenu-link"
                :class="{ 'is-active': isMyBuildsActive }"
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
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.myFavorites') }}
              </NuxtLink>
              <NuxtLink
                :to="localePath('/builds/create')"
                :title="t('buildsPage.createBuild')"
                class="builds-submenu-link"
                @click="closeBuildsMenu"
              >
                {{ t('buildsPage.createBuild') }}
              </NuxtLink>
              <NuxtLink
                :to="theorycraftLink"
                :title="t('nav.theorycraft')"
                class="builds-submenu-link"
                :class="{ 'is-active': isTheorycraftActive }"
                @click="closeBuildsMenu"
              >
                {{ t('nav.theorycraft') }}
              </NuxtLink>
              <ShowIf :show-if="isAdminLoggedIn">
                <NuxtLink
                  :to="matchupGuidesLink"
                  :title="t('nav.matchupGuides')"
                  class="builds-submenu-link"
                  :class="{ 'is-active': isMatchupGuidesActive }"
                  @click="closeBuildsMenu"
                >
                  {{ t('nav.matchupGuides') }}
                </NuxtLink>
              </ShowIf>
            </div>
          </div>
          <div
            class="builds-menu"
            @mouseenter="isStatisticsMenuOpen = true"
            @mouseleave="isStatisticsMenuOpen = false"
          >
            <NuxtLink
              :to="statisticsIndexLink"
              class="version builds-menu-trigger"
              :class="{ 'is-active': isStatisticsSectionActive }"
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
            </NuxtLink>
            <div v-show="isStatisticsMenuOpen" class="builds-menu-dropdown">
              <NuxtLink
                :to="statisticsIndexLink"
                :title="t('nav.statistics')"
                class="builds-submenu-link"
                :class="{ 'is-active': isStatisticsIndexActive }"
                @click="closeStatisticsMenu"
              >
                {{ t('nav.statistics') }}
              </NuxtLink>
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
          <div
            class="builds-menu patch-menu"
            @mouseenter="isPatchMenuOpen = true"
            @mouseleave="isPatchMenuOpen = false"
          >
            <div
              class="version builds-menu-trigger patch-menu-trigger"
              :class="{ 'is-active': isPatchNotesActive }"
            >
              <a
                :href="officialPatchNotesUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="patch-version-link"
                :title="t('nav.officialPatchNotes')"
              >
                {{ activePatchVersion }}
              </a>
              <span class="builds-menu-chevron" :class="{ 'is-open': isPatchMenuOpen }">▾</span>
            </div>
            <div v-show="isPatchMenuOpen" class="builds-menu-dropdown patch-menu-dropdown">
              <NuxtLink
                :to="patchSummaryLink"
                :title="t('nav.patchSummary')"
                class="builds-submenu-link"
                :class="{ 'is-active': isPatchNotesActive }"
                @click="closePatchMenu"
              >
                {{ t('nav.patchSummary') }}
              </NuxtLink>
            </div>
          </div>
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

      <div
        v-if="isMobileViewport && isAdminLoggedIn"
        class="mobile-nav"
        :class="{ 'is-open': isMenuOpen }"
      >
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/admin')"
          :title="t('nav.admin')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.admin') }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import ShowIf from '~/components/ShowIf.vue'
import { getFallbackGameVersion } from '~/config/version'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useMobileViewport } from '~/composables/useMobileViewport'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useVersionStore } from '~/stores/VersionStore'
import { normalizePatchNotesVersion, usePatchNotesStore } from '~/stores/PatchNotesStore'
import { pickLatestPatchVersion } from '~/utils/patchVersion'

const isMenuOpen = ref(false)
const isBuildsMenuOpen = ref(false)
const isStatisticsMenuOpen = ref(false)
const isPatchMenuOpen = ref(false)
const { isMobileViewport } = useMobileViewport()
const { t, locale } = useI18n()
const { isLoggedIn: isAdminLoggedIn, checkLoggedIn } = useAdminAuth()
const localePath = useLocalePath()
const route = useRoute()
const versionStore = useVersionStore()
const patchNotesStore = usePatchNotesStore()
const gameVersion = computed(() => versionStore.currentVersion || getFallbackGameVersion())
const discoverBuildsLink = computed(() => localePath('/builds/discover'))
const myBuildsLink = computed(() => localePath('/builds/my-builds'))
const favoriteBuildsLink = computed(() => localePath('/builds/favoris'))
const theorycraftLink = computed(() => localePath('/builds/theorycraft'))
const isTheorycraftActive = computed(() => route.path.includes('/builds/theorycraft'))
const matchupGuidesLink = computed(() => localePath('/matchups/sheets'))
const isMatchupGuidesActive = computed(() => route.path.includes('/matchups/sheets'))
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
const statisticsUiStore = useStatisticsUiStore()
const surveillanceAlertStore = useStatisticsSurveillanceAlertStore()
const buildSurveillanceStore = useStatisticsBuildSurveillanceStore()
const { hydrated: clientHydrated } = useClientHydrated()
const hasFavorites = computed(() => favoritesStore.favoriteBuildIds.length > 0)
const hasWatchedChampions = computed(
  () => clientHydrated.value && statisticsUiStore.watchedChampionIds.length > 0
)
const surveillanceAlertCount = computed(() =>
  clientHydrated.value ? surveillanceAlertStore.alertCount + buildSurveillanceStore.alertCount : 0
)
const isStatisticsIndexActive = computed(() => route.path === localePath('/statistics'))
const isStatisticsTierListActive = computed(
  () => route.path === localePath('/statistics/tier-list')
)
const isStatisticsSurveillanceActive = computed(
  () => route.path === localePath('/statistics/surveillance')
)
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

const getRiotLocale = (currentLocale: string): string => {
  const localeMap: Record<string, string> = {
    fr: 'fr-fr',
    en: 'en-us',
  }
  return localeMap[currentLocale] || 'en-us'
}

const officialPatchNotesUrl = computed(() => {
  const riotLocale = getRiotLocale(locale.value)
  const v = String(activePatchVersion.value || '').trim()
  const parts = v.match(/\d+/g) ?? []
  const gameMajor = Number(parts[0] ?? NaN)
  const gameMinor = Number(parts[1] ?? NaN)

  if (Number.isFinite(gameMajor) && Number.isFinite(gameMinor)) {
    const patchMajor = gameMajor + 10
    return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/league-of-legends-patch-${patchMajor}-${gameMinor}-notes/`
  }

  const slug = v.replace(/\./g, '-')
  return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/league-of-legends-patch-${slug}-notes/`
})

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
})

watch(isMobileViewport, mobile => {
  if (!mobile) {
    isMenuOpen.value = false
  }
})

watch(
  () => route.path,
  () => {
    if (import.meta.client) checkLoggedIn()
    isMenuOpen.value = false
  }
)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeBuildsMenu = () => {
  isBuildsMenuOpen.value = false
}

const closeStatisticsMenu = () => {
  isStatisticsMenuOpen.value = false
}

const closePatchMenu = () => {
  isPatchMenuOpen.value = false
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 58;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 50px;
  padding: 0 15px;
  backdrop-filter: blur(10px);
  background: #08101f;
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
  gap: 6px;
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.builds-menu-trigger.is-active,
.mobile-builds-trigger.is-active {
  color: var(--color-accent);
}

.builds-menu-chevron {
  display: inline-flex;
  transition: transform 0.2s ease;
}

.builds-menu-chevron.is-open {
  transform: rotate(180deg);
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
  background: #08101f;
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

.patch-menu-trigger {
  cursor: default;
}

.patch-version-link {
  color: inherit;
  font-weight: inherit;
  text-decoration: none;
}

.patch-version-link:hover {
  color: var(--color-accent);
  text-decoration: none;
}

.patch-menu .builds-menu-dropdown {
  left: auto;
  right: 0;
  min-width: 160px;
  transform: none;
}

.menu-mobile {
  display: none;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--color-blue-50);
}

.mobile-nav {
  display: none;
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  background: #08101f;
  padding: 14px 15px;
  flex-direction: column;
  gap: 12px;
}

.mobile-nav.is-open {
  display: flex !important;
  z-index: 1000;
}

.mobile-nav a {
  color: var(--color-blue-50);
  padding: 6px 8px;
  display: block;
}

.mobile-builds-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-builds-trigger {
  justify-content: space-between;
  width: 100%;
  padding: 6px 8px;
}

.mobile-builds-dropdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 12px;
}

@media (hover: hover) {
  .header a:hover {
    text-decoration: underline;
  }

  .builds-menu-trigger:hover {
    text-decoration: underline;
  }
}

@media (max-width: 768px) {
  .menu-mobile {
    display: block;
  }

  .right-header {
    display: none;
  }

  .center-header {
    font-size: 0.875rem;
  }
}
</style>
