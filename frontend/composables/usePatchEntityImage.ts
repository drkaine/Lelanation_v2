import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { PatchEntity } from '~/stores/PatchNotesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import {
  getChampionImageUrl,
  getItemImageUrl,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'
import { useGameDataLookup } from '~/composables/useGameDataLookup'

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseHonoredGuestChampionName(name: string): string {
  const colonIdx = name.indexOf(':')
  return colonIdx >= 0 ? name.slice(0, colonIdx).trim() : name
}

/** Patch note keys that differ from game data `rune.key` (Riot renames). */
const RUNE_KEY_ALIASES: Record<string, string> = {
  StormraiderSurge: 'PhaseRush',
}

function resolveRuneGameKey(keyOrAlias: string): string {
  return RUNE_KEY_ALIASES[keyOrAlias] ?? keyOrAlias
}

export type PatchEntityImageKind = 'champion' | 'item' | 'rune' | 'summoner' | null

/** Patch slugs Riot pour les sorts d'invocateur (section Système). */
const SUMMONER_SPELL_PATCH_SLUGS = new Set([
  'teleport',
  'flash',
  'ignite',
  'smite',
  'barrier',
  'heal',
  'ghost',
  'exhaust',
  'cleanse',
  'clarity',
  'haste',
  'snowball',
  'mark',
  'boost',
  'recall',
  'dot',
  'mana',
  'pororecall',
  'porothrow',
  'summonerteleport',
  'summonerflash',
  'summonerignite',
  'summonersmite',
  'summonerbarrier',
  'summonerheal',
  'summonerhaste',
  'summonerexhaust',
  'summonercleanse',
  'summonerdot',
  'summonermana',
  'summonersnowball',
  'summonermark',
  'summonerboost',
  'summonerpororecall',
  'summonerporothrow',
])

export function patchSlugToSummonerSpellId(patchSlug: string): string {
  const compact = patchSlug.replace(/-/g, '')
  return /^summoner/i.test(compact) ? compact : `Summoner${compact}`
}

export function isSummonerSpellPatchEntity(entity: PatchEntity): boolean {
  if (entity.category !== 'system') return false
  const slug = (entity.patchSlug ?? '').trim()
  if (!slug || slug.length > 32 || /\s/.test(slug)) return false
  return SUMMONER_SPELL_PATCH_SLUGS.has(slug.toLowerCase())
}

export function resolveArenaImageKind(subCategory?: string): PatchEntityImageKind {
  const sub = normalizeLookupKey(subCategory ?? '')
  if (!sub) return null
  if (sub.includes('objet') || sub.includes('item')) return 'item'
  if (
    sub.includes('champion') ||
    sub.includes('invite') ||
    sub.includes('honneur') ||
    sub.includes('honor')
  ) {
    return 'champion'
  }
  if (sub.includes('rune')) return 'rune'
  return null
}

export function resolvePatchEntityImageKind(entity: PatchEntity): PatchEntityImageKind {
  if (
    entity.category === 'champion' ||
    entity.category === 'aram' ||
    entity.category === 'aram-chaos'
  ) {
    return 'champion'
  }
  if (entity.category === 'item') return 'item'
  if (entity.category === 'rune') return 'rune'
  if (entity.category === 'arena') return resolveArenaImageKind(entity.subCategory)
  if (isSummonerSpellPatchEntity(entity)) return 'summoner'
  return null
}

export function usePatchEntityImage(entity: () => PatchEntity) {
  const { locale } = useI18n()
  const { getRuneIcon } = useGameDataLookup()
  const itemsStore = useItemsStore()
  const championsStore = useChampionsStore()
  const runesStore = useRunesStore()
  const summonerSpellsStore = useSummonerSpellsStore()
  const versionStore = useVersionStore()
  const { currentVersion: gameVersion } = storeToRefs(versionStore)
  const imageError = ref(false)

  const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))

  function ensureGameDataLoaded() {
    if (!gameVersion.value) {
      versionStore.loadCurrentVersion().catch(() => undefined)
    }
    itemsStore.loadItems(riotLocale.value).catch(() => undefined)
    championsStore.loadChampions(riotLocale.value).catch(() => undefined)
    runesStore.loadRunes(riotLocale.value).catch(() => undefined)
    summonerSpellsStore.loadSummonerSpells(riotLocale.value).catch(() => undefined)
  }

  onMounted(ensureGameDataLoaded)

  watch(locale, ensureGameDataLoaded)

  watch(
    () => [entity().id, entity().name, entity().category, entity().subCategory] as const,
    () => {
      imageError.value = false
    }
  )

  function findItemIdByName(name: string): string | null {
    const key = normalizeLookupKey(name)
    return itemsStore.items.find(item => normalizeLookupKey(item.name) === key)?.id ?? null
  }

  function findChampionIdByName(name: string): string | null {
    const key = normalizeLookupKey(name)
    const champion = championsStore.champions.find(
      c => normalizeLookupKey(c.name) === key || normalizeLookupKey(c.id) === key
    )
    return champion?.id ?? null
  }

  function findRuneIdByName(name: string): string | null {
    const key = normalizeLookupKey(name)
    for (const path of runesStore.runePaths) {
      for (const slot of path.slots) {
        for (const rune of slot.runes) {
          if (normalizeLookupKey(rune.name) === key) {
            return String(rune.id)
          }
        }
      }
    }
    return null
  }

  function findRuneIdByKey(keyOrAlias: string): string | null {
    const gameKey = resolveRuneGameKey(keyOrAlias)
    for (const path of runesStore.runePaths) {
      for (const slot of path.slots) {
        for (const rune of slot.runes) {
          if (rune.key === gameKey) {
            return String(rune.id)
          }
        }
      }
    }
    return null
  }

  function findSummonerSpellId(entity: PatchEntity): string | null {
    if (entity.patchSlug) {
      const fromSlug = patchSlugToSummonerSpellId(entity.patchSlug)
      if (summonerSpellsStore.getSpellById(fromSlug)) return fromSlug
    }

    const name = entity.name?.trim()
    if (!name) return null

    const key = normalizeLookupKey(name)
    const fromName = summonerSpellsStore.spells.find(
      spell => normalizeLookupKey(spell.name) === key || normalizeLookupKey(spell.id) === key
    )
    return fromName?.id ?? null
  }

  const resolvedEntityId = computed(() => {
    const current = entity()
    const kind = resolvePatchEntityImageKind(current)

    if (kind === 'summoner') {
      return findSummonerSpellId(current)
    }

    if (current.id) {
      if (kind === 'rune' && !/^\d+$/.test(current.id)) {
        return (
          findRuneIdByKey(current.id) ?? findRuneIdByName(current.name?.trim() ?? '') ?? current.id
        )
      }
      return current.id
    }

    const name = current.name?.trim()
    if (!name) return null

    if (kind === 'item') return findItemIdByName(name)
    if (kind === 'champion') {
      const championName =
        current.category === 'arena' && resolveArenaImageKind(current.subCategory) === 'champion'
          ? parseHonoredGuestChampionName(name)
          : name
      return findChampionIdByName(championName)
    }
    if (kind === 'rune') return findRuneIdByName(name)

    return null
  })

  const entityImageUrl = computed(() => {
    if (imageError.value || !gameVersion.value) return null

    const current = entity()
    const kind = resolvePatchEntityImageKind(current)
    if (!kind) return null

    const id = resolvedEntityId.value ?? current.id
    if (!id) return null

    if (kind === 'champion') {
      return getChampionImageUrl(gameVersion.value, `${id}.png`)
    }

    if (kind === 'item') {
      return getItemImageUrl(gameVersion.value, `${id}.png`)
    }

    if (kind === 'summoner') {
      const spell = summonerSpellsStore.getSpellById(String(id))
      const imageFile = spell?.image?.full
      if (!imageFile) return null
      return getSpellImageUrl(gameVersion.value, imageFile)
    }

    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) return null

    const icon = getRuneIcon(numericId)
    if (!icon) return null

    return getRuneImageUrl(gameVersion.value, icon)
  })

  function onImageError() {
    imageError.value = true
  }

  return {
    entityImageUrl,
    resolvedEntityId,
    onImageError,
  }
}
