<template>
  <div class="companion-builds-panel">
    <nav class="tabs">
    <button class="tab-btn" :class="{ active: activeTab === 'builds' }" @click="emit('update:activeTab', 'builds')">
      {{ t('tabs.discover') }}
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'mes-builds' }"
      :disabled="importedBuildsCount === 0"
      @click="emit('update:activeTab', 'mes-builds')"
    >
      {{ t('tabs.myBuilds') }} ({{ importedBuildsCount }})
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'favoris' }"
      :disabled="favoriteCount === 0"
      @click="emit('update:activeTab', 'favoris')"
    >
      {{ t('tabs.favorites') }} ({{ favoriteCount }})
    </button>
    <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="emit('update:activeTab', 'settings')">
      {{ t('tabs.settings') }}
    </button>
    </nav>

    <div v-if="activeTab !== 'settings'" class="filters-bar">
      <BuildsFilterBar
        :search-query="searchQuery"
        :selected-role="selectedRole"
        :only-up-to-date="onlyUpToDate"
        :sort-by="sortBy"
        :has-active-filters="hasActiveFilters"
        :search-placeholder="t('search')"
        :up-to-date-label="t('upToDate')"
        :sort-label="t('sort.label')"
        :clear-filters-label="t('clearFilters')"
        :roles="roleOptions"
        :sort-options="sortOptions"
        @update:search-query="emit('update:searchQuery', $event)"
        @update:only-up-to-date="emit('update:onlyUpToDate', $event)"
        @update:sort-by="onSortByUpdate"
        @toggle-role="emit('update:selectedRole', selectedRole === $event ? null : ($event as Role))"
        @clear-filters="emit('clear-filters')"
      />
    </div>

    <section v-if="activeTab !== 'settings'" class="panel">
      <p v-if="activeTab === 'builds' && loading" class="empty">{{ t('loading') }}</p>
      <p v-else-if="activeTab === 'mes-builds' && importedBuildsCount === 0" class="empty">
        {{ t('noImported') }}
      </p>
      <p v-else-if="displayedBuilds.length === 0" class="empty">
        {{ activeTab === 'favoris' ? t('noFavorites') : t('noBuilds') }}
      </p>

      <div v-else class="build-grid">
        <div v-for="b in displayedBuilds" :key="b.id" class="build-entry">
          <div class="build-top-row">
            <div class="top-left-spacer"></div>
            <h3 class="author">
              {{ b.author || t('authorUnknown') }}
              <span v-if="importedBuildIds.has(b.id)" class="perso-badge">{{ t('badge.personal') }}</span>
            </h3>

            <button type="button" class="top-icon-button" :title="t('detail')" @click="emit('open-detail', b)">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <BuildCardFlip
            :build="b"
            :images="imageResolvers"
            :rune-lookup="runeLookup"
            :version="buildVersion(b)"
            :main-build-label="t('mainBuild')"
            :variant-label-fn="i => `${t('variant')} ${i + 1}`"
            @variant-change="idx => emit('variant-change', { buildId: b.id, idx })"
          />

          <div class="card-actions">
            <button
              type="button"
              class="action-icon-button"
              :class="{ on: isFavorite(b.id) }"
              :title="isFavorite(b.id) ? t('favorite.remove') : t('favorite.add')"
              @click="emit('toggle-favorite', b.id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                :fill="isFavorite(b.id) ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="bookmark-icon"
                aria-hidden="true"
              >
                <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z" />
              </svg>
            </button>
            <button
              type="button"
              class="action-icon-button"
              :title="t('detail')"
              @click="emit('open-detail', b)"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Build, Role } from '@lelanation/shared-types'
import type { ImageResolvers, RuneLookup } from './BuildSheet.vue'
import BuildsFilterBar from './BuildsFilterBar.vue'
import BuildCardFlip from './BuildCardFlip.vue'

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string
  activeTab: 'builds' | 'mes-builds' | 'favoris' | 'settings'
  importedBuildsCount: number
  favoriteCount: number
  loading: boolean
  displayedBuilds: Build[]
  importedBuildIds: Set<string>
  searchQuery: string
  selectedRole: Role | null
  onlyUpToDate: boolean
  sortBy: 'recent' | 'name'
  hasActiveFilters: boolean
  roleOptions: Array<{ value: Role; label: string; icon: string }>
  sortOptions: Array<{ value: string; label: string }>
  imageResolvers: ImageResolvers
  runeLookup: RuneLookup
  isFavorite: (buildId: string) => boolean
  buildVersion: (build: Build) => string
}>()

const emit = defineEmits<{
  'update:activeTab': [value: 'builds' | 'mes-builds' | 'favoris' | 'settings']
  'update:searchQuery': [value: string]
  'update:selectedRole': [value: Role | null]
  'update:onlyUpToDate': [value: boolean]
  'update:sortBy': [value: 'recent' | 'name']
  'clear-filters': []
  'toggle-favorite': [buildId: string]
  'open-detail': [build: Build]
  'variant-change': [payload: { buildId: string; idx: number | null }]
}>()

const onSortByUpdate = (value: string) => {
  if (value === 'recent' || value === 'name') {
    emit('update:sortBy', value)
  }
}
</script>

<style scoped>
.tabs { display: flex; gap: 0.5rem; margin-bottom: 0.9rem; }
.companion-builds-panel {
  border: 1px solid rgba(200, 155, 60, 0.2);
  border-radius: 10px;
  background: rgba(10, 20, 40, 0.25);
  padding: 0.75rem;
}
.tab-btn {
  border: 1px solid rgba(200, 155, 60, 0.5); border-radius: 8px;
  background: rgba(30, 40, 45, 0.75); color: #f0e6d2; padding: 0.45rem 0.75rem;
  font-size: 0.84rem; cursor: pointer; transition: background-color 0.15s ease;
}
.tab-btn:hover:not(:disabled) { background: rgba(0, 90, 130, 0.55); }
.tab-btn.active { background: rgba(200, 155, 60, 0.18); border-color: #c89b3c; }
.tab-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.filters-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem; padding: 0.75rem; border-radius: 10px;
  border: 1px solid rgba(200, 155, 60, 0.2); background: rgba(10, 20, 40, 0.35);
}

.panel { min-height: 260px; }
.empty { color: rgba(240, 230, 210, 0.85); }
.build-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; justify-items: center; }
.build-entry { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.build-top-row {
  width: 300px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.top-left-spacer {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
}
.author {
  margin: 0;
  color: #c8aa6e;
  font-size: 0.86rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  text-transform: uppercase;
  text-align: center;
}
.perso-badge {
  font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  background: rgba(200, 155, 60, 0.25); color: #c89b3c;
  border: 1px solid rgba(200, 155, 60, 0.5); border-radius: 4px;
  padding: 0.05rem 0.35rem; letter-spacing: 0.04em;
}
.top-icon-button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid rgba(200, 155, 60, 0.55);
  background: rgba(10, 20, 40, 0.35);
  color: #c8aa6e;
}
.top-icon-button.on { color: #e6b800; background: rgba(200, 155, 60, 0.18); border-color: #e6b800; }
.top-icon-button:hover { background: rgba(200, 155, 60, 0.16); }
.action-icon-button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(200, 155, 60, 0.55);
  background: rgba(10, 20, 40, 0.35);
  color: #c8aa6e;
  transition: all 0.15s;
}
.action-icon-button.on {
  color: #e6b800;
  background: rgba(200, 155, 60, 0.18);
  border-color: #e6b800;
}
.action-icon-button:hover {
  background: rgba(200, 155, 60, 0.16);
}
.bookmark-icon { width: 0.75rem; height: 0.75rem; }
.card-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.45rem; width: 300px; margin-top: calc(0.75rem + 10px); }
.import-btn {
  border: 1px solid rgba(3, 151, 171, 0.8); border-radius: 7px; background: rgba(10, 50, 60, 0.8); color: #cdfafa;
  cursor: pointer; padding: 0.38rem 0.7rem; font-size: 0.8rem; transition: background-color 0.15s ease, border-color 0.15s ease;
}
.import-btn:hover:not(:disabled) { background: rgba(3, 151, 171, 0.35); border-color: rgba(10, 200, 185, 0.9); }
.import-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
