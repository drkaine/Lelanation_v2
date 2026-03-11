import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'

/**
 * Centralized game-data lookup composable.
 * Delegates to the existing Pinia stores (which already handle version detection,
 * static-file fetching with cache-busting, and API fallback).
 * Triggers a load on mount and on locale change so data is always up-to-date.
 */
export function useGameDataLookup() {
  const { locale } = useI18n()
  const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))

  const itemsStore = useItemsStore()
  const runesStore = useRunesStore()
  const spellsStore = useSummonerSpellsStore()

  function ensureLoaded() {
    if (itemsStore.status === 'idle' || itemsStore.items.length === 0) {
      itemsStore.loadItems(riotLocale.value).catch(() => undefined)
    }
    if (runesStore.status === 'idle' || runesStore.runePaths.length === 0) {
      runesStore.loadRunes(riotLocale.value).catch(() => undefined)
    }
    if (spellsStore.status === 'idle' || spellsStore.spells.length === 0) {
      spellsStore.loadSummonerSpells(riotLocale.value).catch(() => undefined)
    }
  }

  onMounted(ensureLoaded)

  watch(locale, () => {
    itemsStore.loadItems(riotLocale.value).catch(() => undefined)
    runesStore.loadRunes(riotLocale.value).catch(() => undefined)
    spellsStore.loadSummonerSpells(riotLocale.value).catch(() => undefined)
  })

  // ── Lookup functions ─────────────────────────────────────────────────────

  function getItemName(id: string | undefined | null): string {
    if (!id) return ''
    return itemsStore.items.find(i => i.id === id)?.name ?? ''
  }

  function getSpellName(
    spell: { id?: string; key?: string; name?: string } | null | undefined
  ): string {
    if (!spell) return ''
    const id = spell.id ?? spell.key ?? ''
    if (id) {
      const found = spellsStore.getSpellById(id)
      if (found?.name) return found.name
    }
    return spell.name ?? ''
  }

  function getRuneName(runeId: number | undefined | null): string {
    if (!runeId) return ''
    for (const path of runesStore.runePaths) {
      for (const slot of path.slots) {
        for (const rune of slot.runes) {
          if (rune.id === runeId) return rune.name
        }
      }
    }
    return ''
  }

  function getRunePathName(pathId: number | undefined | null): string {
    if (!pathId) return ''
    return runesStore.getRunePathById(pathId)?.name ?? ''
  }

  function getRunePathIcon(pathId: number | undefined | null): string {
    if (!pathId) return ''
    return runesStore.getRunePathById(pathId)?.icon ?? ''
  }

  function getRuneIcon(runeId: number | undefined | null): string {
    if (!runeId) return ''
    for (const path of runesStore.runePaths) {
      for (const slot of path.slots) {
        for (const rune of slot.runes) {
          if (rune.id === runeId) return rune.icon
        }
      }
    }
    return ''
  }

  return {
    getItemName,
    getSpellName,
    getRuneName,
    getRunePathName,
    getRunePathIcon,
    getRuneIcon,
  }
}
