<template>
  <div class="build-creator min-h-screen text-text">
    <div class="mx-auto max-w-8xl px-2">
      <div class="mb-3">
        <component
          :is="buildMenuStepsComponent"
          :current-step="'champion'"
          :has-champion="hasChampion"
        />
      </div>

      <div
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <div class="builder-selector-col w-full flex-1 md:order-2">
          <component :is="championSelectorComponent" />
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

      <div v-if="pendingChampionChange" class="champion-confirm-overlay" @click.self="emit('cancel-champion-change')">
        <div class="champion-confirm-modal">
          <p class="champion-confirm-title">{{ confirmTitle }}</p>
          <p class="champion-confirm-body">
            {{ confirmBody }}
          </p>
          <div class="champion-confirm-actions">
            <button class="btn-cancel" @click="emit('cancel-champion-change')">{{ cancelLabel }}</button>
            <button class="btn-confirm" @click="emit('confirm-champion-change')">
              {{ confirmLabel }}
            </button>
          </div>
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
  pendingChampionChange: boolean
  confirmTitle: string
  confirmBody: string
  cancelLabel: string
  confirmLabel: string
  championSelectorComponent: Component | string
  buildCardComponent: Component | string
  buildSaveButtonComponent: Component | string
  buildMenuStepsComponent: Component | string
}>()

const emit = defineEmits<{
  'highlight-missing': [value: boolean]
  'cancel-champion-change': []
  'confirm-champion-change': []
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

.champion-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.champion-confirm-modal {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  border: 1px solid rgba(200, 155, 60, 0.6);
  background:
    radial-gradient(circle at top, rgba(200, 155, 60, 0.18), transparent 55%), rgba(9, 14, 28, 0.96);
  padding: 20px 22px 18px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.75);
}

.champion-confirm-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #f0e6d2;
}

.champion-confirm-body {
  margin: 0 0 14px;
  font-size: 13px;
  color: rgba(240, 230, 210, 0.8);
}

.champion-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: transparent;
  color: rgba(240, 230, 210, 0.85);
  border-color: rgba(148, 163, 184, 0.7);
}

.btn-cancel:hover {
  border-color: rgba(200, 155, 60, 0.7);
  color: #f0e6d2;
}

.btn-confirm {
  background: rgba(220, 38, 38, 0.85);
  color: #fee2e2;
  border-color: rgba(248, 113, 113, 0.9);
}

.btn-confirm:hover {
  background: rgba(220, 38, 38, 0.95);
  border-color: rgba(248, 113, 113, 1);
}
</style>
