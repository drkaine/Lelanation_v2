import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { PatchEntity } from '~/stores/PatchNotesStore'
import { resolvePatchNotesAssetPath } from '~/stores/PatchNotesStore'
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

/** Riot patch slugs that no longer match the current in-game item name. */
const ITEM_PATCH_SLUG_TO_ID: Record<string, string> = {
  'sunfire-cape': '3068',
}
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

export function resolveModeSubCategoryImageKind(subCategory?: string): PatchEntityImageKind {
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

/** @deprecated Use resolveModeSubCategoryImageKind */
export function resolveArenaImageKind(subCategory?: string): PatchEntityImageKind {
  return resolveModeSubCategoryImageKind(subCategory)
}

const STRUCTURED_MODE_CATEGORIES = new Set<PatchEntity['category']>([
  'classic',
  'aram',
  'aram-chaos',
  'arena',
])

export function resolvePatchEntityImageKind(entity: PatchEntity): PatchEntityImageKind {
  if (entity.category === 'champion') return 'champion'
  if (entity.category === 'item') return 'item'
  if (entity.category === 'rune') return 'rune'

  if (STRUCTURED_MODE_CATEGORIES.has(entity.category)) {
    const fromSubCategory = resolveModeSubCategoryImageKind(entity.subCategory)
    if (fromSubCategory) return fromSubCategory
    if (entity.category === 'arena' && !entity.subCategory?.trim()) return 'champion'
    return null
  }

  if (isSummonerSpellPatchEntity(entity)) return 'summoner'
  return null
}

function championLookupKey(value: string): string {
  return normalizeLookupKey(value).replace(/'/g, '')
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
    () =>
      [
        entity().id,
        entity().name,
        entity().category,
        entity().subCategory,
        entity().imageUrl,
      ] as const,
    () => {
      imageError.value = false
    }
  )

  function resolveCachedPatchImageUrl(current: PatchEntity): string | null {
    const raw = current.imageUrl?.trim()
    if (!raw) return null
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    if (raw.startsWith('/data/patch-notes/')) return raw
    return resolvePatchNotesAssetPath(raw, '')
  }

  function findItemIdByPatchSlug(patchSlug?: string | null): string | null {
    const slug = patchSlug?.trim().toLowerCase()
    if (!slug) return null

    const override = ITEM_PATCH_SLUG_TO_ID[slug]
    if (override) return override

    const slugAsName = normalizeLookupKey(slug.replace(/-/g, ' '))
    return (
      itemsStore.items.find(item => {
        const itemSlug = normalizeLookupKey(item.name.replace(/\s+/g, '-'))
        const itemName = normalizeLookupKey(item.name)
        return itemSlug === normalizeLookupKey(slug) || itemName === slugAsName
      })?.id ?? null
    )
  }

  function findItemIdByName(name: string): string | null {
    const key = normalizeLookupKey(name)
    return itemsStore.items.find(item => normalizeLookupKey(item.name) === key)?.id ?? null
  }

  function findChampionIdByName(name: string): string | null {
    const key = championLookupKey(name)
    const champion = championsStore.champions.find(
      c => championLookupKey(c.name) === key || championLookupKey(c.id) === key
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

  function parseEntityDisplayName(name: string): string {
    const honoredGuest = parseHonoredGuestChampionName(name)
    const improvementMatch = honoredGuest.match(/^am[eé]lioration\s*-\s*(.+)$/i)
    if (improvementMatch) return improvementMatch[1].trim()
    return honoredGuest
  }

  function resolveImageKind(current: PatchEntity): PatchEntityImageKind {
    const fromCategory = resolvePatchEntityImageKind(current)
    if (fromCategory) return fromCategory

    if (!STRUCTURED_MODE_CATEGORIES.has(current.category)) return null

    const name = parseEntityDisplayName(current.name?.trim() ?? '')
    if (!name) return null

    if (findChampionIdByName(name)) return 'champion'
    if (findItemIdByName(name)) return 'item'
    return null
  }

  function resolveChampionLookupName(current: PatchEntity): string {
    const rawName = current.name?.trim() ?? ''
    if (!rawName) return ''

    if (
      isStructuredModeCategory(current.category) &&
      (resolveModeSubCategoryImageKind(current.subCategory) === 'champion' ||
        !current.subCategory?.trim())
    ) {
      return parseEntityDisplayName(rawName)
    }

    return rawName
  }

  function isStructuredModeCategory(category: PatchEntity['category']): boolean {
    return STRUCTURED_MODE_CATEGORIES.has(category)
  }

  const resolvedEntityId = computed(() => {
    const current = entity()
    let kind = resolveImageKind(current)

    if (kind === 'summoner') {
      return findSummonerSpellId(current)
    }

    if (current.id) {
      if (kind === 'champion' && /^\d+$/.test(current.id)) {
        kind = 'item'
      } else if (kind === 'item' && !/^\d+$/.test(current.id)) {
        kind = 'champion'
      }

      if (kind === 'rune' && !/^\d+$/.test(current.id)) {
        return (
          findRuneIdByKey(current.id) ?? findRuneIdByName(current.name?.trim() ?? '') ?? current.id
        )
      }
      return current.id
    }

    const name = current.name?.trim()
    if (!name) return null

    if (kind === 'item') {
      return (
        findItemIdByPatchSlug(current.patchSlug) ?? findItemIdByName(parseEntityDisplayName(name))
      )
    }
    if (kind === 'champion') {
      return findChampionIdByName(resolveChampionLookupName(current))
    }
    if (kind === 'rune') return findRuneIdByName(name)

    return null
  })

  const entityImageUrl = computed(() => {
    if (imageError.value) return null

    const current = entity()
    const cachedPatchImage = resolveCachedPatchImageUrl(current)
    if (cachedPatchImage) return cachedPatchImage

    if (!gameVersion.value) return null
    let kind = resolveImageKind(current)
    if (!kind) return null

    const id = resolvedEntityId.value ?? current.id
    if (!id) return null

    if (kind === 'champion' && /^\d+$/.test(String(id))) kind = 'item'
    if (kind === 'item' && !/^\d+$/.test(String(id))) kind = 'champion'

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
