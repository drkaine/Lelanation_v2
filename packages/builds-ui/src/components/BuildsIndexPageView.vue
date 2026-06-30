<template>
  <div class="builds-page min-h-screen px-[10px] pb-4 text-text">
    <div class="mx-auto max-w-8xl px-0">
      <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <div class="scrollable-tabs-scroll-wrap min-w-0 max-w-full">
          <div class="streamer-tabs scrollable-tabs-nav">
          <button
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'discover' }"
            @click="emit('update:activeTab', 'discover')"
          >
            {{ t('buildsPage.discover') }}
          </button>
          <button
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'my-builds' }"
            @click="emit('update:activeTab', 'my-builds')"
          >
            {{ t('buildsPage.myBuilds') }}
          </button>
          <button
            v-if="favoriteBuilds.length > 0"
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'favoris' }"
            @click="emit('update:activeTab', 'favoris')"
          >
            {{ t('buildsPage.myFavorites') }}
          </button>
          <button
            type="button"
            class="streamer-tab-button"
            @click="emit('create-build')"
          >
            {{ t('buildsPage.createBuild') }}
          </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'discover'" class="tab-content">
        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <component :is="buildSearchComponent" />
            <component :is="buildFiltersComponent" />
          </div>
        </div>

        <div
          v-if="comparisonBuilds.length > 0"
          class="mb-6 rounded-lg border-2 border-accent bg-accent/20 p-4"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-text">
                {{ comparisonBuilds.length }}
                {{
                  comparisonBuilds.length === 1
                    ? t('buildsPage.buildsInComparison')
                    : t('buildsPage.buildsInComparison_other')
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <component
                :is="linkComponent"
                :to="localePath('/builds/compare')"
                class="rounded-lg bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-dark"
              >
                {{ t('buildsPage.compare') }}
              </component>
              <button
                class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
                @click="emit('clear-comparison')"
              >
                {{ t('buildsPage.clear') }}
              </button>
            </div>
          </div>
        </div>

        <component :is="buildGridComponent" :show-favorite-toggle="true" />
      </div>

      <div v-if="activeTab === 'my-builds'" class="tab-content">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <component :is="buildSearchComponent" />
          <component :is="buildFiltersComponent" />
          <span class="text-sm text-text-secondary">
            {{ t('buildsPage.visibility') }}
          </span>
          <select
            :value="myBuildsVisibilityFilter"
            class="filter-like-select md:hidden"
            :aria-label="t('buildsPage.visibility')"
            @change="
              emit(
                'update:myBuildsVisibilityFilter',
                ($event.target as HTMLSelectElement).value as VisibilityFilterValue
              )
            "
          >
            <option v-for="opt in visibilityFilterOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div class="filter-like-segmented hidden p-0.5 md:flex">
            <button
              v-for="opt in visibilityFilterOptions"
              :key="opt.value"
              :class="[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                myBuildsVisibilityFilter === opt.value
                  ? 'bg-primary/30 text-text'
                  : 'text-text-secondary hover:bg-primary/20 hover:text-text',
              ]"
              @click="emit('update:myBuildsVisibilityFilter', opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <component
          :is="buildGridComponent"
          :custom-builds="buildsFilteredByVisibility"
          :show-user-actions="true"
          @delete-build="emit('confirm-delete', $event)"
          @toggle-visibility="emit('toggle-visibility', $event)"
        />
      </div>

      <div v-if="activeTab === 'favoris'" class="tab-content">
        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <component :is="buildSearchComponent" />
            <component :is="buildFiltersComponent" />
          </div>
        </div>
        <component
          :is="buildGridComponent"
          :custom-builds="favoriteBuilds"
          :show-favorite-toggle="true"
        />
      </div>

      <div v-if="activeTab === 'lelariva'" class="tab-content">
        <div class="py-12 text-center">
          <p class="mb-4 text-lg text-text-secondary">{{ t('buildsPage.lelarivaBuilds') }}</p>
          <p class="text-text-secondary">{{ t('buildsPage.lelarivaComingSoon') }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="buildToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black"
      @click="emit('close-delete-modal')"
    >
      <div
        class="mx-4 w-full max-w-md rounded-lg bg-surface p-6"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-4 text-lg font-bold text-text">{{ t('buildsPage.deleteBuildTitle') }}</h3>
        <p class="mb-6 text-text">
          {{ t('buildsPage.deleteBuildConfirm') }}
        </p>
        <div class="flex gap-4">
          <button
            class="rounded-lg bg-error px-4 py-2 text-text transition-colors hover:bg-error/80"
            @click="emit('delete-build')"
          >
            {{ t('buildsPage.delete') }}
          </button>
          <button
            class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
            @click="emit('close-delete-modal')"
          >
            {{ t('buildsPage.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { Build } from '@lelanation/shared-types'

type VisibilityFilterValue = 'all' | 'private' | 'public'

defineProps<{
  t: (key: string) => string
  localePath: (path: string) => string
  linkComponent: Component | string
  buildSearchComponent: Component | string
  buildFiltersComponent: Component | string
  buildGridComponent: Component | string
  activeTab: string
  favoriteBuilds: Build[]
  comparisonBuilds: unknown[]
  myBuildsVisibilityFilter: VisibilityFilterValue
  visibilityFilterOptions: { value: VisibilityFilterValue; label: string }[]
  adminMode: boolean
  buildsFilteredByVisibility: Build[]
  buildToDelete: string | null
}>()

const emit = defineEmits<{
  'update:activeTab': [value: string]
  'update:myBuildsVisibilityFilter': [value: VisibilityFilterValue]
  'create-build': []
  'clear-comparison': []
  'confirm-delete': [buildId: string]
  'toggle-visibility': [buildId: string]
  'delete-build': []
  'close-delete-modal': []
}>()
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

.builds-page {
  padding-top: 10px;
}

.streamer-tabs {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.streamer-tabs::-webkit-scrollbar {
  display: none;
}

.streamer-tab-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  scroll-snap-align: start;
  white-space: nowrap;
  border: none;
  border-radius: 9999px;
  background: transparent;
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgb(var(--rgb-text) / 0.75);
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.streamer-tab-button.is-active {
  background: rgb(var(--rgb-accent) / 0.2);
  color: var(--color-accent);
}

.filter-like-select {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
}

.filter-like-segmented {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
