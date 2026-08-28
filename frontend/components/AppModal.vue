<template>
  <Teleport to="body">
    <div v-if="open" class="app-modal" :style="{ zIndex }" role="presentation">
      <div class="app-modal__backdrop" aria-hidden="true" @click="onBackdropClick" />

      <div
        class="app-modal__dialog ui-build-card-surface"
        :class="[sizeClass, dialogClass]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        @click.stop
      >
        <header v-if="title || $slots.header || showClose" class="app-modal__header">
          <div class="min-w-0 flex-1">
            <slot name="header">
              <h2 :id="titleId" class="app-modal__title">{{ title }}</h2>
              <p v-if="subtitle" class="app-modal__subtitle">{{ subtitle }}</p>
            </slot>
          </div>
          <button
            v-if="showClose"
            type="button"
            class="ui-build-card-button inline-flex shrink-0 items-center justify-center rounded-md p-2"
            :aria-label="closeLabel"
            @click="emit('close')"
          >
            <Icon name="mdi:close" size="22" />
          </button>
        </header>

        <div
          class="app-modal__body"
          :class="[{ 'app-modal__body--scroll': scrollable }, bodyClass]"
        >
          <slot />
        </div>

        <footer v-if="$slots.footer" class="app-modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closeOnBackdrop?: boolean
    showClose?: boolean
    closeLabel?: string
    scrollable?: boolean
    zIndex?: number
    dialogClass?: string
    bodyClass?: string
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    size: 'md',
    closeOnBackdrop: true,
    showClose: true,
    closeLabel: 'Fermer',
    scrollable: false,
    zIndex: 10050,
    dialogClass: '',
    bodyClass: '',
  }
)

const emit = defineEmits<{
  close: []
}>()

const titleId = `app-modal-title-${Math.random().toString(36).slice(2, 9)}`

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'app-modal__dialog--sm'
  if (props.size === 'lg') return 'app-modal__dialog--lg'
  if (props.size === 'xl') return 'app-modal__dialog--xl'
  return 'app-modal__dialog--md'
})

function onBackdropClick() {
  if (props.closeOnBackdrop) emit('close')
}

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
.app-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.app-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.6);
  backdrop-filter: blur(2px);
}

.app-modal__dialog {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-height: min(90vh, 900px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.75rem;
}

.app-modal__dialog--sm {
  max-width: 28rem;
}

.app-modal__dialog--md {
  max-width: 32rem;
}

.app-modal__dialog--lg {
  max-width: 48rem;
}

.app-modal__dialog--xl {
  max-width: 56rem;
}

.app-modal__header {
  display: flex;
  shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.25);
  padding: 0.875rem 1rem;
}

@media (min-width: 768px) {
  .app-modal__header {
    padding: 1rem 1.5rem;
  }
}

.app-modal__title {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-gold-300);
}

@media (min-width: 768px) {
  .app-modal__title {
    font-size: 1.25rem;
  }
}

.app-modal__subtitle {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.4;
  color: rgb(var(--rgb-text) / 0.7);
}

.app-modal__body {
  min-height: 0;
  padding: 1rem;
}

@media (min-width: 768px) {
  .app-modal__body {
    padding: 1.25rem 1.5rem;
  }
}

.app-modal__body--scroll {
  overflow-y: auto;
}

.app-modal__footer {
  display: flex;
  shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid rgb(var(--rgb-primary) / 0.25);
  padding: 0.75rem 1rem;
}

@media (min-width: 768px) {
  .app-modal__footer {
    padding: 0.875rem 1.5rem;
  }
}
</style>
