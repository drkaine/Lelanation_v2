<template>
  <header role="banner">
    <nav class="header">
      <div class="left-header">
        <LanguageSwitcher />
        <NuxtLink :to="localePath('/')" class="link" :aria-label="t('nav.home')">
          <span>Lelanation</span>
        </NuxtLink>
      </div>

      <button class="menu-mobile" aria-label="Toggle menu" @click="toggleMenu">
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

      <div class="mobile-nav" :class="{ 'is-open': isMenuOpen }">
        <div class="mobile-builds-menu">
          <button
            type="button"
            class="version mobile-builds-trigger"
            :class="{ 'is-active': isBuildsSectionActive }"
            @click="toggleMobileBuildsMenu"
          >
            <span>{{ t('nav.builds') }}</span>
            <span class="builds-menu-chevron" :class="{ 'is-open': isMobileBuildsMenuOpen }"
              >▾</span
            >
          </button>
          <div v-if="isMobileBuildsMenuOpen" class="mobile-builds-dropdown">
            <NuxtLink
              :to="discoverBuildsLink"
              :title="t('buildsPage.discover')"
              class="version builds-submenu-link"
              :class="{ 'is-active': isDiscoverBuildsActive }"
              @click="handleBuildsNavigation"
            >
              {{ t('buildsPage.discover') }}
            </NuxtLink>
            <NuxtLink
              :to="myBuildsLink"
              :title="t('buildsPage.myBuilds')"
              class="version builds-submenu-link"
              :class="{ 'is-active': isMyBuildsActive }"
              @click="handleBuildsNavigation"
            >
              {{ t('buildsPage.myBuilds') }}
            </NuxtLink>
            <NuxtLink
              v-if="hasFavorites"
              :to="favoriteBuildsLink"
              :title="t('buildsPage.myFavorites')"
              class="version builds-submenu-link"
              :class="{ 'is-active': isFavoriteBuildsActive }"
              @click="handleBuildsNavigation"
            >
              {{ t('buildsPage.myFavorites') }}
            </NuxtLink>
            <NuxtLink
              :to="localePath('/builds/create')"
              :title="t('buildsPage.createBuild')"
              class="version builds-submenu-link"
              @click="handleBuildsNavigation"
            >
              {{ t('buildsPage.createBuild') }}
            </NuxtLink>
            <NuxtLink
              :to="theorycraftLink"
              :title="t('nav.theorycraft')"
              class="version builds-submenu-link"
              :class="{ 'is-active': isTheorycraftActive }"
              @click="handleBuildsNavigation"
            >
              {{ t('nav.theorycraft') }}
            </NuxtLink>
          </div>
        </div>
        <NuxtLink
          :to="localePath('/videos')"
          :title="t('nav.videos')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.videos') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/map')"
          :title="t('nav.map')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.map') }}
        </NuxtLink>
        <NuxtLink
          :to="statisticsIndexLink"
          :title="t('nav.statistics')"
          class="version"
          :class="{ 'router-link-active': isStatisticsIndexActive }"
          @click="toggleMenu"
        >
          {{ t('nav.statistics') }}
        </NuxtLink>
        <NuxtLink
          :to="statisticsTierListLink"
          :title="t('nav.tierList')"
          class="version"
          :class="{ 'router-link-active': isStatisticsTierListActive }"
          @click="toggleMenu"
        >
          {{ t('nav.tierList') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/patch-notes')"
          :title="t('nav.patchNotes')"
          class="version"
          :class="{ 'router-link-active': isPatchNotesActive }"
          @click="toggleMenu"
        >
          {{ t('nav.patchNotes') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/admin')"
          :title="t('nav.admin')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.admin') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/app')"
          :title="t('nav.download')"
          class="version"
          @click="toggleMenu"
        >
          {{ t('nav.download') }}
        </NuxtLink>
      </div>

      <div class="right-header">
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
          </div>
        </div>
        <NuxtLink :to="localePath('/videos')" :title="t('nav.videos')" class="version">
          {{ t('nav.videos') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/map')"
          :title="t('nav.map')"
          class="version"
        >
          {{ t('nav.map') }}
        </NuxtLink>
        <NuxtLink
          :to="statisticsIndexLink"
          :title="t('nav.statistics')"
          class="version"
          :class="{ 'router-link-active': isStatisticsIndexActive }"
        >
          {{ t('nav.statistics') }}
        </NuxtLink>
        <NuxtLink
          :to="statisticsTierListLink"
          :title="t('nav.tierList')"
          class="version"
          :class="{ 'router-link-active': isStatisticsTierListActive }"
        >
          {{ t('nav.tierList') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/admin')"
          :title="t('nav.admin')"
          class="version"
        >
          {{ t('nav.admin') }}
        </NuxtLink>
        <NuxtLink
          v-if="isAdminLoggedIn"
          :to="localePath('/app')"
          :title="t('nav.download')"
          class="version"
        >
          {{ t('nav.download') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/patch-notes')"
          :title="t('nav.patchNotes')"
          class="version"
          :class="{ 'router-link-active': isPatchNotesActive }"
        >
          {{ t('nav.patchNotes') }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useFavoritesStore } from '~/stores/FavoritesStore'

const isMenuOpen = ref(false)
const isBuildsMenuOpen = ref(false)
const isMobileBuildsMenuOpen = ref(false)
const { t } = useI18n()
const { isLoggedIn: isAdminLoggedIn, checkLoggedIn } = useAdminAuth()
const localePath = useLocalePath()
const route = useRoute()
const discoverBuildsLink = computed(() => ({
  path: localePath('/builds'),
  query: { tab: 'discover' },
}))
const myBuildsLink = computed(() => ({ path: localePath('/builds'), query: { tab: 'my-builds' } }))
const favoriteBuildsLink = computed(() => ({
  path: localePath('/builds'),
  query: { tab: 'favoris' },
}))
const theorycraftLink = computed(() => localePath('/builds/theorycraft'))
const isTheorycraftActive = computed(() => route.path.includes('/builds/theorycraft'))
const isBuildsSectionActive = computed(() => route.path.includes('/builds'))
const currentBuildsTab = computed(() => {
  if (!route.path.includes('/builds') || route.path.includes('/builds/create')) return null
  return typeof route.query.tab === 'string' ? route.query.tab : 'discover'
})
const isDiscoverBuildsActive = computed(() => currentBuildsTab.value === 'discover')
const isMyBuildsActive = computed(() => currentBuildsTab.value === 'my-builds')
const isFavoriteBuildsActive = computed(() => currentBuildsTab.value === 'favoris')
const favoritesStore = useFavoritesStore()
const hasFavorites = computed(() => favoritesStore.favoriteBuildIds.length > 0)
const isStatisticsIndexActive = computed(() => route.path === localePath('/statistics'))
const isStatisticsTierListActive = computed(
  () => route.path === localePath('/statistics/tier-list')
)
const isPatchNotesActive = computed(() => route.path.includes('/patch-notes'))

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

onMounted(() => {
  checkLoggedIn()
  favoritesStore.init()
})

watch(
  () => route.path,
  () => {
    if (import.meta.client) checkLoggedIn()
  }
)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeBuildsMenu = () => {
  isBuildsMenuOpen.value = false
}

const toggleMobileBuildsMenu = () => {
  isMobileBuildsMenuOpen.value = !isMobileBuildsMenuOpen.value
}

const handleBuildsNavigation = () => {
  isMobileBuildsMenuOpen.value = false
  isMenuOpen.value = false
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 58;
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  color: var(--color-blue-50);
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

@media (max-width: 700px) {
  .menu-mobile {
    display: block;
  }

  .right-header {
    display: none;
  }
}
</style>
