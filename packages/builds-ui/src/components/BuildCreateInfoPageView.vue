<template>
  <div class="build-creator min-h-screen text-text">
    <div :class="fullWidth ? 'w-full px-3 sm:px-5 lg:px-6' : 'mx-auto max-w-8xl px-2'">
      <div class="mb-3">
        <component :is="buildMenuStepsComponent" :current-step="'info'" :has-champion="hasChampion" />
      </div>

      <div
        class="build-layout mb-3 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <div class="w-full flex-1 md:order-2">
          <div class="info-toolbar mb-6">
            <div class="scrollable-tabs-scroll-wrap min-w-0 max-w-full flex-1">
              <div class="ui-build-card-surface info-toolbar-category-tabs scrollable-tabs-nav rounded-xl p-0.5">
              <button
                type="button"
                class="info-stats-tab ui-build-card-button"
                :class="{ 'is-active': statsCategory === 'basic' }"
                @click="emit('update:stats-category', 'basic')"
              >
                {{ basicLabel }}
              </button>
              <button
                type="button"
                class="info-stats-tab ui-build-card-button"
                :class="{ 'is-active': statsCategory === 'advanced' }"
                @click="emit('update:stats-category', 'advanced')"
              >
                {{ advancedLabel }}
              </button>
              <button
                type="button"
                class="info-stats-tab ui-build-card-button"
                :class="{ 'is-active': statsCategory === 'economic' }"
                @click="emit('update:stats-category', 'economic')"
              >
                {{ economicLabel }}
              </button>
              </div>
            </div>
          </div>

          <div class="tab-content">
            <component
              :is="statsTableComponent"
              :category="statsCategory"
              :hide-category-tabs="true"
              @update:category="emit('update:stats-category', $event)"
            />
          </div>
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

    <div v-if="pendingChampionChange" class="champion-confirm-overlay" @click.self="emit('cancel-champion-change')">
      <div class="champion-confirm-modal">
        <p class="champion-confirm-title">{{ confirmTitle }}</p>
        <p class="champion-confirm-body">{{ confirmBody }}</p>
        <div class="champion-confirm-actions">
          <button class="btn-cancel" @click="emit('cancel-champion-change')">{{ cancelLabel }}</button>
          <button class="btn-confirm" @click="emit('confirm-champion-change')">{{ confirmLabel }}</button>
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
  statsCategory: 'basic' | 'advanced' | 'economic'
  basicLabel: string
  advancedLabel: string
  economicLabel: string
  confirmTitle: string
  confirmBody: string
  cancelLabel: string
  confirmLabel: string
  buildCardComponent: Component | string
  buildSaveButtonComponent: Component | string
  statsTableComponent: Component | string
  buildMenuStepsComponent: Component | string
  fullWidth?: boolean
}>()

const emit = defineEmits<{
  'highlight-missing': [value: boolean]
  'update:stats-category': [value: 'basic' | 'advanced' | 'economic']
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

.build-card-column {
  width: var(--build-card-width);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 0;
}

.tab-content {
  min-height: 400px;
}

.info-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 12px;
  row-gap: 0;
  flex-wrap: wrap;
}

.info-toolbar-category-tabs {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.info-toolbar-category-tabs::-webkit-scrollbar {
  display: none;
}

.info-stats-tab {
  flex-shrink: 0;
  scroll-snap-align: start;
  white-space: nowrap;
  min-height: 30px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  border: none;
  background: transparent;
  cursor: pointer;
}

.champion-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.champion-confirm-modal {
  background: rgb(26, 26, 46);
  border: 1px solid var(--color-gold-300, #c89b3c);
  border-radius: 12px;
  padding: 28px 32px;
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.champion-confirm-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold-300, #c89b3c);
  margin: 0;
}

.champion-confirm-body {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin: 0;
}

.champion-confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 9px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-confirm {
  padding: 9px 20px;
  border-radius: 8px;
  border: none;
  background: rgb(220, 70, 70);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-confirm:hover {
  background: rgb(200, 55, 55);
}

@media (max-width: 768px) {
  .build-layout--streamer {
    --build-card-width: calc(100vw - 1.5rem);
  }

  .build-card-column {
    width: 100%;
    max-width: 100%;
  }
}
</style>
