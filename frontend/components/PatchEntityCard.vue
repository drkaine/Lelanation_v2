<template>
  <div
    class="overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-sm transition-shadow hover:shadow-md"
  >
    <div
      v-if="showCardHeader"
      class="flex items-center gap-2 border-b border-primary/10 bg-primary/5 p-[5px]"
    >
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background text-lg">
        <img
          v-if="entityImageUrl"
          :src="entityImageUrl"
          :alt="cardTitle"
          class="h-full w-full rounded object-cover"
          @error="onImageError"
        />
        <span v-else>{{ categoryIcon }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-accent">
          {{ cardTitle }}
        </h3>
        <p v-if="cardSubtitle" class="truncate text-xs text-primary-light">
          {{ cardSubtitle }}
        </p>
      </div>

      <span
        v-if="summaryTag"
        :class="[
          'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide',
          typeClasses[summaryTag],
        ]"
      >
        {{ typeLabels[summaryTag] }}
      </span>
    </div>

    <div class="p-[5px]">
      <div
        v-for="section in changeSections"
        :key="section.key"
        :class="section.title ? 'border-b border-primary/10 last:border-b-0' : ''"
      >
        <button
          v-if="section.title"
          type="button"
          class="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-primary/5"
          :aria-expanded="!isSectionCollapsed(section.key)"
          @click="toggleSection(section.key)"
        >
          <ChampionSpellIconBadge
            v-if="section.spellImageUrl && section.spellSkillKey"
            :skill-key="section.spellSkillKey"
            :image-url="section.spellImageUrl"
            :label="section.title"
            size="sm"
          />
          <span class="min-w-0 flex-1 truncate text-xs font-semibold text-primary-light">
            {{ section.title }}
          </span>
          <span class="shrink-0 text-[10px] text-text/40">
            {{ isSectionCollapsed(section.key) ? '▸' : '▾' }}
          </span>
        </button>

        <ul
          v-show="!section.title || !isSectionCollapsed(section.key)"
          class="space-y-2"
          :class="section.title ? 'px-1 pb-2 pt-0.5' : ''"
        >
          <li
            v-for="(change, index) in section.changes"
            :key="`${section.key}-${index}`"
            class="flex items-start gap-2 text-sm"
          >
            <span
              v-if="change.stat || change.type !== 'text'"
              :class="[
                'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide',
                typeClasses[change.type],
              ]"
            >
              {{ typeLabels[change.type] }}
            </span>

            <div class="flex-1">
              <span v-if="change.stat" class="font-medium text-primary-light">{{
                change.stat
              }}</span>
              <div
                :class="[
                  'flex flex-wrap items-center gap-1 text-xs text-text/70',
                  change.stat ? 'mt-0.5' : '',
                ]"
              >
                <span v-if="shouldShowBefore(change)" class="line-through decoration-red-500/50">{{
                  change.before
                }}</span>
                <span
                  v-if="shouldShowBefore(change) && shouldShowAfter(change)"
                  class="text-text/40"
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
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { Champion } from '@lelanation/shared-types'
import type { PatchEntity, StatChange, ChangeType } from '~/stores/PatchNotesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { getChampionSpellImageUrl, getChampionPassiveImageUrl } from '~/utils/imageUrl'
import { usePatchEntityImage } from '~/composables/usePatchEntityImage'
import ChampionSpellIconBadge, {
  type ChampionSpellBadgeKey,
} from '~/components/statistics/ChampionSpellIconBadge.vue'
import { resolvePatchEntitySummaryType } from '~/utils/patchEntitySummary'

const props = defineProps<{
  entity: PatchEntity
}>()

const { t, locale } = useI18n()
const championsStore = useChampionsStore()
const championDetail = ref<Champion | null>(null)
const collapsedSections = ref<Set<string>>(new Set())

const versionStore = useVersionStore()
const { currentVersion: gameVersion } = storeToRefs(versionStore)

const { entityImageUrl, resolvedEntityId, onImageError } = usePatchEntityImage(() => props.entity)

const isArenaCard = computed(() => props.entity.category === 'arena')

const showCardHeader = computed(() => {
  if (isArenaCard.value) {
    return Boolean(props.entity.subCategory?.trim() || props.entity.name?.trim())
  }
  return Boolean(props.entity.name)
})

const cardTitle = computed(() => {
  if (isArenaCard.value) {
    return props.entity.subCategory?.trim() || props.entity.name || ''
  }
  return props.entity.name
})

const cardSubtitle = computed(() => {
  if (isArenaCard.value && props.entity.subCategory?.trim() && props.entity.name?.trim()) {
    return props.entity.name
  }
  if (!isArenaCard.value && props.entity.subCategory?.trim() && !hasGroupedSections.value) {
    return props.entity.subCategory
  }
  return ''
})

const summaryTag = computed(() => resolvePatchEntitySummaryType(props.entity.changes))

onMounted(() => {
  if (!gameVersion.value) {
    versionStore.loadCurrentVersion()
  }
  loadChampionDetail()
})

watch(
  () => [resolvedEntityId.value, props.entity.category, locale.value] as const,
  () => {
    loadChampionDetail()
  }
)

const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))

async function loadChampionDetail() {
  if (props.entity.category !== 'champion' || !resolvedEntityId.value) {
    championDetail.value = null
    return
  }
  championDetail.value = await championsStore.loadChampionDetails(
    resolvedEntityId.value,
    riotLocale.value
  )
}

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

function resolveSectionSpellKey(title: string): ChampionSpellBadgeKey | null {
  if (!title || /^stats de base$/i.test(title) || /^base stats$/i.test(title)) return null
  if (/passive/i.test(title)) return 'P'

  const match = title.match(/^([A-Z]|Passive)\s*-\s*(.+)$/i)
  if (!match) return null

  return FR_KEY_TO_SLOT[match[1].toUpperCase()] ?? null
}

function resolveSectionSpellUrl(title: string): string | null {
  if (!gameVersion.value || !championDetail.value || !resolvedEntityId.value || !title) return null
  if (!resolveSectionSpellKey(title)) return null

  const imageFile = resolveSpellImageFile(championDetail.value, title)
  if (!imageFile) return null

  if (/passive/i.test(title)) {
    return getChampionPassiveImageUrl(gameVersion.value, imageFile)
  }

  return getChampionSpellImageUrl(gameVersion.value, resolvedEntityId.value, imageFile)
}

interface ChangeSection {
  key: string
  title: string
  changes: StatChange[]
  spellImageUrl: string | null
  spellSkillKey: ChampionSpellBadgeKey | null
}

const changeSections = computed<ChangeSection[]>(() => {
  const groups: { title: string; changes: StatChange[] }[] = []
  const indexByTitle = new Map<string, number>()

  for (const change of props.entity.changes) {
    const title = change.subCategory?.trim() || props.entity.subCategory?.trim() || ''
    let idx = indexByTitle.get(title)
    if (idx === undefined) {
      idx = groups.length
      indexByTitle.set(title, idx)
      groups.push({ title, changes: [] })
    }
    groups[idx].changes.push(change)
  }

  return groups.map((group, index) => ({
    key: group.title || `__section__${index}`,
    title: isArenaCard.value ? '' : group.title,
    changes: group.changes,
    spellImageUrl: resolveSectionSpellUrl(group.title),
    spellSkillKey: resolveSectionSpellKey(group.title),
  }))
})

const hasGroupedSections = computed(
  () => !isArenaCard.value && changeSections.value.some(section => section.title)
)

function isSectionCollapsed(key: string): boolean {
  return collapsedSections.value.has(key)
}

function toggleSection(key: string) {
  const next = new Set(collapsedSections.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  collapsedSections.value = next
}

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

function shouldShowBefore(change: { before: string; type: ChangeType }): boolean {
  if (change.type === 'new') return false
  if (change.before.startsWith('(') && change.before.endsWith(')')) return false
  return Boolean(change.before)
}

function shouldShowAfter(change: { after: string; type: ChangeType }): boolean {
  if (change.type === 'removed') return false
  return Boolean(change.after)
}
</script>
