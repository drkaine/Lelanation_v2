<template>
  <div class="matchup-guide-filters flex min-w-0 flex-1 items-center gap-2">
    <div
      ref="filtersOneLineEl"
      class="filters-one-line flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
    >
      <div class="role-filter-row flex shrink-0 items-center gap-0 whitespace-nowrap">
        <button
          type="button"
          :class="roleChipClass(selectedRole === null)"
          :title="t('statisticsPage.allRoles')"
          :aria-label="t('statisticsPage.allRoles')"
          :aria-pressed="selectedRole === null"
          @click="setRole(null)"
        >
          <img src="/icons/roles/all-role.png" alt="" class="h-5 w-5" role="presentation" />
        </button>
        <button
          v-for="role in roleOptions"
          :key="role.value"
          type="button"
          :class="roleChipClass(selectedRole === role.value)"
          :title="role.label"
          :aria-label="role.label"
          :aria-pressed="selectedRole === role.value"
          @click="toggleRole(role.value)"
        >
          <img :src="role.icon" alt="" class="h-5 w-5" role="presentation" />
        </button>
      </div>

      <span class="filters-sep shrink-0" aria-hidden="true" />

      <select
        id="matchup-guide-version"
        v-model="selectedVersion"
        class="filter-select shrink-0"
        :aria-label="t('matchupGuideDiscovery.version')"
        @change="handleVersionChange"
      >
        <option value="">{{ t('matchupGuideDiscovery.allVersions') }}</option>
        <option v-for="version in availableVersions" :key="version" :value="version">
          {{ version }}
        </option>
      </select>

      <select
        id="matchup-guide-sort"
        v-model="sortBy"
        class="filter-select shrink-0"
        :aria-label="t('matchupGuideDiscovery.sort')"
        @change="handleSortChange"
      >
        <option value="recent">{{ t('matchupGuideDiscovery.mostRecent') }}</option>
        <option value="name">{{ t('matchupGuideDiscovery.nameAZ') }}</option>
      </select>

      <div class="filter-inline-label shrink-0">
        <span class="filter-inline-label-text">{{ t('matchupGuideDiscovery.show') }}</span>
        <select
          id="matchup-guide-per-page"
          v-model="pageSize"
          class="filter-select"
          :aria-label="t('matchupGuideDiscovery.guidesPerPage')"
        >
          <option :value="20">20</option>
          <option :value="30">30</option>
          <option :value="40">40</option>
          <option :value="50">50</option>
          <option value="all">{{ t('matchupGuideDiscovery.all') }}</option>
        </select>
      </div>

      <label class="filter-uptodate shrink-0">
        <input :checked="onlyUpToDate" type="checkbox" @change="handleOnlyUpToDateChange" />
        <span>{{ t('matchupGuideDiscovery.upToDate') }}</span>
      </label>
    </div>

    <button v-if="hasActiveFilters" class="filter-clear shrink-0" @click="clearFilters">
      {{ t('matchupGuideDiscovery.clearFilters') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useMatchupGuideDiscoveryStore,
  type MatchupGuideFilterRole,
  type MatchupGuidePageSizeOption,
  type MatchupGuideSortOption,
} from '~/stores/MatchupGuideDiscoveryStore'
import { useVersionStore } from '~/stores/VersionStore'

const { t } = useI18n()
const discoveryStore = useMatchupGuideDiscoveryStore()
const versionStore = useVersionStore()

const filtersOneLineEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(filtersOneLineEl)

const selectedVersion = ref(discoveryStore.selectedVersion ?? '')
const selectedRole = ref<MatchupGuideFilterRole>(discoveryStore.selectedRole)
const sortBy = ref<MatchupGuideSortOption>(discoveryStore.sortBy)
const onlyUpToDate = ref(discoveryStore.onlyUpToDate)
const pageSize = computed({
  get: () => discoveryStore.pageSize,
  set: (v: MatchupGuidePageSizeOption) => discoveryStore.setPageSize(v),
})

const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)

const compareVersions = (a: string, b: string) => {
  const aParts = a.split('.').map(part => Number(part))
  const bParts = b.split('.').map(part => Number(part))
  const maxLength = Math.max(aParts.length, bParts.length)
  for (let index = 0; index < maxLength; index += 1) {
    const aValue = aParts[index] ?? 0
    const bValue = bParts[index] ?? 0
    if (aValue !== bValue) return bValue - aValue
  }
  return 0
}

const availableVersions = computed(() => {
  const versions = new Set(
    discoveryStore.guides
      .map(guide => guide.gameVersion)
      .filter((version): version is string => Boolean(version))
  )
  if (versionStore.currentVersion) {
    versions.add(versionStore.currentVersion)
  }
  return [...versions].sort(compareVersions)
})

const roleOptions: Array<{
  value: Exclude<MatchupGuideFilterRole, null>
  label: string
  icon: string
}> = [
  { value: 'top', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'jungle', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'mid', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'adc', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'support', label: 'Support', icon: '/icons/roles/support.png' },
]

const setRole = (role: MatchupGuideFilterRole) => {
  selectedRole.value = role
  discoveryStore.setSelectedRole(role)
}

const toggleRole = (role: MatchupGuideFilterRole) => {
  if (selectedRole.value === role) {
    setRole(null)
  } else {
    setRole(role)
  }
}

const roleChipClass = (active: boolean) =>
  [
    'inline-flex h-7 w-7 items-center justify-center rounded-full p-0 transition-all',
    active ? 'bg-accent/15' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0',
  ].join(' ')

const handleVersionChange = () => {
  discoveryStore.setSelectedVersion(selectedVersion.value || null)
}

const handleSortChange = () => {
  discoveryStore.setSortBy(sortBy.value)
}

const handleOnlyUpToDateChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  onlyUpToDate.value = checked
  discoveryStore.setOnlyUpToDate(checked)
}

const clearFilters = () => {
  discoveryStore.clearAllFilters()
  selectedVersion.value = ''
  selectedRole.value = null
  onlyUpToDate.value = false
  sortBy.value = 'recent'
}

onMounted(() => {
  if (!versionStore.currentVersion) {
    versionStore.loadCurrentVersion().catch(() => undefined)
  }
})
</script>

<style scoped>
.role-filter-row {
  margin: 0;
  padding: 0;
}

.filters-sep {
  display: inline-block;
  width: 1px;
  height: 1.25rem;
  background: rgb(var(--rgb-primary) / 0.35);
}

.filter-select {
  min-width: 7.5rem;
  max-width: 10rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
}

.filter-clear {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
  transition: background-color 0.2s ease;
}

.filter-clear:hover {
  background: rgb(var(--rgb-primary) / 0.2);
}

.filter-inline-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.filter-inline-label-text {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.filter-uptodate {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.9);
  cursor: pointer;
  white-space: nowrap;
}
</style>
