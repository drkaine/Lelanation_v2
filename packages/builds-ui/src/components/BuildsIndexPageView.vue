<template>
  <div class="builds-page min-h-screen px-[10px] pb-4 text-text">
    <div class="mx-auto max-w-8xl px-0">
      <div class="flex justify-center">
        <div class="streamer-tabs">
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
          <component
            :is="linkComponent"
            :to="localePath('/builds/create')"
            class="streamer-tab-button"
          >
            {{ t('buildsPage.createBuild') }}
          </component>
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
          <button
            v-if="allowShare"
            class="ml-auto inline-flex h-[38px] items-center gap-2 rounded-lg border border-primary/80 bg-background/25 px-3 text-sm text-text transition-colors hover:bg-primary/20"
            :disabled="shareLoading"
            @click="emit('share-builds')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 7a2 2 0 0 1 2-2h8l5 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              <path d="M13 5v5h5" />
              <path d="m8 14 3 3 5-5" />
            </svg>
            {{ shareLoading ? t('buildsPage.shareLoading') : t('buildsPage.shareToApp') }}
          </button>
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
            <button
              v-if="allowShare"
              class="ml-auto inline-flex h-[38px] items-center gap-2 rounded-lg border border-primary/80 bg-background/25 px-3 text-sm text-text transition-colors hover:bg-primary/20"
              :disabled="shareLoading"
              @click="emit('share-builds')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 7a2 2 0 0 1 2-2h8l5 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                <path d="M13 5v5h5" />
                <path d="m8 14 3 3 5-5" />
              </svg>
              {{ shareLoading ? t('buildsPage.shareLoading') : t('buildsPage.shareToApp') }}
            </button>
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

    <div
      v-if="shareModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      @click="emit('close-share-code')"
    >
      <div
        class="mx-4 w-full max-w-sm rounded-lg bg-surface p-6 text-center"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-2 text-lg font-bold text-text">{{ t('buildsPage.shareCodeTitle') }}</h3>
        <p class="mb-4 text-sm text-text-secondary">
          {{ t('buildsPage.shareCodeDescription') }}
        </p>
        <div
          v-if="shareCode"
          class="mx-auto mb-4 flex w-fit items-center gap-3 rounded-lg border-2 border-accent bg-background px-6 py-3 font-mono text-xl font-bold tracking-[0.25em] text-accent"
        >
          {{ shareCode }}
          <button
            type="button"
            class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-text-secondary transition-colors hover:text-accent"
            :aria-label="t('buildsPage.shareCodeCopy')"
            :title="t('buildsPage.shareCodeCopy')"
            @click="emit('copy-share-code')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <p v-else class="mb-4 text-sm text-text-secondary">
          {{ t('buildsPage.shareNoBuilds') }}
        </p>
        <div class="mb-3">
          <input
            :value="importCode"
            type="text"
            class="w-full rounded-lg border border-primary/60 bg-background px-3 py-2 font-mono text-sm text-text"
            :placeholder="t('buildsPage.shareCodeInputPlaceholder')"
            maxlength="24"
            @input="emit('update:import-code', ($event.target as HTMLInputElement).value.toUpperCase())"
            @keyup.enter="emit('import-by-code')"
          />
        </div>
        <button
          class="mb-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark disabled:opacity-50"
          :disabled="importLoading || !importCode.trim()"
          @click="emit('import-by-code')"
        >
          {{ importLoading ? t('buildsPage.shareLoading') : t('buildsPage.shareCodeImportAction') }}
        </button>
        <p v-if="shareCopied" class="mb-2 text-sm text-green-400">
          {{ t('buildsPage.shareCodeCopied') }}
        </p>
        <p class="mb-4 text-xs text-text-secondary">{{ t('buildsPage.shareCodeExpiry') }}</p>
        <button
          class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-accent/10"
          @click="emit('close-share-code')"
        >
          {{ t('buildsPage.shareCodeClose') }}
        </button>
      </div>
    </div>

    <div
      v-if="shareError"
      class="fixed bottom-4 right-4 z-50 rounded-lg bg-error px-4 py-3 text-sm text-white shadow-lg"
    >
      {{ shareError }}
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
  allowShare: boolean
  shareLoading: boolean
  importLoading: boolean
  buildsFilteredByVisibility: Build[]
  buildToDelete: string | null
  shareModalOpen: boolean
  shareCode: string | null
  importCode: string
  shareCopied: boolean
  shareError: string | null
}>()

const emit = defineEmits<{
  'update:activeTab': [value: string]
  'update:myBuildsVisibilityFilter': [value: VisibilityFilterValue]
  'share-builds': []
  'clear-comparison': []
  'confirm-delete': [buildId: string]
  'toggle-visibility': [buildId: string]
  'delete-build': []
  'close-delete-modal': []
  'close-share-code': []
  'copy-share-code': []
  'update:import-code': [value: string]
  'import-by-code': []
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
}

.streamer-tab-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
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
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
