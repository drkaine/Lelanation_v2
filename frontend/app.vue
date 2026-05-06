<template>
  <div class="flex min-h-screen flex-col" :style="appShellVars">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
    >
      Skip to content
    </a>
    <AppNavbar v-show="!isStreamerMode && !isBuildCardRenderRoute" />
    <div
      v-show="
        !isStreamerMode && !isBuildCardRenderRoute && (isHomeRoute || !commandBarHiddenByScroll)
      "
      class="command-bar-fixed-wrapper"
    >
      <button
        v-show="!isHomeRoute && commandsCollapsed"
        type="button"
        class="command-collapse-floating"
        title="Afficher les commandes"
        :aria-expanded="false"
        @click="commandsCollapsed = false"
      >
        ▾
      </button>
      <div
        v-show="isHomeRoute || !commandsCollapsed"
        ref="commandBarRef"
        class="command-bar-overlay"
      >
        <div
          class="command-bar"
          :class="{ 'command-bar-collapsed': !isHomeRoute && commandsCollapsed }"
        >
          <div v-show="!commandsCollapsed" class="command-bar-content">
            <p class="command-help" aria-live="polite">
              {{ t('commandBar.builderLabel') }}: <span class="command-shortcut">Ctrl + ←</span>
              {{ t('commandBar.previousStep') }}, <span class="command-shortcut">Ctrl + →</span>
              {{ t('commandBar.nextStep') }}
              <span class="command-help-separator">|</span>
              <span class="command-shortcut">Ctrl + ↓</span> {{ t('commandBar.showBar') }},
              <span class="command-shortcut">Ctrl + ↑</span> {{ t('commandBar.hideBar') }}
            </p>
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
              <span class="command-shortcut">Alt + T</span>
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
              <span class="command-shortcut">Alt + P</span>
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
              <span class="command-shortcut">Alt + Z</span>
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
              <span class="command-shortcut">Alt + S</span>
            </button>
          </div>
          <button
            v-if="!isHomeRoute"
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
    <div
      v-show="!isStreamerMode && !isBuildCardRenderRoute"
      class="command-bar-spacer"
      aria-hidden="true"
    ></div>
    <div
      v-show="isStreamerMode"
      class="streamer-panel streamer-panel-top"
      :class="{ 'is-open': streamerPanelsOpen }"
    >
      <AppNavbar />
    </div>
    <button
      v-show="isStreamerMode"
      type="button"
      class="streamer-toggle streamer-toggle-top"
      :class="{ 'streamer-toggle-top-open': streamerPanelsOpen }"
      :title="streamerPanelsOpen ? 'Masquer la navigation' : 'Afficher la navigation'"
      @click="toggleStreamerPanels()"
    >
      {{ streamerPanelsOpen ? '▴' : '▾' }}
    </button>
    <main id="main" tabindex="-1" class="app-main flex-1">
      <NuxtPage />
    </main>
    <AppFooter v-show="!isStreamerMode && !isAdminRoute && !isBuildCardRenderRoute" />
    <div
      v-show="isStreamerMode"
      class="streamer-panel streamer-panel-bottom"
      :class="{ 'is-open': streamerPanelsOpen }"
    >
      <AppFooter />
    </div>
    <CookieConsentBanner v-show="!isBuildCardRenderRoute" />
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'
import AppFooter from '~/components/AppFooter.vue'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'
import { usePresentationZoom } from '~/composables/usePresentationZoom'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const localeHead = useLocaleHead({ addDirAttribute: true, addSeoAttributes: true } as any)
const { isStreamerMode, toggleStreamerMode } = useStreamerMode()
const { isPresentationZoom, togglePresentationZoom } = usePresentationZoom()
const { isLayoutScaled } = useLayoutScaled()
const { tooltipsDisabled, tooltipsEnabled, setTooltipsDisabled, toggleTooltipsDisabled } =
  useTooltipsPreference()
const { championSplashEnabled, toggleChampionSplashEnabled } = useChampionSplashPreference()
const streamerNavOpen = useState<boolean>('streamer-nav-open', () => false)
const streamerFooterOpen = useState<boolean>('streamer-footer-open', () => false)
const streamerPanelsOpen = computed(() => streamerNavOpen.value && streamerFooterOpen.value)
const commandsCollapsed = useState<boolean>('commands-collapsed', () => true)
const commandBarRef = ref<HTMLElement | null>(null)
const commandBarHiddenByScroll = ref(false)
const COMMAND_BAR_SCROLL_THRESHOLD = 80

const appShellVars = computed(() => ({
  '--build-create-page-padding-top': !isLayoutScaled.value ? '6px' : '1rem',
  '--build-create-card-top-gap': '11px',
  '--build-create-page-lift': '0px',
  '--build-page-padding-top': !isLayoutScaled.value ? '6px' : '1rem',
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
const isHomeRoute = computed(() => {
  const path = String(route.path || '').replace(/\/+$/, '') || '/'
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return true
  if (segments.length !== 1) return false
  return ['fr', 'en'].includes(segments[0] || '')
})

provide('tooltipsEnabled', tooltipsEnabled)

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: localeHead.value.meta,
}))

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
    if (!isEditableTarget && !isHomeRoute.value) {
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

  if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

  if (isEditableTarget) return

  const statisticsRootMatch = String(route.path).match(/^\/(?:fr\/|en\/)?statistics\/?$/)
  if (statisticsRootMatch) {
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
      'infos',
    ] as const
    const currentTabRaw = route.query.tab
    const currentTab = typeof currentTabRaw === 'string' ? currentTabRaw : 'overview'
    const currentIndex = tabOrder.includes(currentTab as (typeof tabOrder)[number])
      ? tabOrder.indexOf(currentTab as (typeof tabOrder)[number])
      : 0
    const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex >= 0 && nextIndex < tabOrder.length) {
      event.preventDefault()
      const nextTab = tabOrder[nextIndex]!
      const nextQuery = { ...route.query } as Record<string, string>
      if (nextTab === 'overview') {
        delete nextQuery.tab
      } else {
        nextQuery.tab = nextTab
      }
      router.push(localePath({ path: '/statistics', query: nextQuery }))
    }
    return
  }

  const match = String(route.path).match(/\/builds\/create\/(champion|rune|item|info)(?:\/|$)/)
  if (!match) return

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
}

const onDocumentPointerDown = (event: MouseEvent) => {
  if (isHomeRoute.value) return
  if (commandsCollapsed.value) return
  const target = event.target as Node | null
  if (!target) return
  if (commandBarRef.value?.contains(target)) return
  commandsCollapsed.value = true
}

function onWindowScroll() {
  if (!import.meta.client) return
  if (isHomeRoute.value) {
    commandBarHiddenByScroll.value = false
    return
  }
  commandBarHiddenByScroll.value = window.scrollY > COMMAND_BAR_SCROLL_THRESHOLD
}

watch(
  isHomeRoute,
  isHome => {
    if (isHome) {
      commandsCollapsed.value = false
      commandBarHiddenByScroll.value = false
      return
    }
    commandsCollapsed.value = true
    commandBarHiddenByScroll.value = false
    if (import.meta.client) onWindowScroll()
  },
  { immediate: true }
)

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onDocumentPointerDown)
    window.addEventListener('scroll', onWindowScroll, { passive: true })
    onWindowScroll()
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('mousedown', onDocumentPointerDown)
    window.removeEventListener('scroll', onWindowScroll)
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

.command-bar-fixed-wrapper {
  position: fixed;
  top: 50px;
  left: 0;
  right: 0;
  z-index: 55;
  min-height: 24px;
  pointer-events: none;
}

.command-bar-fixed-wrapper > * {
  pointer-events: auto;
}

.command-bar-spacer {
  height: 0;
  flex-shrink: 0;
}

.command-bar-overlay {
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  padding: 0 6px;
  pointer-events: none;
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
  pointer-events: auto;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1;
}

.command-help {
  margin: 0;
  font-size: 10px;
  color: rgb(var(--rgb-text) / 0.75);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .command-help {
    display: none;
  }
}

.command-help-separator {
  opacity: 0.55;
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
  top: 0;
  right: 6px;
  left: auto;
  z-index: 56;
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
</style>
