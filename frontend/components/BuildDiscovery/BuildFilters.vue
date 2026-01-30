<template>
  <div class="build-filters">
    <div class="flex flex-wrap items-center gap-4">
      <label class="flex cursor-pointer items-center gap-2">
        <input
          v-model="onlyUpToDate"
          type="checkbox"
          class="rounded border-primary"
          @change="handleUpToDateChange"
        />
        <span class="text-sm text-text">{{ t('buildDiscovery.upToDate') }}</span>
      </label>

      <div class="flex items-center gap-2">
        <label class="text-sm text-text">{{ t('buildDiscovery.sort') }}</label>
        <select
          v-model="sortBy"
          class="rounded border border-primary bg-surface px-3 py-1 text-sm text-text"
          @change="handleSortChange"
        >
          <option value="recent">{{ t('buildDiscovery.mostRecent') }}</option>
          <option value="popular">{{ t('buildDiscovery.mostPopular') }}</option>
          <option value="name">{{ t('buildDiscovery.nameAZ') }}</option>
        </select>
      </div>

      <button
        v-if="hasActiveFilters"
        class="rounded bg-surface px-3 py-1 text-sm text-text hover:bg-primary hover:text-white"
        @click="clearFilters"
      >
        {{ t('buildDiscovery.clearFilters') }}
      </button>
    </div>

    <div class="mt-4 flex items-center gap-2">
      <label class="text-sm text-text">{{ t('buildDiscovery.role') }}</label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :class="roleChipClass(selectedRole === 'top')"
          @click="toggleRole('top')"
        >
          <img src="/icons/roles/top.png" alt="Top" class="h-4 w-4" />
          <span class="text-xs">Top</span>
        </button>
        <button
          type="button"
          :class="roleChipClass(selectedRole === 'jungle')"
          @click="toggleRole('jungle')"
        >
          <img src="/icons/roles/jungle.png" alt="Jungle" class="h-4 w-4" />
          <span class="text-xs">Jungle</span>
        </button>
        <button
          type="button"
          :class="roleChipClass(selectedRole === 'mid')"
          @click="toggleRole('mid')"
        >
          <img src="/icons/roles/mid.png" alt="Mid" class="h-4 w-4" />
          <span class="text-xs">Mid</span>
        </button>
        <button
          type="button"
          :class="roleChipClass(selectedRole === 'adc')"
          @click="toggleRole('adc')"
        >
          <img src="/icons/roles/bot.png" alt="ADC" class="h-4 w-4" />
          <span class="text-xs">ADC</span>
        </button>
        <button
          type="button"
          :class="roleChipClass(selectedRole === 'support')"
          @click="toggleRole('support')"
        >
          <img src="/icons/roles/support.png" alt="Support" class="h-4 w-4" />
          <span class="text-xs">Support</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import type { FilterRole, SortOption } from '~/stores/BuildDiscoveryStore'

const { locale, t } = useI18n()
const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const onlyUpToDate = ref(discoveryStore.onlyUpToDate)
const selectedChampion = ref<string | null>(discoveryStore.selectedChampion)
const selectedRole = ref<FilterRole>(discoveryStore.selectedRole)
const sortBy = ref<SortOption>(discoveryStore.sortBy)

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

const handleUpToDateChange = () => {
  discoveryStore.setOnlyUpToDate(onlyUpToDate.value)
}

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
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
    active
      ? 'border-accent bg-accent/20 text-accent'
      : 'border-accent/70 bg-background/10 text-accent-dark hover:border-accent hover:bg-accent/10 hover:text-accent',
  ].join(' ')

const handleSortChange = () => {
  discoveryStore.setSortBy(sortBy.value)
}

const clearFilters = () => {
  discoveryStore.clearAllFilters()
  onlyUpToDate.value = false
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
})

watch(locale, () => {
  loadChampionsForLocale()
})
</script>
