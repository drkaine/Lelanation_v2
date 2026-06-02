<template>
  <div class="build-creator min-h-screen text-text">
    <div class="mx-auto max-w-8xl px-2">
      <div class="mb-3">
        <component :is="buildMenuStepsComponent" :current-step="'rune'" :has-champion="hasChampion" />
      </div>

      <div
        class="rune-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'rune-layout--streamer': isStreamerMode }"
      >
        <div class="builder-selector-col w-full flex-1 md:order-2">
          <div class="runes-step-content">
            <component :is="runeSelectorComponent" />
          </div>
        </div>

        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <component :is="buildSaveButtonComponent" @highlight-missing="emit('highlight-missing', $event)" />
          <component
            :is="buildCardComponent"
            :sheet-tooltips="true"
            :highlight-missing-fields="highlightMissingFields"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  isStreamerMode: boolean
  hasChampion: boolean
  highlightMissingFields: boolean
  runeSelectorComponent: Component | string
  buildCardComponent: Component | string
  buildSaveButtonComponent: Component | string
  buildMenuStepsComponent: Component | string
}>()

const emit = defineEmits<{
  'highlight-missing': [value: boolean]
}>()
</script>

<style scoped>
.build-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.rune-layout {
  --rune-card-width: 300px;
  --rune-card-height: 450px;
  --rune-selector-scale: 1.3;
}

.rune-layout--streamer {
  --rune-card-width: 390px;
  --rune-card-height: 585px;
  --rune-selector-scale: 1.3;
}

.build-card-wrapper {
  width: var(--rune-card-width);
  margin-top: 0;
}

.builder-selector-col {
  align-self: flex-start;
}

@media (min-width: 768px) {
  .rune-layout {
    align-items: flex-start;
  }

  .runes-step-content {
    min-height: 0;
    --selector-path-size: calc(44px * var(--rune-selector-scale));
    --selector-rune-size: calc(48px * var(--rune-selector-scale));
    --selector-square-size: calc(48px * var(--rune-selector-scale));
    --selector-gap-size: calc(0.25rem * var(--rune-selector-scale));
  }

  .runes-step-content :deep(.paths-container) {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .rune-layout--streamer {
    --rune-card-width: calc(100vw - 1.5rem);
  }

  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
