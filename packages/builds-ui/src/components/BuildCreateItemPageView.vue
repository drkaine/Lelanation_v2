<template>
  <div class="build-creator min-h-screen text-text">
    <div class="mx-auto max-w-8xl px-2">
      <div class="mb-3">
        <component :is="buildMenuStepsComponent" :current-step="'item'" :has-champion="hasChampion" />
      </div>

      <div
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <div class="builder-selector-col w-full flex-1 md:order-2">
          <component :is="itemSelectorComponent" />
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
  itemSelectorComponent: Component | string
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

.build-layout {
  --build-card-width: 293.9px;
}

.build-layout--streamer {
  --build-card-width: 390px;
}

.build-card-wrapper {
  width: var(--build-card-width);
  margin-top: 0;
}

.builder-selector-col {
  align-self: flex-start;
}

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
