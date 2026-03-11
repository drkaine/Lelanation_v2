<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
    >
      Skip to content
    </a>
    <template v-if="!isStreamerMode">
      <AppNavbar />
      <div class="tooltips-toggle-bar">
        <label class="tooltips-toggle-label">
          <input
            type="checkbox"
            :checked="tooltipsDisabled"
            class="tooltips-toggle-checkbox"
            @change="toggleTooltipsDisabled()"
          />
          <span>{{ t('nav.disableTooltips') }}</span>
        </label>
        <span class="tooltips-toggle-shortcut">Alt + T</span>
      </div>
    </template>
    <template v-else>
      <div class="streamer-panel streamer-panel-top" :class="{ 'is-open': streamerNavOpen }">
        <AppNavbar />
      </div>
      <button
        type="button"
        class="streamer-toggle streamer-toggle-top"
        :class="{ 'streamer-toggle-top-open': streamerNavOpen }"
        :title="streamerNavOpen ? 'Masquer la navigation' : 'Afficher la navigation'"
        @click="streamerNavOpen = !streamerNavOpen"
      >
        {{ streamerNavOpen ? '▴' : '▾' }}
      </button>
    </template>
    <main id="main" tabindex="-1">
      <NuxtPage />
    </main>
    <template v-if="!isStreamerMode && !isAdminRoute">
      <AppFooter />
    </template>
    <template v-else-if="isStreamerMode">
      <div class="streamer-panel streamer-panel-bottom" :class="{ 'is-open': streamerFooterOpen }">
        <AppFooter />
      </div>
      <button
        type="button"
        class="streamer-toggle streamer-toggle-bottom"
        :class="{ 'streamer-toggle-bottom-open': streamerFooterOpen }"
        :title="streamerFooterOpen ? 'Masquer le footer' : 'Afficher le footer'"
        @click="streamerFooterOpen = !streamerFooterOpen"
      >
        {{ streamerFooterOpen ? '▾' : '▴' }}
      </button>
    </template>
    <CookieConsentBanner />
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'
import AppFooter from '~/components/AppFooter.vue'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'

const { t } = useI18n()
const route = useRoute()
const localeHead = useLocaleHead({ addDirAttribute: true, addSeoAttributes: true } as any)
const { isStreamerMode } = useStreamerMode()
const { tooltipsDisabled, tooltipsEnabled, toggleTooltipsDisabled } = useTooltipsPreference()
const streamerNavOpen = useState<boolean>('streamer-nav-open', () => false)
const streamerFooterOpen = useState<boolean>('streamer-footer-open', () => false)

const isAdminRoute = computed(() => String(route.path).includes('/admin'))

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
  }
})

const onKeyDown = (event: KeyboardEvent) => {
  if (event.altKey && event.key === 't' && !isStreamerMode.value) {
    event.preventDefault()
    toggleTooltipsDisabled()
  }
}

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
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
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid rgb(var(--rgb-accent) / 0.6);
  background: rgb(var(--rgb-background) / 0.55);
  color: rgb(var(--rgb-accent) / 0.9);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 10px rgb(0 0 0 / 35%);
  transition:
    bottom 0.25s ease,
    top 0.25s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.streamer-toggle:hover {
  background: rgb(var(--rgb-background) / 0.75);
  transform: scale(1.04);
}

.streamer-toggle-top {
  top: 0;
}

.streamer-toggle-bottom {
  bottom: 0;
}

.streamer-toggle-top-open {
  top: 66px;
}

.streamer-toggle-bottom-open {
  bottom: 66px;
}

.tooltips-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 3px 16px;
  background: rgb(var(--rgb-background) / 0.85);
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.15);
  font-size: 11px;
  color: rgb(var(--rgb-text) / 0.6);
}

.tooltips-toggle-label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
}

.tooltips-toggle-checkbox {
  width: 12px;
  height: 12px;
  cursor: pointer;
  accent-color: rgb(var(--rgb-accent));
}

.tooltips-toggle-shortcut {
  font-size: 10px;
  color: rgb(var(--rgb-accent) / 0.5);
  border: 1px solid rgb(var(--rgb-accent) / 0.3);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
}
</style>
