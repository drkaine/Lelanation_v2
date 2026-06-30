<template>
  <div
    class="flex min-h-screen flex-col"
    :class="{ 'has-mobile-tab-bar': showMobileTabBar }"
    :style="appShellVars"
  >
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
    >
      Skip to content
    </a>
    <header v-if="showStandardAppChrome && !isBuildCardRenderRoute" class="app-chrome-sticky">
      <AppNavbar />
      <div v-show="!commandBarHiddenByScroll" class="command-bar-sticky-row">
        <button
          v-show="commandsCollapsed"
          type="button"
          class="command-collapse-floating"
          title="Afficher les commandes"
          :aria-expanded="false"
          @click="commandsCollapsed = false"
        >
          ▾
        </button>
        <div v-show="!commandsCollapsed" ref="commandBarRef" class="command-bar-overlay">
          <div class="command-bar" :class="{ 'command-bar-collapsed': commandsCollapsed }">
            <div v-show="!commandsCollapsed" class="command-bar-content">
              <label class="command-toggle">
                <input
                  type="checkbox"
                  :checked="tooltipsDisabled"
                  class="command-toggle-checkbox"
                  @change="toggleTooltipsDisabled()"
                />
                <span class="command-toggle-track" :class="{ active: tooltipsDisabled }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('nav.disableTooltips') }}</span>
              </label>
              <button
                type="button"
                class="command-toggle command-toggle-button"
                :aria-pressed="isStreamerMode"
                @click="toggleStreamerMode()"
              >
                <span class="command-toggle-track" :class="{ active: isStreamerMode }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('footer.presentationMode') }}</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button"
                :aria-pressed="isPresentationZoom"
                @click="togglePresentationZoom()"
              >
                <span class="command-toggle-track" :class="{ active: isPresentationZoom }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('commandBar.presentationZoom') }}</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button"
                :aria-pressed="championSplashEnabled"
                @click="toggleChampionSplashEnabled()"
              >
                <span class="command-toggle-track" :class="{ active: championSplashEnabled }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('commandBar.championSplash') }}</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button"
                :aria-pressed="simplifiedStatsEnabled"
                @click="toggleSimplifiedStatsEnabled()"
              >
                <span class="command-toggle-track" :class="{ active: simplifiedStatsEnabled }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('commandBar.simplifiedStats') }}</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button"
                :aria-pressed="statsSplitTransformEnabled"
                @click="toggleStatsSplitTransformEnabled()"
              >
                <span class="command-toggle-track" :class="{ active: statsSplitTransformEnabled }">
                  <span class="command-toggle-thumb" />
                </span>
                <span>{{ t('commandBar.splitTransformStats') }}</span>
              </button>
              <button
                type="button"
                class="command-help-button"
                :title="t('commandBar.shortcutsModalTitle')"
                :aria-label="t('commandBar.openShortcutsModal')"
                :aria-expanded="commandsModalOpen"
                @click="openCommandsModal"
              >
                ?
              </button>
            </div>
            <button
              type="button"
              class="command-collapse-button"
              :title="commandsCollapsed ? 'Afficher les commandes' : 'Masquer les commandes'"
              :aria-expanded="!commandsCollapsed"
              @click="commandsCollapsed = !commandsCollapsed"
            >
              {{ commandsCollapsed ? '▾' : '▴' }}
            </button>
          </div>
        </div>
      </div>
    </header>
    <div
      v-if="showStreamerPanels"
      class="streamer-panel streamer-panel-top"
      :class="{ 'is-open': streamerPanelsOpen }"
    >
      <AppNavbar v-if="streamerPanelsOpen" />
    </div>
    <button
      v-show="showStreamerPanels"
      type="button"
      class="streamer-toggle streamer-toggle-top"
      :class="{ 'streamer-toggle-top-open': streamerPanelsOpen }"
      :title="streamerPanelsOpen ? 'Masquer la navigation' : 'Afficher la navigation'"
      @click="toggleStreamerPanels()"
    >
      {{ streamerPanelsOpen ? '▴' : '▾' }}
    </button>
    <main id="main" tabindex="-1" class="app-main min-w-0 flex-1">
      <NuxtPage />
    </main>
    <AppFooter v-if="showStandardAppChrome && !isAdminRoute && !isBuildCardRenderRoute" />
    <AppMobileTabBar v-if="showMobileTabBar" />
    <div
      v-if="showStreamerPanels"
      class="streamer-panel streamer-panel-bottom"
      :class="{ 'is-open': streamerPanelsOpen }"
    >
      <AppFooter v-if="streamerPanelsOpen" />
    </div>
    <CookieConsentBanner v-show="!isBuildCardRenderRoute" />
    <CommandShortcutsModal
      :open="commandsModalOpen"
      :tooltips-disabled="tooltipsDisabled"
      :streamer-mode="isStreamerMode"
      :presentation-zoom="isPresentationZoom"
      :champion-splash="championSplashEnabled"
      :simplified-stats="simplifiedStatsEnabled"
      :split-transform-stats="statsSplitTransformEnabled"
      @close="closeCommandsModal"
      @toggle-tooltips="toggleTooltipsDisabled()"
      @toggle-streamer="toggleStreamerMode()"
      @toggle-presentation-zoom="togglePresentationZoom()"
      @toggle-champion-splash="toggleChampionSplashEnabled()"
      @toggle-simplified-stats="toggleSimplifiedStatsEnabled()"
      @toggle-split-transform-stats="toggleStatsSplitTransformEnabled()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'
import AppFooter from '~/components/AppFooter.vue'
import AppMobileTabBar from '~/components/AppMobileTabBar.vue'
import CommandShortcutsModal from '~/components/CommandShortcutsModal.vue'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { usePresentationZoom } from '~/composables/usePresentationZoom'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useGlobalSeo } from '~/composables/useGlobalSeo'
import { absoluteSitePath } from '~/utils/siteUrl'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { useBuildStore } from '~/stores/BuildStore'
import {
  useMatchupGuideDraftStore,
  type MatchupGuideDraftStep,
} from '~/stores/MatchupGuideDraftStore'
import {
  navigateMatchupGuideCreateStepPath,
  buildMatchupGuideStepAccessContext,
} from '~/utils/matchupGuideCreateSteps'
import { matchupGuideCreateRouteQuery } from '~/utils/matchupGuideFromBuildSession'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const localeHead = useLocaleHead({ addDirAttribute: true, addSeoAttributes: true } as any)
const siteUrl = useSiteUrl()
const { canonicalUrl } = useGlobalSeo()
const { isStreamerMode, toggleStreamerMode } = useStreamerMode()
const { isPresentationZoom, togglePresentationZoom } = usePresentationZoom()
const { isLayoutScaled } = useLayoutScaled()
const { isMobileViewport } = useMobileViewport()
const showStandardAppChrome = computed(() => !isStreamerMode.value || isMobileViewport.value)
const showStreamerPanels = computed(() => isStreamerMode.value && !isMobileViewport.value)
const { tooltipsDisabled, tooltipsEnabled, setTooltipsDisabled, toggleTooltipsDisabled } =
  useTooltipsPreference()
const { championSplashEnabled, toggleChampionSplashEnabled } = useChampionSplashPreference()
const { simplifiedStatsEnabled, toggleSimplifiedStatsEnabled } = useSimplifiedStatsPreference()
const { statsSplitTransformEnabled, toggleStatsSplitTransformEnabled } =
  useStatisticsSplitTransformPreference()
const buildStore = useBuildStore()
const matchupGuideDraftStore = useMatchupGuideDraftStore()
const streamerNavOpen = useState<boolean>('streamer-nav-open', () => false)
const streamerFooterOpen = useState<boolean>('streamer-footer-open', () => false)
const streamerPanelsOpen = computed(() => streamerNavOpen.value && streamerFooterOpen.value)
const commandsCollapsed = useState<boolean>('commands-collapsed', () => true)
const commandsModalOpen = useState<boolean>('commands-modal-open', () => false)
const commandBarRef = ref<HTMLElement | null>(null)

function openCommandsModal() {
  commandsModalOpen.value = true
}

function closeCommandsModal() {
  commandsModalOpen.value = false
}

function toggleCommandsModal() {
  commandsModalOpen.value = !commandsModalOpen.value
}
const commandBarHiddenByScroll = ref(false)
const COMMAND_BAR_HIDE_THRESHOLD = 96
const COMMAND_BAR_SHOW_THRESHOLD = 24
let commandBarScrollRaf: number | null = null

const appShellVars = computed(() => ({
  '--build-create-page-padding-top': !isLayoutScaled.value ? '6px' : '1rem',
  '--build-create-card-top-gap': '11px',
  '--build-create-page-lift': '0px',
  '--build-page-padding-top': !isLayoutScaled.value ? '6px' : '1rem',
  '--app-mobile-tab-bar-height': showMobileTabBar.value ? '3.5rem' : '0px',
}))

const isAdminRoute = computed(() => String(route.path).includes('/admin'))
/** Page capture PNG build card : pas de nav / barre de commandes / ▾ flottant. */
const isBuildCardRenderRoute = computed(() => {
  const path = String(route.path || '').replace(/\/+$/, '') || '/'
  const segs = path.split('/').filter(Boolean)
  let i = 0
  if (segs[0] === 'en' || segs[0] === 'fr') i = 1
  return segs[i] === 'render' && segs[i + 1] === 'build-card'
})

const showMobileTabBar = computed(
  () =>
    showStandardAppChrome.value &&
    !isAdminRoute.value &&
    !isBuildCardRenderRoute.value &&
    isMobileViewport.value
)

provide('tooltipsEnabled', tooltipsEnabled)

useHead(() => {
  const hreflangLinks = (localeHead.value.link ?? []).filter(
    (link: { rel?: string; hreflang?: string }) =>
      link.rel === 'alternate' && Boolean(link.hreflang)
  )
  return {
    htmlAttrs: localeHead.value.htmlAttrs,
    link: [
      { rel: 'canonical', href: canonicalUrl.value, key: 'canonical' },
      ...hreflangLinks.map((link: Record<string, unknown>, index: number) => ({
        ...link,
        href:
          typeof link.href === 'string'
            ? absoluteSitePath(siteUrl, new URL(link.href, siteUrl).pathname)
            : link.href,
        key: `hreflang-${String(link.hreflang ?? index)}`,
      })),
    ],
    meta: localeHead.value.meta ?? [],
  }
})

watch(isStreamerMode, enabled => {
  if (enabled) {
    // In streamer mode, nav and footer are hidden by default.
    streamerNavOpen.value = false
    streamerFooterOpen.value = false
    setTooltipsDisabled(true)
  }
})

const toggleStreamerPanels = () => {
  const nextState = !streamerPanelsOpen.value
  streamerNavOpen.value = nextState
  streamerFooterOpen.value = nextState
}

const onKeyDown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  const target = event.target as HTMLElement | null
  const tagName = target?.tagName?.toUpperCase()
  const isEditableTarget =
    !!target &&
    (target.isContentEditable ||
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT')

  if (
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.key === 'ArrowDown' || event.key === 'ArrowUp')
  ) {
    if (!isEditableTarget) {
      event.preventDefault()
      if (event.key === 'ArrowDown') {
        commandsCollapsed.value = false
        commandBarHiddenByScroll.value = false
      } else {
        commandsCollapsed.value = true
      }
    }
    return
  }

  if (event.altKey && key === 'h') {
    event.preventDefault()
    toggleCommandsModal()
    return
  }

  if (event.altKey && key === 'p') {
    event.preventDefault()
    toggleStreamerMode()
    return
  }

  if (event.altKey && key === 't') {
    event.preventDefault()
    toggleTooltipsDisabled()
    return
  }

  if (event.altKey && key === 's') {
    event.preventDefault()
    toggleChampionSplashEnabled()
    return
  }

  if (event.altKey && key === 'z') {
    event.preventDefault()
    togglePresentationZoom()
    return
  }

  if (event.altKey && key === 'c') {
    event.preventDefault()
    toggleSimplifiedStatsEnabled()
    return
  }

  if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && key === 't') {
    if (!isEditableTarget) {
      event.preventDefault()
      toggleStatsSplitTransformEnabled()
    }
    return
  }

  if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

  if (isEditableTarget) return

  const path = String(route.path)
  const direction = event.key === 'ArrowLeft' ? -1 : 1

  function pushTabQuery(nextTab: string, opts?: { omitOverviewTab?: boolean }) {
    const nextQuery = { ...route.query } as Record<string, string | string[]>
    if (opts?.omitOverviewTab && nextTab === 'overview') {
      delete nextQuery.tab
    } else {
      nextQuery.tab = nextTab
    }
    router.push({ path: route.path, query: nextQuery })
  }

  function navigateTabOrder<T extends string>(
    tabOrder: readonly T[],
    currentTab: string,
    opts?: { omitOverviewTab?: boolean }
  ) {
    const currentIndex = tabOrder.includes(currentTab as T) ? tabOrder.indexOf(currentTab as T) : 0
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= tabOrder.length) return false
    event.preventDefault()
    pushTabQuery(tabOrder[nextIndex]!, opts)
    return true
  }

  if (path.match(/^\/(?:fr\/|en\/)?statistics\/?$/)) {
    const tabOrder = [
      'overview',
      'team',
      'objectives',
      'surrender',
      'bans',
      'championTable',
      'balance',
      'runes',
      'spells',
      'items',
      'pings',
      'vision',
      'misc',
      'patchNotes',
      'infos',
    ] as const
    const currentTabRaw = route.query.tab
    const currentTab = typeof currentTabRaw === 'string' ? currentTabRaw : 'overview'
    if (navigateTabOrder(tabOrder, currentTab, { omitOverviewTab: true })) return
    return
  }

  const championStatsMatch = path.match(/^\/(?:fr\/|en\/)?statistics\/champion\/[^/]+\/?$/)
  if (championStatsMatch) {
    const tabOrder = [
      'overview',
      'matchups',
      'synergy',
      'runes',
      'spells',
      'skills',
      'objectives',
      'pings',
      'vision',
      'misc',
    ] as const
    const currentTabRaw = route.query.tab
    const currentTab = typeof currentTabRaw === 'string' ? currentTabRaw : 'overview'
    if (navigateTabOrder(tabOrder, currentTab)) return
    return
  }

  const itemStatsMatch = path.match(/^\/(?:fr\/|en\/)?statistics\/item\/[^/]+\/?$/)
  if (itemStatsMatch) {
    const tabOrder = ['overview', 'purchase'] as const
    const currentTabRaw = route.query.tab
    const currentTab = typeof currentTabRaw === 'string' ? currentTabRaw : 'overview'
    if (navigateTabOrder(tabOrder, currentTab)) return
    return
  }

  const match = path.match(/\/builds\/create\/(champion|rune|item|info)(?:\/|$)/)
  if (match) {
    const stepOrder = ['champion', 'rune', 'item', 'info'] as const
    const currentStep = match[1] as (typeof stepOrder)[number]
    const currentStepIndex = stepOrder.indexOf(currentStep)
    const nextIndex = event.key === 'ArrowLeft' ? currentStepIndex - 1 : currentStepIndex + 1
    if (nextIndex < 0 || nextIndex >= stepOrder.length) return

    event.preventDefault()
    const nextStep = stepOrder[nextIndex]
    const query: Record<string, string> = {}
    const editId = route.query.editId
    if (typeof editId === 'string' && editId.length > 0) query.editId = editId
    if (route.query.app === 'on') query.app = 'on'
    router.push(localePath({ path: `/builds/create/${nextStep}`, query }))
    return
  }

  const matchupMatch = path.match(
    /\/matchups\/sheets\/create\/(champion|rune|item|info|matchups|write|finalize)(?:\/|$)/
  )
  if (matchupMatch) {
    matchupGuideDraftStore.hydrateFromStorage()

    const currentStep = matchupMatch[1] as MatchupGuideDraftStep
    const nextStep = navigateMatchupGuideCreateStepPath(direction, {
      currentStep,
      ...buildMatchupGuideStepAccessContext({
        buildValid: buildStore.isBuildValid,
        hasChampion: Boolean(buildStore.currentBuild?.champion),
        matchupEntries: matchupGuideDraftStore.matchupEntries,
      }),
    })
    if (!nextStep) return

    event.preventDefault()
    matchupGuideDraftStore.setLastStep(nextStep)
    const query = matchupGuideCreateRouteQuery(route.query)
    router.push(localePath({ path: `/matchups/sheets/create/${nextStep}`, query }))
  }
}

const onDocumentPointerDown = (event: MouseEvent) => {
  if (commandsCollapsed.value) return
  const target = event.target as Node | null
  if (!target) return
  if (commandBarRef.value?.contains(target)) return
  commandsCollapsed.value = true
}

function syncCommandBarHiddenByScroll(): void {
  if (!import.meta.client) return
  const scrollY = window.scrollY
  if (commandBarHiddenByScroll.value) {
    if (scrollY <= COMMAND_BAR_SHOW_THRESHOLD) {
      commandBarHiddenByScroll.value = false
    }
    return
  }
  if (scrollY >= COMMAND_BAR_HIDE_THRESHOLD) {
    commandBarHiddenByScroll.value = true
  }
}

function onWindowScroll() {
  if (!import.meta.client) return
  if (commandBarScrollRaf != null) return
  commandBarScrollRaf = window.requestAnimationFrame(() => {
    commandBarScrollRaf = null
    syncCommandBarHiddenByScroll()
  })
}

watch(
  () => route.path,
  () => {
    commandsCollapsed.value = true
    commandBarHiddenByScroll.value = false
    if (import.meta.client) syncCommandBarHiddenByScroll()
  },
  { immediate: true }
)

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onDocumentPointerDown)
    window.addEventListener('scroll', onWindowScroll, { passive: true })
    syncCommandBarHiddenByScroll()
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('mousedown', onDocumentPointerDown)
    window.removeEventListener('scroll', onWindowScroll)
    if (commandBarScrollRaf != null) {
      window.cancelAnimationFrame(commandBarScrollRaf)
      commandBarScrollRaf = null
    }
  })
}
</script>

<style>
@import './assets/css/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Selectors: force black background */
  select {
    background-color: #000;
  }

  option {
    background-color: #000;
  }
}

/* Global graphic rules:
   - No pure white in UI (replace with the lightest blue).
*/
@layer utilities {
  .text-white {
    color: rgb(var(--rgb-primary-light) / 1) !important;
  }

  .bg-white {
    background-color: rgb(var(--rgb-primary-light) / 1) !important;
  }

  /* bg-surface should be transparent */
  .bg-surface {
    background-color: transparent !important;
  }

  /* All borders should be gold (accent) */
  [class*='border-primary'] {
    border-color: rgb(var(--rgb-accent) / 0.7) !important;
  }
}

.streamer-panel {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 60;
  transition: transform 0.25s ease;
}

.streamer-panel-top {
  top: 0;
  transform: translateY(-110%);
}

.streamer-panel-top.is-open {
  transform: translateY(0);
}

.streamer-panel-bottom {
  bottom: 0;
  transform: translateY(110%);
}

.streamer-panel-bottom.is-open {
  transform: translateY(0);
}

.streamer-panel-top :deep(.header) {
  position: static;
}

.streamer-toggle {
  position: fixed;
  left: 6px;
  z-index: 70;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  background: rgb(var(--rgb-background) / 0.18);
  color: var(--color-blue-50);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    bottom 0.25s ease,
    top 0.25s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.streamer-toggle:hover {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}

.streamer-toggle-top {
  top: 0;
}

.streamer-toggle-top-open {
  top: 50px;
}

@media (max-width: 768px) {
  .app-chrome-sticky .command-bar-sticky-row {
    display: none !important;
  }

  .streamer-toggle,
  .streamer-panel {
    display: none !important;
  }
}

.app-chrome-sticky {
  position: sticky;
  top: 0;
  z-index: 58;
  background: #08101f;
}

.app-chrome-sticky :deep(.header) {
  position: static;
  top: auto;
  margin-bottom: 0;
  z-index: auto;
}

.command-bar-sticky-row {
  position: relative;
  min-height: 24px;
}

.command-bar-overlay {
  display: flex;
  justify-content: flex-end;
  padding: 0 6px;
}

.command-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
  padding: 6px 16px;
  background: #08101f;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.15);
  font-size: 11px;
  color: rgb(var(--rgb-text) / 0.6);
  backdrop-filter: blur(10px);
}

.command-bar.command-bar-collapsed {
  width: auto;
  justify-content: flex-end;
  padding: 2px 0 0;
  background: transparent;
  border-bottom: none;
  backdrop-filter: none;
}

.command-bar-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1;
}

.command-help-button {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.18);
  color: var(--color-blue-50);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.command-help-button:hover,
.command-help-button[aria-expanded='true'] {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}

.command-collapse-button {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 4px;
  background: rgb(var(--rgb-background) / 0.18);
  color: var(--color-blue-50);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.command-collapse-button:hover {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}

.command-bar.command-bar-collapsed .command-collapse-button {
  background: #08101f;
}

.command-collapse-floating {
  position: absolute;
  top: 2px;
  right: 6px;
  left: auto;
  z-index: 1;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 4px;
  background: #08101f;
  color: var(--color-blue-50);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.command-collapse-floating:hover {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}

.command-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 9999px;
  padding: 4px 8px;
  background: rgb(var(--rgb-background) / 0.18);
  color: var(--color-blue-50);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.command-toggle:hover {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}

.command-toggle.is-disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.command-toggle-button {
  font: inherit;
}

.command-toggle-checkbox {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.command-toggle-checkbox:disabled {
  cursor: not-allowed;
}

.command-toggle-track {
  width: 30px;
  height: 16px;
  border-radius: 9999px;
  background: rgb(var(--rgb-text) / 0.35);
  padding: 2px;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.command-toggle-track.active {
  background: rgb(var(--rgb-accent) / 0.7);
}

.command-toggle-thumb {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: rgb(var(--rgb-background));
  transition: transform 0.2s ease;
}

.command-toggle-track.active .command-toggle-thumb {
  transform: translateX(14px);
}

.command-shortcut {
  font-size: 10px;
  color: var(--color-blue-50);
  border: 1px solid rgb(var(--rgb-accent) / 0.3);
  background: rgb(var(--rgb-primary-light) / 0.12);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
}

.app-main > .min-h-screen {
  min-height: 100% !important;
}

/* Stats simplifiées (Alt+C) : cartes type mobile sur desktop */
html[data-stats-cards='1'] .statistics-mobile-sort-bar,
html[data-stats-cards='1'] .statistics-tab-pagination {
  display: flex !important;
  width: 100%;
  flex-basis: 100%;
  box-sizing: border-box;
}

html[data-stats-cards='1'] .statistics-tier-list-mobile-list,
html[data-stats-cards='1'] .statistics-champion-matchup-mobile-list,
html[data-stats-cards='1'] .statistics-champion-synergy-mobile-list,
html[data-stats-cards='1'] .statistics-objectives-mobile-list,
html[data-stats-cards='1'] .statistics-bans-mobile-list,
html[data-stats-cards='1'] .statistics-champion-mobile-list,
html[data-stats-cards='1'] .statistics-spells-mobile-list,
html[data-stats-cards='1'] .statistics-items-mobile-list,
html[data-stats-cards='1'] .statistics-balance-mobile-list,
html[data-stats-cards='1'] .statistics-infos-mobile-list,
html[data-stats-cards='1'] .statistics-surrender-mobile-list,
html[data-stats-cards='1'] .statistics-pings-mobile-list,
html[data-stats-cards='1'] .statistics-vision-mobile-list,
html[data-stats-cards='1'] .statistics-patch-notes-mobile-list {
  display: block !important;
}

html[data-stats-cards='1'] .tier-list-mobile-rotate,
html[data-stats-cards='1'] .champion-matchups-table-wrap,
html[data-stats-cards='1'] .champion-synergy-table-wrap,
html[data-stats-cards='1'] .statistics .hidden.md\:block,
html[data-stats-cards='1'] .champion-stats .hidden.md\:block {
  display: none !important;
}

/* Desktop + stats simplifiées : cartes taille standard en grille flex */
@media (min-width: 768px) {
  html[data-stats-cards='1'] {
    --stats-simplified-card-width: 18.5rem;
  }

  html[data-stats-cards='1']
    :is(
      .statistics-tier-list-mobile-list,
      .statistics-champion-matchup-mobile-list,
      .statistics-champion-synergy-mobile-list,
      .statistics-champion-mobile-list,
      .statistics-bans-mobile-list,
      .statistics-spells-mobile-list,
      .statistics-items-mobile-list,
      .statistics-balance-mobile-list,
      .statistics-infos-mobile-list,
      .statistics-objectives-mobile-list,
      .statistics-surrender-mobile-list,
      .statistics-pings-mobile-list,
      .statistics-vision-mobile-list,
      .statistics-misc-mobile-list,
      .statistics-patch-notes-mobile-list
    ) {
    display: flex !important;
    flex-flow: row wrap;
    align-items: stretch;
    align-content: flex-start;
    gap: 0.5rem;
    padding: 0.5rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  html[data-stats-cards='1']
    :is(
      .statistics-tier-list-mobile-list,
      .statistics-champion-matchup-mobile-list,
      .statistics-champion-synergy-mobile-list,
      .statistics-champion-mobile-list,
      .statistics-bans-mobile-list,
      .statistics-spells-mobile-list,
      .statistics-items-mobile-list,
      .statistics-balance-mobile-list,
      .statistics-infos-mobile-list,
      .statistics-objectives-mobile-list,
      .statistics-surrender-mobile-list,
      .statistics-pings-mobile-list,
      .statistics-vision-mobile-list,
      .statistics-misc-mobile-list,
      .statistics-patch-notes-mobile-list
    )
    > * {
    margin-top: 0 !important;
  }

  html[data-stats-cards='1']
    :is(
      .statistics-champion-stats-mobile-card,
      .statistics-champion-matchup-mobile-card,
      .statistics-champion-mobile-card,
      .statistics-ban-mobile-card,
      .statistics-spell-mobile-card,
      .statistics-item-mobile-card,
      .statistics-balance-mobile-card,
      .statistics-botlane-duo-mobile-card,
      .statistics-infos-mobile-card,
      .statistics-tier-list-mobile-card,
      .statistics-objectives-mobile-card,
      .statistics-surrender-mobile-card,
      .statistics-surrender-mobile-side-card,
      .statistics-pings-mobile-card,
      .statistics-vision-mobile-card,
      .statistics-misc-mobile-card,
      .statistics-patch-notes-mobile-card
    ) {
    width: var(--stats-simplified-card-width) !important;
    max-width: var(--stats-simplified-card-width) !important;
    min-width: 0;
    flex: 0 1 var(--stats-simplified-card-width);
    margin-left: 0 !important;
    margin-right: 0 !important;
    border-radius: 0.5rem !important;
    border: 1px solid rgb(var(--rgb-accent) / 0.55) !important;
    box-sizing: border-box;
  }

  html[data-stats-cards='1'] .champion-skills-cards-grid .champion-spell-order-card {
    width: auto !important;
    max-width: none !important;
    flex: unset !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    border-radius: 0.5rem !important;
    border: 1px solid rgb(var(--rgb-accent) / 0.55) !important;
    box-sizing: border-box;
  }

  html[data-stats-cards='1'] .statistics-surrender-mobile-card {
    padding: 0.75rem !important;
    background: rgb(8 16 31 / 0.45) !important;
    box-shadow: none !important;
  }

  html[data-stats-cards='1'] .statistics-surrender-mobile-rank-title {
    font-size: 1rem !important;
  }

  html[data-stats-cards='1'] .statistics-surrender-mobile-match-count-label {
    display: none;
  }

  html[data-stats-cards='1'] .statistics-surrender-details-title {
    display: none;
  }

  html[data-stats-cards='1'] .statistics-surrender-mobile-card .pie-chart-2 {
    height: 5.5rem !important;
    width: 5.5rem !important;
  }

  html[data-stats-cards='1'] .statistics-surrender-mobile-card-body {
    gap: 0.5rem !important;
    padding-top: 0.5rem !important;
  }

  html[data-stats-cards='1'] .statistics-objectives-mobile-list > li {
    width: var(--stats-simplified-card-width);
    max-width: var(--stats-simplified-card-width);
    flex: 0 1 var(--stats-simplified-card-width);
    margin: 0;
    border-radius: 0.5rem;
    box-sizing: border-box;
  }

  html[data-stats-cards='1']
    .champion-stats
    .champion-tab-panel-flush
    :is(.statistics-champion-matchup-mobile-card, .statistics-champion-stats-mobile-card) {
    border: 1px solid rgb(var(--rgb-accent) / 0.55) !important;
    border-radius: 0.5rem !important;
  }

  html[data-stats-cards='1']
    .champion-stats
    .champion-tab-panel-flush
    .statistics-champion-matchup-mobile-card
    + .statistics-champion-matchup-mobile-card,
  html[data-stats-cards='1']
    .champion-stats
    .champion-tab-panel-flush
    .statistics-champion-stats-mobile-card
    + .statistics-champion-stats-mobile-card {
    border-top-width: 1px !important;
  }
}

/* Horizontal scroll for tab bars on narrow viewports (stats-style) */
.scrollable-tabs-scroll-wrap,
.statistics-tabs-scroll-wrap,
.patch-notes-tabs-scroll-wrap {
  position: relative;
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.scrollable-tabs-nav,
.statistics-tabs-nav,
.patch-notes-tabs-nav {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
  touch-action: pan-x;
}

/* Scrollbar visible only when tabs overflow (class set by useHorizontalScrollContainer) */
.scrollable-tabs-nav.has-horizontal-scroll,
.statistics-tabs-nav.has-horizontal-scroll,
.patch-notes-tabs-nav.has-horizontal-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--rgb-accent) / 0.7) rgb(var(--rgb-primary) / 0.22);
  padding-bottom: 6px;
}

.scrollable-tabs-nav.has-horizontal-scroll::-webkit-scrollbar,
.statistics-tabs-nav.has-horizontal-scroll::-webkit-scrollbar,
.patch-notes-tabs-nav.has-horizontal-scroll::-webkit-scrollbar {
  display: block;
  height: 5px;
}

.scrollable-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-track,
.statistics-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-track,
.patch-notes-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-track {
  margin-top: 4px;
  border-radius: 9999px;
  background: rgb(var(--rgb-primary) / 0.22);
}

.scrollable-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb,
.statistics-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb,
.patch-notes-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: rgb(var(--rgb-accent) / 0.72);
}

.scrollable-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb:hover,
.statistics-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb:hover,
.patch-notes-tabs-nav.has-horizontal-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--rgb-accent) / 0.9);
}

.scrollable-tabs-nav.is-drag-scrolling,
.statistics-tabs-nav.is-drag-scrolling,
.patch-notes-tabs-nav.is-drag-scrolling {
  cursor: grabbing;
  scroll-snap-type: none;
  user-select: none;
}

.scrollable-tabs-nav:not(.has-horizontal-scroll)::-webkit-scrollbar,
.statistics-tabs-nav:not(.has-horizontal-scroll)::-webkit-scrollbar,
.patch-notes-tabs-nav:not(.has-horizontal-scroll)::-webkit-scrollbar {
  display: none;
}

.scrollable-tabs-scroll-wrap::before,
.scrollable-tabs-scroll-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  z-index: 2;
  pointer-events: none;
}

.scrollable-tabs-scroll-wrap::before {
  left: 0;
  background: linear-gradient(to right, rgb(8 16 31 / 0.92), transparent);
}

.scrollable-tabs-scroll-wrap::after {
  right: 0;
  background: linear-gradient(to left, rgb(8 16 31 / 0.92), transparent);
}

.scrollable-tabs-nav > * {
  flex-shrink: 0;
  scroll-snap-align: start;
  white-space: nowrap;
}

/* Pastilles colorées des icônes de stats (builder infos + onglet Divers). */
.stat-inline-icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  overflow: visible;
  align-items: center;
  justify-content: center;
  opacity: 1;
  border-radius: 9999px;
  transform: scale(2);
  transform-origin: center;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.24),
    0 0 8px rgb(255 255 255 / 0.14);
}

.stat-inline-icon--sm {
  transform: none;
}

.stat-inline-icon-image {
  width: 0.85rem;
  height: 0.85rem;
  object-fit: contain;
  filter: saturate(1.25) brightness(1.08) contrast(1.08);
}

.stat-inline-icon--sm .stat-inline-icon-image {
  width: 0.75rem;
  height: 0.75rem;
}

.stat-inline-icon-image--compact {
  width: calc(0.85rem - 2px);
  height: calc(0.85rem - 2px);
}

.stat-inline-icon--sm .stat-inline-icon-image--compact {
  width: calc(0.75rem - 2px);
  height: calc(0.75rem - 2px);
}

.stat-inline-icon--hp {
  background: rgb(22 255 117 / 0.52);
}

.stat-inline-icon--armor {
  background: rgb(191 107 28 / 0.54);
}

.stat-inline-icon--mana {
  background: rgb(66 220 255 / 0.52);
}

.stat-inline-icon--ap {
  background: rgb(182 77 255 / 0.52);
}

.stat-inline-icon--haste {
  background: rgb(255 255 255 / 0.5);
}

.stat-inline-icon--crit {
  background: rgb(255 44 44 / 0.56);
}

.stat-inline-icon--vamp {
  background: rgb(255 0 0 / 0.72);
}

.stat-inline-icon--ad {
  background: rgb(255 132 0 / 0.58);
}

.stat-inline-icon--as {
  background: rgb(255 231 43 / 0.62);
}

.stat-inline-icon--gold {
  background: rgb(255 196 25 / 0.62);
}

.stat-inline-icon--mr {
  background: rgb(232 224 255 / 0.62);
}

.stat-inline-icon--tenacity {
  background: rgb(88 28 135 / 0.72);
}

.stat-inline-icon--arpen {
  background: rgb(127 29 29 / 0.74);
}

.stat-inline-icon--shield {
  background: rgb(220 252 231 / 0.62);
}

.stat-inline-icon--default {
  background: rgb(148 163 184 / 0.38);
}

.has-mobile-tab-bar {
  padding-bottom: calc(var(--app-mobile-tab-bar-height, 0px) + env(safe-area-inset-bottom, 0px));
}

@media (max-width: 768px) {
  .has-mobile-tab-bar .statistics-filters-fab {
    bottom: calc(
      var(--app-mobile-tab-bar-height, 3.5rem) + 1rem + env(safe-area-inset-bottom, 0px)
    );
  }

  .has-mobile-tab-bar .statistics-mobile-view-toast {
    bottom: calc(
      var(--app-mobile-tab-bar-height, 3.5rem) + 5rem + env(safe-area-inset-bottom, 0px)
    );
  }
}
</style>
