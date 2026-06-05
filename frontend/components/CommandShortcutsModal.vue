<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="command-shortcuts-modal fixed inset-0 z-[10060] flex flex-col bg-background text-text"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div class="flex items-center justify-between border-b border-primary/25 px-6 py-4 md:px-10">
        <h2 :id="titleId" class="text-xl font-semibold text-text-accent md:text-2xl">
          {{ t('commandBar.shortcutsModalTitle') }}
        </h2>
        <button
          type="button"
          class="rounded p-2 text-text/60 transition-colors hover:bg-primary/20 hover:text-text"
          :aria-label="t('commandBar.close')"
          @click="emit('close')"
        >
          <Icon name="mdi:close" size="24" />
        </button>
      </div>

      <div
        class="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-8 md:px-10 md:py-10"
      >
        <div class="grid gap-10 md:grid-cols-2 md:gap-14">
          <section>
            <h3
              class="mb-4 text-sm font-semibold uppercase tracking-wide text-text/70 md:mb-5 md:text-base"
            >
              {{ t('commandBar.togglesSection') }}
            </h3>
            <div class="flex flex-col gap-3">
              <label class="command-toggle command-toggle-modal">
                <input
                  type="checkbox"
                  :checked="tooltipsDisabled"
                  class="command-toggle-checkbox"
                  @change="emit('toggle-tooltips')"
                />
                <span class="command-toggle-track" :class="{ active: tooltipsDisabled }">
                  <span class="command-toggle-thumb" />
                </span>
                <span class="min-w-0 flex-1">{{ t('nav.disableTooltips') }}</span>
                <span class="command-shortcut shrink-0">Alt + T</span>
              </label>
              <button
                type="button"
                class="command-toggle command-toggle-button command-toggle-modal"
                :aria-pressed="streamerMode"
                @click="emit('toggle-streamer')"
              >
                <span class="command-toggle-track" :class="{ active: streamerMode }">
                  <span class="command-toggle-thumb" />
                </span>
                <span class="min-w-0 flex-1">{{ t('footer.presentationMode') }}</span>
                <span class="command-shortcut shrink-0">Alt + P</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button command-toggle-modal"
                :aria-pressed="presentationZoom"
                @click="emit('toggle-presentation-zoom')"
              >
                <span class="command-toggle-track" :class="{ active: presentationZoom }">
                  <span class="command-toggle-thumb" />
                </span>
                <span class="min-w-0 flex-1">{{ t('commandBar.presentationZoom') }}</span>
                <span class="command-shortcut shrink-0">Alt + Z</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button command-toggle-modal"
                :aria-pressed="championSplash"
                @click="emit('toggle-champion-splash')"
              >
                <span class="command-toggle-track" :class="{ active: championSplash }">
                  <span class="command-toggle-thumb" />
                </span>
                <span class="min-w-0 flex-1">{{ t('commandBar.championSplash') }}</span>
                <span class="command-shortcut shrink-0">Alt + S</span>
              </button>
              <button
                type="button"
                class="command-toggle command-toggle-button command-toggle-modal"
                :aria-pressed="simplifiedStats"
                @click="emit('toggle-simplified-stats')"
              >
                <span class="command-toggle-track" :class="{ active: simplifiedStats }">
                  <span class="command-toggle-thumb" />
                </span>
                <span class="min-w-0 flex-1">{{ t('commandBar.simplifiedStats') }}</span>
                <span class="command-shortcut shrink-0">Alt + C</span>
              </button>
            </div>
          </section>

          <section>
            <h3
              class="mb-4 text-sm font-semibold uppercase tracking-wide text-text/70 md:mb-5 md:text-base"
            >
              {{ t('commandBar.shortcutsSection') }}
            </h3>
            <ul class="command-shortcuts-list">
              <li>
                <span class="command-shortcut">Alt + H</span>
                {{ t('commandBar.openShortcutsModal') }}
              </li>
              <li><span class="command-shortcut">Alt + T</span> {{ t('nav.disableTooltips') }}</li>
              <li>
                <span class="command-shortcut">Alt + P</span> {{ t('footer.presentationMode') }}
              </li>
              <li>
                <span class="command-shortcut">Alt + Z</span>
                {{ t('commandBar.presentationZoom') }}
              </li>
              <li>
                <span class="command-shortcut">Alt + S</span> {{ t('commandBar.championSplash') }}
              </li>
              <li>
                <span class="command-shortcut">Alt + C</span> {{ t('commandBar.simplifiedStats') }}
              </li>
            </ul>
            <p class="command-help mt-6">
              {{ t('commandBar.builderLabel') }}:
              <span class="command-shortcut">Ctrl + ←</span>
              {{ t('commandBar.previousStep') }},
              <span class="command-shortcut">Ctrl + →</span>
              {{ t('commandBar.nextStep') }}
            </p>
            <p class="command-help mt-3">
              <span class="command-shortcut">Ctrl + ↓</span> {{ t('commandBar.showBar') }},
              <span class="command-shortcut">Ctrl + ↑</span> {{ t('commandBar.hideBar') }}
            </p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  tooltipsDisabled: boolean
  streamerMode: boolean
  presentationZoom: boolean
  championSplash: boolean
  simplifiedStats: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-tooltips': []
  'toggle-streamer': []
  'toggle-presentation-zoom': []
  'toggle-champion-splash': []
  'toggle-simplified-stats': []
}>()

const { t } = useI18n()
const titleId = 'command-shortcuts-modal-title'

function onEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.open) return
  event.preventDefault()
  emit('close')
}

watch(
  () => props.open,
  isOpen => {
    if (!import.meta.client) return
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
)

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('keydown', onEscapeKey)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('keydown', onEscapeKey)
  if (props.open) document.body.style.overflow = ''
})
</script>

<style scoped>
.command-toggle-modal {
  width: 100%;
  justify-content: flex-start;
  border-radius: 8px;
  padding: 10px 12px;
}

.command-shortcuts-modal .command-shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: rgb(var(--rgb-text) / 0.9);
}

@media (min-width: 768px) {
  .command-shortcuts-modal .command-shortcuts-list {
    gap: 12px;
    font-size: 15px;
  }
}

.command-shortcuts-modal .command-shortcuts-list li {
  display: flex;
  align-items: center;
  gap: 12px;
}

.command-shortcuts-modal .command-help {
  margin: 0;
  font-size: 13px;
  color: rgb(var(--rgb-text) / 0.75);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (min-width: 768px) {
  .command-shortcuts-modal .command-help {
    font-size: 14px;
  }
}
</style>
