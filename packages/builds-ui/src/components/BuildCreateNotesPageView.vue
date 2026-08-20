<template>
  <div class="build-creator min-h-screen text-text">
    <div :class="fullWidth ? 'w-full px-3 sm:px-5 lg:px-6' : 'mx-auto max-w-8xl px-2'">
      <div class="mb-3">
        <component :is="buildMenuStepsComponent" :current-step="'notes'" :has-champion="hasChampion" />
      </div>

      <div
        class="build-layout mb-3 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <div class="w-full flex-1 md:order-2">
          <component :is="buildNotesEditorComponent" />
        </div>

        <div class="build-card-column w-full flex-shrink-0 md:order-1">
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
  buildCardComponent: Component | string
  buildSaveButtonComponent: Component | string
  buildNotesEditorComponent: Component | string
  buildMenuStepsComponent: Component | string
  fullWidth?: boolean
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

.build-card-column {
  width: min(var(--build-card-width), 100%);
}

@media (min-width: 768px) {
  .build-card-column {
    width: var(--build-card-width);
  }
}
</style>
