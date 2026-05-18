import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheorycraftChampionStore } from '~/stores/TheorycraftChampionStore'

type SupportedLang = 'fr_FR' | 'en_US'
type ChampionIndexEntry = {
  id: string
  key: number
  name: string
  title: string
  roles: string[]
  tags: string[]
}

export function useChampionData() {
  const { locale } = useI18n()
  const lang = computed<SupportedLang>(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))
  const store = useTheorycraftChampionStore()

  function loadIndex(): Promise<ChampionIndexEntry[]> {
    return store.loadIndex(lang.value)
  }

  function loadChampion(id: string): Promise<Record<string, unknown>> {
    return store.loadChampion(lang.value, id)
  }

  return {
    lang,
    status: computed(() => store.status),
    error: computed(() => store.error),
    loadIndex,
    loadChampion,
  }
}
