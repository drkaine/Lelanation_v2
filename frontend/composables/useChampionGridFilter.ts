import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameVersion } from '~/composables/useGameVersion'
import { useChampionsStore } from '~/stores/ChampionsStore'
import type { Champion } from '~/types/build'
import { riotLanguage } from '~/utils/riotLanguage'

/**
 * Champion grid with name search and role filters (champions outside the filter stay listed, dimmed).
 * Loads the champions in the current language on mount and on locale change.
 */
export function useChampionGridFilter() {
  const championsStore = useChampionsStore()
  const { locale, t } = useI18n()
  const { version } = useGameVersion()

  const searchQuery = ref('')
  const selectedRoles = ref<string[]>([])

  const currentLanguage = computed(() => riotLanguage(locale.value))

  const availableRoles = computed(() => {
    const roles = new Set<string>()
    for (const champion of championsStore.champions) {
      for (const tag of champion.tags) roles.add(tag)
    }
    return Array.from(roles).sort()
  })

  const filteredChampions = computed(() =>
    championsStore.searchChampions(
      searchQuery.value,
      selectedRoles.value.length > 0 ? selectedRoles.value : undefined
    )
  )

  const allChampions = computed(() => championsStore.champions)

  function isFiltered(champion: Champion): boolean {
    if (selectedRoles.value.length === 0 && !searchQuery.value) return true
    return filteredChampions.value.some(c => c.id === champion.id)
  }

  function toggleRole(role: string): void {
    const index = selectedRoles.value.indexOf(role)
    if (index > -1) selectedRoles.value.splice(index, 1)
    else selectedRoles.value.push(role)
  }

  function translateRole(role: string): string {
    return t(`champion.${role.toLowerCase()}`, role)
  }

  /** Full champion data (spells, stats…), falling back to the list entry. */
  async function loadChampionDetails(champion: Champion): Promise<Champion> {
    const detailed = await championsStore
      .loadChampionDetails(champion.id, currentLanguage.value)
      .catch(() => null)
    return (detailed ?? champion) as Champion
  }

  function loadChampionsForCurrentLanguage() {
    return championsStore.loadChampions(currentLanguage.value)
  }

  onMounted(loadChampionsForCurrentLanguage)
  watch(locale, loadChampionsForCurrentLanguage)

  return {
    championsStore,
    version,
    searchQuery,
    selectedRoles,
    currentLanguage,
    availableRoles,
    filteredChampions,
    allChampions,
    isFiltered,
    toggleRole,
    translateRole,
    loadChampionDetails,
  }
}
