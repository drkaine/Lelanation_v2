<template>
  <div class="build-filters flex min-w-0 flex-1 items-center gap-2">
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

      <div class="tag-filter-row flex shrink-0 items-center gap-1 whitespace-nowrap">
        <button
          v-for="opt in tagFilterOptions"
          :key="opt.value"
          type="button"
          class="build-tag-chip"
          :class="[
            selectedTag === opt.value ? 'build-tag-chip--selected' : 'build-tag-chip--unselected',
            selectedTag === opt.value && opt.value === 'troll'
              ? 'build-tag-chip--troll-selected'
              : '',
          ]"
          :style="selectedTag === opt.value ? opt.chipStyle : undefined"
          :title="t(opt.labelKey)"
          :aria-label="t(opt.labelKey)"
          :aria-pressed="selectedTag === opt.value"
          @click="toggleTag(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <select
        id="build-discovery-version"
        v-model="selectedVersion"
        class="filter-select ui-build-card-button shrink-0"
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
        class="filter-select ui-build-card-button shrink-0"
        :aria-label="t('buildDiscovery.sort')"
        @change="handleSortChange"
      >
        <option value="recent">{{ t('buildDiscovery.mostRecent') }}</option>
        <option value="popular">{{ t('buildDiscovery.mostPopular') }}</option>
        <option value="name">{{ t('buildDiscovery.nameAZ') }}</option>
      </select>

      <div class="filter-inline-label shrink-0">
        <span class="filter-inline-label-text">{{ t('buildDiscovery.show') }}</span>
        <select
          id="build-discovery-per-page"
          v-model="pageSize"
          class="filter-select ui-build-card-button"
          :aria-label="t('buildDiscovery.buildsPerPage')"
        >
          <option :value="20">20</option>
          <option :value="30">30</option>
          <option :value="40">40</option>
          <option :value="50">50</option>
          <option value="all">{{ t('buildDiscovery.all') }}</option>
        </select>
      </div>

      <label class="filter-uptodate shrink-0">
        <input :checked="onlyUpToDate" type="checkbox" @change="handleOnlyUpToDateChange" />
        <span>{{ t('buildDiscovery.upToDate') }}</span>
      </label>
    </div>

    <button
      v-if="hasActiveFilters"
      type="button"
      class="filter-clear ui-build-card-button shrink-0"
      @click="clearFilters"
    >
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
import type {
  FilterRole,
  FilterBuildTag,
  SortOption,
  PageSizeOption,
} from '~/stores/BuildDiscoveryStore'

const { locale, t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()

const filtersOneLineEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(filtersOneLineEl)

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const selectedVersion = ref(discoveryStore.selectedVersion ?? '')
const selectedChampion = ref<string | null>(discoveryStore.selectedChampion)
const selectedRole = ref<FilterRole>(discoveryStore.selectedRole)
const selectedTag = ref<FilterBuildTag>(discoveryStore.selectedTag)
const sortBy = ref<SortOption>(discoveryStore.sortBy)
const onlyUpToDate = ref(discoveryStore.onlyUpToDate)
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

const tagFilterOptions: Array<{
  value: Exclude<FilterBuildTag, null>
  label: string
  labelKey:
    | 'buildDiscovery.tagPro'
    | 'buildDiscovery.tagOtp'
    | 'buildDiscovery.tagExotique'
    | 'buildDiscovery.tagTroll'
  chipStyle: Record<string, string>
}> = [
  {
    value: 'pro',
    label: 'Pro',
    labelKey: 'buildDiscovery.tagPro',
    chipStyle: { '--tag-g1': '#bd9700', '--tag-g2': '#704b00' },
  },
  {
    value: 'otp',
    label: 'OTP',
    labelKey: 'buildDiscovery.tagOtp',
    chipStyle: { '--tag-g1': '#00b4dd', '--tag-g2': '#003366' },
  },
  {
    value: 'exotique',
    label: 'Exotique',
    labelKey: 'buildDiscovery.tagExotique',
    chipStyle: { '--tag-g1': '#6e008a', '--tag-g2': '#420042' },
  },
  {
    value: 'troll',
    label: 'Troll',
    labelKey: 'buildDiscovery.tagTroll',
    chipStyle: { '--tag-g1': '#e4b5e4', '--tag-g2': '#36bfb1' },
  },
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

const setTag = (tag: FilterBuildTag) => {
  selectedTag.value = tag
  discoveryStore.setSelectedTag(tag)
}

const toggleTag = (tag: Exclude<FilterBuildTag, null>) => {
  if (selectedTag.value === tag) {
    setTag(null)
  } else {
    setTag(tag)
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
  selectedChampion.value = null
  championSearchQuery.value = ''
  selectedRole.value = null
  selectedTag.value = null
  onlyUpToDate.value = false
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
}

.filters-sep {
  display: inline-block;
  width: 1px;
  height: 1.25rem;
  background: rgb(var(--rgb-primary) / 0.35);
}

.role-filter-row .build-tag-chip {
  flex-shrink: 0;
}

.tag-filter-row .build-tag-chip {
  flex-shrink: 0;
}

.filter-select {
  min-width: 7.5rem;
  max-width: 10rem;
  appearance: auto;
  cursor: pointer;
}

.filter-clear {
  cursor: pointer;
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
