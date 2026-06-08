<template>
  <div
    class="overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-sm transition-shadow hover:shadow-md"
  >
    <!-- Entity Header -->
    <div
      v-if="entity.name"
      class="flex items-center gap-2 border-b border-primary/10 bg-primary/5 p-[5px]"
    >
      <!-- Champion/Item Icon -->
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background text-lg">
        <img
          v-if="championImageUrl"
          :src="championImageUrl"
          :alt="entity.name"
          class="h-full w-full rounded object-cover"
          @error="onChampionImageError"
        />
        <img
          v-else-if="itemImageUrl"
          :src="itemImageUrl"
          :alt="entity.name"
          class="h-full w-full rounded object-cover"
          @error="onItemImageError"
        />
        <img
          v-else-if="runeImageUrl"
          :src="runeImageUrl"
          :alt="entity.name"
          class="h-full w-full rounded object-cover"
          @error="onRuneImageError"
        />
        <span v-else>{{ categoryIcon }}</span>
      </div>

      <!-- Spell Icon (for champions) -->
      <div
        v-if="showSpellIcon && spellImageUrl"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-background/50"
      >
        <img
          :src="spellImageUrl"
          :alt="entity.subCategory || 'spell'"
          class="h-full w-full rounded object-cover"
          @error="onSpellImageError"
        />
      </div>

      <!-- Title: ability / stats block when present, else entity name -->
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-accent">
          {{ cardTitle }}
        </h3>
        <p v-if="cardSubtitle" class="truncate text-xs text-text/60">
          {{ cardSubtitle }}
        </p>
      </div>
    </div>

    <!-- Changes List -->
    <div class="p-[5px]">
      <ul class="space-y-2">
        <li
          v-for="(change, index) in entity.changes"
          :key="index"
          class="flex items-start gap-2 text-sm"
        >
          <!-- Change Type Indicator -->
          <span
            v-if="change.stat || change.type !== 'text'"
            :class="[
              'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide',
              typeClasses[change.type],
            ]"
          >
            {{ typeLabels[change.type] }}
          </span>

          <!-- Change Content -->
          <div class="flex-1">
            <span v-if="change.stat" class="font-medium text-primary-light">{{ change.stat }}</span>
            <div
              :class="[
                'flex flex-wrap items-center gap-1 text-xs text-text/70',
                change.stat ? 'mt-0.5' : '',
              ]"
            >
              <span v-if="shouldShowBefore(change)" class="line-through decoration-red-500/50">{{
                change.before
              }}</span>
              <span v-if="shouldShowBefore(change) && shouldShowAfter(change)" class="text-text/40"
                >→</span
              >
              <span
                v-if="shouldShowAfter(change)"
                :class="{
                  'font-medium text-green-400': change.type === 'buff',
                  'font-medium text-red-400': change.type === 'nerf',
                }"
                >{{ change.after }}</span
              >
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { Champion } from '@lelanation/shared-types'
import type { PatchEntity, ChangeType } from '~/stores/PatchNotesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import {
  getChampionImageUrl,
  getItemImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
  getRuneImageUrl,
} from '~/utils/imageUrl'
import { useGameDataLookup } from '~/composables/useGameDataLookup'

const props = defineProps<{
  entity: PatchEntity
}>()

const { t, locale } = useI18n()
const { getRuneIcon } = useGameDataLookup()
const championsStore = useChampionsStore()
const championDetail = ref<Champion | null>(null)
const championImageError = ref(false)
const spellImageError = ref(false)
const itemImageError = ref(false)
const runeImageError = ref(false)

// Get current game version for image URLs
const versionStore = useVersionStore()
const { currentVersion: gameVersion } = storeToRefs(versionStore)

// Load version if not already loaded
onMounted(() => {
  if (!gameVersion.value) {
    versionStore.loadCurrentVersion()
  }
  loadChampionDetail()
})

watch(
  () => [props.entity.id, props.entity.subCategory, locale.value] as const,
  () => {
    spellImageError.value = false
    loadChampionDetail()
  }
)

const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))

async function loadChampionDetail() {
  if (props.entity.category !== 'champion' || !props.entity.id || !props.entity.subCategory) {
    championDetail.value = null
    return
  }
  if (/passive/i.test(props.entity.subCategory)) {
    const detail = await championsStore.loadChampionDetails(props.entity.id, riotLocale.value)
    championDetail.value = detail
    return
  }
  if (!/^([A-Z]|Passive)\s*-/i.test(props.entity.subCategory)) {
    championDetail.value = null
    return
  }
  const detail = await championsStore.loadChampionDetails(props.entity.id, riotLocale.value)
  championDetail.value = detail
}

/** French client keys: A=Q, Z=W, E=E, R=R */
const FR_KEY_TO_SLOT: Record<string, 'Q' | 'W' | 'E' | 'R'> = {
  A: 'Q',
  Z: 'W',
  E: 'E',
  R: 'R',
  Q: 'Q',
  W: 'W',
}

function resolveSpellImageFile(champion: Champion, subCategory: string): string | null {
  if (/passive/i.test(subCategory)) {
    return champion.passive?.image?.full ?? null
  }

  const match = subCategory.match(/^([A-Z]|Passive)\s*-\s*(.+)$/i)
  if (!match) return null

  const slot = FR_KEY_TO_SLOT[match[1].toUpperCase()]
  const spellName = match[2].trim()
  if (!slot) return null

  const spells = champion.spells ?? []
  const byName = spells.find(s => s.name?.trim().toLowerCase() === spellName.toLowerCase())
  if (byName?.image?.full) return byName.image.full

  const bySlot = spells.find(s => String(s.slot ?? '').toUpperCase() === slot)
  return bySlot?.image?.full ?? null
}

const cardTitle = computed(() => props.entity.subCategory?.trim() || props.entity.name)

const cardSubtitle = computed(() => (props.entity.subCategory?.trim() ? props.entity.name : ''))

const showSpellIcon = computed(() => {
  if (props.entity.category !== 'champion' || !props.entity.subCategory) return false
  if (/^stats de base$/i.test(props.entity.subCategory)) return false
  if (/^base stats$/i.test(props.entity.subCategory)) return false
  if (/passive/i.test(props.entity.subCategory)) return true
  return /^([A-Z]|Passive)\s*-/i.test(props.entity.subCategory)
})

const typeClasses: Record<ChangeType, string> = {
  buff: 'bg-green-500/20 text-green-400',
  nerf: 'bg-red-500/20 text-red-400',
  adjustment: 'bg-yellow-500/20 text-yellow-400',
  new: 'bg-blue-500/20 text-blue-400',
  removed: 'bg-gray-500/20 text-gray-400',
  text: 'bg-purple-500/20 text-purple-400',
}

const typeLabels: Record<ChangeType, string> = {
  buff: t('patchNotesPage.changeTypes.buff'),
  nerf: t('patchNotesPage.changeTypes.nerf'),
  adjustment: t('patchNotesPage.changeTypes.adjustment'),
  new: t('patchNotesPage.changeTypes.new'),
  removed: t('patchNotesPage.changeTypes.removed'),
  text: t('patchNotesPage.changeTypes.text'),
}

const categoryIcon = computed(() => {
  switch (props.entity.category) {
    case 'champion':
      return '🏆'
    case 'item':
      return '🛡️'
    case 'rune':
      return '✨'
    case 'system':
      return '⚙️'
    case 'aram':
      return '🎲'
    case 'aram-chaos':
      return '🌀'
    case 'arena':
      return '🏟️'
    case 'bugfix':
      return '🐛'
    default:
      return '📝'
  }
})

// Champion portrait image URL
const championImageUrl = computed(() => {
  if (championImageError.value) return null
  if (!gameVersion.value) return null

  const isChampionCategory =
    props.entity.category === 'champion' ||
    props.entity.category === 'aram' ||
    props.entity.category === 'aram-chaos' ||
    props.entity.category === 'arena'

  if (!isChampionCategory || !props.entity.id) return null

  return getChampionImageUrl(gameVersion.value, `${props.entity.id}.png`)
})

// Spell/Passive image URL for champions (from game data + French patch keys)
const spellImageUrl = computed(() => {
  if (spellImageError.value) return null
  if (!gameVersion.value || !championDetail.value || !props.entity.subCategory) return null

  const imageFile = resolveSpellImageFile(championDetail.value, props.entity.subCategory)
  if (!imageFile) return null

  if (/passive/i.test(props.entity.subCategory)) {
    return getChampionPassiveImageUrl(gameVersion.value, imageFile)
  }

  return getChampionSpellImageUrl(gameVersion.value, props.entity.id!, imageFile)
})

// Item image URL
const itemImageUrl = computed(() => {
  if (itemImageError.value) return null
  if (!gameVersion.value) return null
  if (props.entity.category !== 'item' || !props.entity.id) return null

  return getItemImageUrl(gameVersion.value, `${props.entity.id}.png`)
})

// Rune image URL (local, via numeric id → runesReforged icon)
const runeImageUrl = computed(() => {
  if (runeImageError.value) return null
  if (props.entity.category !== 'rune' || !gameVersion.value) return null

  const numericId = props.entity.id ? Number(props.entity.id) : NaN
  if (!Number.isFinite(numericId) || numericId <= 0) return null

  const icon = getRuneIcon(numericId)
  if (!icon) return null

  return getRuneImageUrl(gameVersion.value, icon)
})

function onChampionImageError() {
  championImageError.value = true
}

function onSpellImageError() {
  spellImageError.value = true
}

function onItemImageError() {
  itemImageError.value = true
}

function onRuneImageError() {
  runeImageError.value = true
}

function shouldShowBefore(change: { before: string; type: ChangeType }): boolean {
  // Don't show before for new additions
  if (change.type === 'new') return false
  // Don't show if before is a placeholder
  if (change.before.startsWith('(') && change.before.endsWith(')')) return false
  return Boolean(change.before)
}

function shouldShowAfter(change: { after: string; type: ChangeType }): boolean {
  // Don't show after for removed items
  if (change.type === 'removed') return false
  return Boolean(change.after)
}
</script>
