<template>
  <Teleport to="body">
    <div v-if="open" class="command-shortcuts-modal" role="presentation">
      <div class="command-shortcuts-modal__backdrop" aria-hidden="true" @click="emit('close')" />

      <div
        class="command-shortcuts-modal__dialog ui-build-card-surface"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-primary/25 px-4 py-3 md:px-6"
        >
          <h2 :id="titleId" class="text-lg font-semibold text-text-accent md:text-xl">
            {{ t('commandBar.shortcutsModalTitle') }}
          </h2>
          <button
            type="button"
            class="ui-build-card-button inline-flex shrink-0 items-center justify-center rounded-md p-2"
            :aria-label="t('commandBar.close')"
            @click="emit('close')"
          >
            <Icon name="mdi:close" size="22" />
          </button>
        </header>

        <div class="command-shortcuts-modal__body px-4 py-5 md:px-6 md:py-6">
          <div class="grid gap-8 md:grid-cols-2 md:gap-10">
            <section>
              <h3 class="command-shortcuts-modal__section-title">
                {{ t('commandBar.togglesSection') }}
              </h3>
              <div class="flex flex-col gap-2">
                <label
                  class="command-shortcuts-toggle ui-build-card-surface flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    :checked="tooltipsDisabled"
                    class="command-toggle-checkbox"
                    @change="emit('toggle-tooltips')"
                  />
                  <span class="command-toggle-track shrink-0" :class="{ active: tooltipsDisabled }">
                    <span class="command-toggle-thumb" />
                  </span>
                  <span class="min-w-0 flex-1 text-sm text-text/90">{{
                    t('nav.disableTooltips')
                  }}</span>
                  <kbd class="command-modal-kbd shrink-0">Alt + T</kbd>
                </label>

                <button
                  v-for="toggle in toggleRows"
                  :key="toggle.id"
                  type="button"
                  class="command-shortcuts-toggle ui-build-card-surface flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                  :aria-pressed="toggle.active"
                  @click="toggle.onClick()"
                >
                  <span class="command-toggle-track shrink-0" :class="{ active: toggle.active }">
                    <span class="command-toggle-thumb" />
                  </span>
                  <span class="min-w-0 flex-1 text-sm text-text/90">{{ toggle.label }}</span>
                  <kbd class="command-modal-kbd shrink-0">{{ toggle.keys }}</kbd>
                </button>
              </div>
            </section>

            <section>
              <h3 class="command-shortcuts-modal__section-title">
                {{ t('commandBar.shortcutsSection') }}
              </h3>
              <div class="flex flex-col gap-2">
                <ShortcutRow
                  v-for="row in shortcutRows"
                  :key="row.keys"
                  :keys="row.keys"
                  :label="row.label"
                />
              </div>
              <p class="command-shortcuts-modal__help mt-5">
                {{ t('commandBar.builderLabel') }}:
                <kbd class="command-modal-kbd">Ctrl + ←</kbd>
                {{ t('commandBar.previousStep') }},
                <kbd class="command-modal-kbd">Ctrl + →</kbd>
                {{ t('commandBar.nextStep') }}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ShortcutRow from '~/components/Information/ShortcutRow.vue'

const props = defineProps<{
  open: boolean
  tooltipsDisabled: boolean
  streamerMode: boolean
  presentationZoom: boolean
  championSplash: boolean
  simplifiedStats: boolean
  splitTransformStats: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-tooltips': []
  'toggle-streamer': []
  'toggle-presentation-zoom': []
  'toggle-champion-splash': []
  'toggle-simplified-stats': []
  'toggle-split-transform-stats': []
}>()

const { t } = useI18n()
const titleId = 'command-shortcuts-modal-title'

const toggleRows = computed(() => [
  {
    id: 'streamer',
    label: t('footer.presentationMode'),
    keys: 'Alt + P',
    active: props.streamerMode,
    onClick: () => emit('toggle-streamer'),
  },
  {
    id: 'presentation-zoom',
    label: t('commandBar.presentationZoom'),
    keys: 'Alt + Z',
    active: props.presentationZoom,
    onClick: () => emit('toggle-presentation-zoom'),
  },
  {
    id: 'champion-splash',
    label: t('commandBar.championSplash'),
    keys: 'Alt + S',
    active: props.championSplash,
    onClick: () => emit('toggle-champion-splash'),
  },
  {
    id: 'simplified-stats',
    label: t('commandBar.simplifiedStats'),
    keys: 'Alt + C',
    active: props.simplifiedStats,
    onClick: () => emit('toggle-simplified-stats'),
  },
  {
    id: 'split-transform-stats',
    label: t('commandBar.splitTransformStats'),
    keys: 'Shift + T',
    active: props.splitTransformStats,
    onClick: () => emit('toggle-split-transform-stats'),
  },
])

const shortcutRows = computed(() => [
  { keys: 'Alt + H', label: t('commandBar.openShortcutsModal') },
  { keys: 'Alt + T', label: t('nav.disableTooltips') },
  { keys: 'Alt + P', label: t('footer.presentationMode') },
  { keys: 'Alt + Z', label: t('commandBar.presentationZoom') },
  { keys: 'Alt + S', label: t('commandBar.championSplash') },
  { keys: 'Alt + C', label: t('commandBar.simplifiedStats') },
  { keys: 'Shift + T', label: t('commandBar.splitTransformStats') },
])

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
.command-shortcuts-modal {
  position: fixed;
  inset: 0;
  z-index: 10060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.command-shortcuts-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.55);
}

.command-shortcuts-modal__dialog {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 56rem;
  max-height: min(90vh, 900px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.75rem;
}

.command-shortcuts-modal__body {
  min-height: 0;
  overflow-y: auto;
}

.command-shortcuts-modal__section-title {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

@media (min-width: 768px) {
  .command-shortcuts-modal__section-title {
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
}

.command-shortcuts-toggle {
  border-width: 2px;
  transition:
    box-shadow 0.2s ease,
    color 0.2s ease;
}

.command-shortcuts-toggle:hover {
  box-shadow: 0 4px 14px var(--card-border-color-soft-default);
}

.command-modal-kbd {
  display: inline-block;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 6px;
  background: rgb(0 0 0 / 0.25);
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-gold-300);
  white-space: nowrap;
}

.command-shortcuts-modal__help {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.72);
}

@media (min-width: 768px) {
  .command-shortcuts-modal__help {
    font-size: 0.875rem;
  }
}
</style>
