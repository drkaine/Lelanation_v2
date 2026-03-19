<template>
  <div class="build-filters flex flex-1 flex-wrap items-center gap-2">
    <div class="role-filter-row flex items-center gap-0 overflow-x-auto whitespace-nowrap">
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

    <select
      id="build-discovery-version"
      v-model="selectedVersion"
      class="filter-select"
      :aria-label="t('buildDiscovery.version')"
      @change="handleVersionChange"
    >
      <option value="">{{ t('buildDiscovery.allVersions') }}</option>
      <option v-for="version in availableVersions" :key="version" :value="version">
        {{ version }}
      </option>
    </select>

    <select
      id="build-discovery-sort"
      v-model="sortBy"
      class="filter-select"
      :aria-label="t('buildDiscovery.sort')"
      @change="handleSortChange"
    >
      <option value="recent">{{ t('buildDiscovery.mostRecent') }}</option>
      <option value="popular">{{ t('buildDiscovery.mostPopular') }}</option>
      <option value="name">{{ t('buildDiscovery.nameAZ') }}</option>
    </select>

    <select
      id="build-discovery-per-page"
      v-model="pageSize"
      class="filter-select"
      :aria-label="t('buildDiscovery.buildsPerPage')"
    >
      <option :value="20">20</option>
      <option :value="30">30</option>
      <option :value="40">40</option>
      <option :value="50">50</option>
      <option value="all">{{ t('buildDiscovery.all') }}</option>
    </select>

    <button v-if="hasActiveFilters" class="filter-clear" @click="clearFilters">
      {{ t('buildDiscovery.clearFilters') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import type { FilterRole, SortOption, PageSizeOption } from '~/stores/BuildDiscoveryStore'

const { locale, t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const selectedVersion = ref(discoveryStore.selectedVersion ?? '')
const selectedChampion = ref<string | null>(discoveryStore.selectedChampion)
const selectedRole = ref<FilterRole>(discoveryStore.selectedRole)
const sortBy = ref<SortOption>(discoveryStore.sortBy)
const pageSize = computed({
  get: () => discoveryStore.pageSize,
  set: (v: PageSizeOption) => discoveryStore.setPageSize(v),
})

const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)

const championSearchQuery = ref('')

// Champions available in discovery builds (reserved for future champion filter UI)
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used when champion filter UI is added
const availableChampions = computed(() => {
  const championIds = new Set(
    discoveryStore.builds.map(build => build.champion?.id).filter(Boolean) as string[]
  )
  return championsStore.champions.filter(champion => championIds.has(champion.id))
})

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
    discoveryStore.builds
      .map(build => build.gameVersion)
      .filter((version): version is string => Boolean(version))
  )
  if (versionStore.currentVersion) {
    versions.add(versionStore.currentVersion)
  }
  return [...versions].sort(compareVersions)
})

const roleOptions: Array<{ value: Exclude<FilterRole, null>; label: string; icon: string }> = [
  { value: 'top', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'jungle', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'mid', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'adc', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'support', label: 'Support', icon: '/icons/roles/support.png' },
]

const setRole = (role: FilterRole) => {
  selectedRole.value = role
  discoveryStore.setSelectedRole(role)
}

const toggleRole = (role: FilterRole) => {
  // Si le rôle est déjà sélectionné, le désélectionner
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

const clearFilters = () => {
  discoveryStore.clearAllFilters()
  selectedVersion.value = ''
  selectedChampion.value = null
  championSearchQuery.value = ''
  selectedRole.value = null
  sortBy.value = 'recent'
}

const loadChampionsForLocale = async () => {
  await championsStore.loadChampions(riotLocale.value)
}

onMounted(() => {
  loadChampionsForLocale()
  if (!versionStore.currentVersion) {
    versionStore.loadCurrentVersion().catch(() => undefined)
  }
})

watch(locale, () => {
  loadChampionsForLocale()
})
</script>

<style scoped>
.role-filter-row {
  margin: 0;
  padding: 0;
  scrollbar-width: none;
}

.role-filter-row::-webkit-scrollbar {
  display: none;
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
</style>
