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
          v-for="opt in visibleTagFilterOptions"
          :key="opt.value"
          type="button"
          class="build-tag-chip"
          :class="[
            isTagSelected(opt.value) ? 'build-tag-chip--selected' : 'build-tag-chip--unselected',
            isTagSelected(opt.value) && buildTagUsesDarkText(opt.value)
              ? 'build-tag-chip--dark-text'
              : '',
          ]"
          :style="isTagSelected(opt.value) ? opt.chipStyle : undefined"
          :title="t(opt.labelKey)"
          :aria-label="t(opt.labelKey)"
          :aria-pressed="isTagSelected(opt.value)"
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
  BuildTagValue,
  SortOption,
  PageSizeOption,
} from '~/stores/BuildDiscoveryStore'
import { comparePatchMajorMinor, patchFromGameVersion } from '~/utils/patchVersion'
import { riotLanguage } from '~/utils/riotLanguage'
import { hasLelarivaBuild } from '~/utils/buildTagFilter'
import { buildTagChipStyle, buildTagUsesDarkText } from '~/utils/buildTagColors'

const { locale, t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()

const filtersOneLineEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(filtersOneLineEl)

const riotLocale = computed(() => riotLanguage(locale.value))

const selectedVersion = ref(discoveryStore.selectedVersion ?? '')
const selectedChampion = ref<string | null>(discoveryStore.selectedChampion)
const selectedRole = ref<FilterRole>(discoveryStore.selectedRole)
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

const availableVersions = computed(() => {
  const versions = new Set<string>()
  for (const build of discoveryStore.builds) {
    const patch = patchFromGameVersion(build.gameVersion)
    if (patch) versions.add(patch)
  }
  if (versionStore.currentVersion) {
    const patch = patchFromGameVersion(versionStore.currentVersion)
    if (patch) versions.add(patch)
  }
  return [...versions].sort((a, b) => comparePatchMajorMinor(b, a))
})

const roleOptions: Array<{ value: Exclude<FilterRole, null>; label: string; icon: string }> = [
  { value: 'top', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'jungle', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'mid', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'adc', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'support', label: 'Support', icon: '/icons/roles/support.png' },
]

const tagFilterOptions: Array<{
  value: BuildTagValue
  label: string
  labelKey:
    | 'buildDiscovery.tagPro'
    | 'buildDiscovery.tagOtp'
    | 'buildDiscovery.tagExotique'
    | 'buildDiscovery.tagTroll'
    | 'buildDiscovery.tagNotes'
    | 'buildDiscovery.tagLelariva'
    | 'buildDiscovery.tagGuide'
  chipStyle: Record<string, string>
}> = [
  {
    value: 'pro',
    label: 'Pro',
    labelKey: 'buildDiscovery.tagPro',
    chipStyle: buildTagChipStyle('pro'),
  },
  {
    value: 'otp',
    label: 'OTP',
    labelKey: 'buildDiscovery.tagOtp',
    chipStyle: buildTagChipStyle('otp'),
  },
  {
    value: 'exotique',
    label: 'Exotique',
    labelKey: 'buildDiscovery.tagExotique',
    chipStyle: buildTagChipStyle('exotique'),
  },
  {
    value: 'troll',
    label: 'Troll',
    labelKey: 'buildDiscovery.tagTroll',
    chipStyle: buildTagChipStyle('troll'),
  },
  {
    value: 'notes',
    label: 'Notes',
    labelKey: 'buildDiscovery.tagNotes',
    chipStyle: buildTagChipStyle('notes'),
  },
  {
    value: 'lelariva',
    label: 'Lelariva',
    labelKey: 'buildDiscovery.tagLelariva',
    chipStyle: buildTagChipStyle('lelariva'),
  },
  {
    value: 'guide',
    label: 'Guide',
    labelKey: 'buildDiscovery.tagGuide',
    chipStyle: buildTagChipStyle('guide'),
  },
]

const visibleTagFilterOptions = computed(() =>
  tagFilterOptions.filter(
    opt => opt.value !== 'lelariva' || hasLelarivaBuild(discoveryStore.builds)
  )
)

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

const isTagSelected = (tag: BuildTagValue) => discoveryStore.selectedTags.includes(tag)

const toggleTag = (tag: BuildTagValue) => {
  discoveryStore.toggleSelectedTag(tag)
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
