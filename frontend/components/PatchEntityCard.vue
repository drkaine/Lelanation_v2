<template>
  <div class="ui-build-card-surface overflow-hidden rounded-xl">
    <div
      v-if="showCardHeader"
      class="flex items-center gap-2 border-b border-primary/15 bg-panel-elevated/30 p-[5px]"
    >
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background text-lg">
        <img
          v-if="entityImageUrl"
          :src="entityImageUrl"
          :alt="cardTitle"
          class="h-full w-full rounded object-cover"
          @error="onImageError"
        />
        <Icon
          v-else-if="isBugfixCard"
          name="mdi:bug"
          class="h-5 w-5 text-warning"
          aria-hidden="true"
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
                <span v-if="shouldShowBefore(change)" class="text-error/70 line-through">{{
                  change.before
                }}</span>
                <span
                  v-if="shouldShowBefore(change) && shouldShowAfter(change)"
                  class="text-text/40"
                  >→</span
                >
                <template v-if="shouldShowAfter(change)">
                  <span
                    v-if="!change.linkUrl"
                    :class="{
                      'font-medium text-info': change.type === 'buff',
                      'font-medium text-error': change.type === 'nerf',
                    }"
                    >{{ change.after }}</span
                  >
                  <span
                    v-else
                    :class="{
                      'font-medium text-info': change.type === 'buff',
                      'font-medium text-error': change.type === 'nerf',
                    }"
                  >
                    {{ splitLinkText(change).before
                    }}<a
                      :href="change.linkUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-medium text-accent underline hover:text-accent/80"
                      >{{ change.linkLabel || change.linkUrl }}</a
                    >{{ splitLinkText(change).after }}
                  </span>
                </template>
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
import { resolvePatchEntitySummaryTag } from '~/utils/patchEntitySummary'

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

function isBugfixSubCategory(value?: string | null): boolean {
  if (!value) return false
  const normalized = value.toLowerCase()
  return normalized.includes('bug') || normalized.includes('correction')
}

const isBugfixCard = computed(
  () =>
    props.entity.category === 'bugfix' ||
    (['aram', 'aram-chaos', 'arena'].includes(props.entity.category) &&
      isBugfixSubCategory(props.entity.subCategory))
)

const showCardHeader = computed(() => {
  if (isBugfixCard.value) return true
  if (isArenaCard.value) {
    return Boolean(props.entity.subCategory?.trim() || props.entity.name?.trim())
  }
  return Boolean(props.entity.name)
})

const cardTitle = computed(() => {
  if (isBugfixCard.value) {
    return props.entity.name?.trim() || t('patchNotesPage.bugfixCardTitle')
  }
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

const summaryTag = computed(() => resolvePatchEntitySummaryTag(props.entity))

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
    title:
      isBugfixCard.value && isBugfixSubCategory(group.title)
        ? ''
        : isArenaCard.value
          ? ''
          : group.title,
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
  buff: 'bg-info/20 text-info',
  nerf: 'bg-error/20 text-error',
  adjustment: 'bg-warning/20 text-warning',
  new: 'bg-info/20 text-info',
  removed: 'bg-muted/20 text-text/60',
  text: 'bg-primary/15 text-primary-light',
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

function splitLinkText(change: StatChange): { before: string; after: string } {
  const label = change.linkLabel?.trim()
  if (!label) {
    return { before: change.after, after: '' }
  }

  const index = change.after.toLowerCase().indexOf(label.toLowerCase())
  if (index === -1) {
    return { before: change.after, after: '' }
  }

  return {
    before: change.after.slice(0, index),
    after: change.after.slice(index + label.length),
  }
}
</script>
