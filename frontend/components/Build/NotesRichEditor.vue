<template>
  <div class="notes-rich-editor">
    <div class="notes-rich-editor-toolbar" role="toolbar" :aria-label="t('buildNotes.toolbar')">
      <button
        type="button"
        class="notes-rich-editor-btn"
        :title="t('buildNotes.bold')"
        :aria-label="t('buildNotes.bold')"
        @mousedown.prevent="exec('bold')"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="notes-rich-editor-btn"
        :title="t('buildNotes.bulletList')"
        :aria-label="t('buildNotes.bulletList')"
        @mousedown.prevent="exec('insertUnorderedList')"
      >
        •≡
      </button>
      <div class="notes-rich-editor-toolbar-sep" aria-hidden="true"></div>
      <span v-if="entityBuildLabel" class="notes-rich-editor-build-label">{{
        entityBuildLabel
      }}</span>
      <div
        v-for="category in entityCategories"
        :key="category.key"
        :ref="el => setCategoryMenuRef(category.key, el)"
        class="notes-rich-editor-entity-wrap"
      >
        <button
          type="button"
          class="notes-rich-editor-btn notes-rich-editor-btn--entity"
          :class="{ 'is-open': openCategory === category.key }"
          :title="category.label"
          :aria-label="category.label"
          :disabled="false"
          @mousedown.prevent="toggleCategoryMenu(category.key)"
        >
          <img
            v-if="category.iconUrl"
            :src="category.iconUrl"
            alt=""
            class="notes-rich-editor-entity-btn-icon"
          />
          <span>{{ category.shortLabel }}</span>
        </button>
        <div v-if="openCategory === category.key" class="notes-rich-editor-entity-menu">
          <div v-if="category.items.length === 0" class="notes-rich-editor-entity-empty">
            {{ t('buildNotes.noEntitiesInCategory') }}
          </div>
          <button
            v-for="entity in category.items"
            :key="`${category.key}-${entity.id}`"
            type="button"
            class="notes-rich-editor-entity-item"
            @mousedown.prevent="insertEntity(entity)"
          >
            <img
              v-if="entity.imageUrl"
              :src="entity.imageUrl"
              alt=""
              class="notes-rich-editor-entity-thumb"
            />
            <span>{{ entity.label }}</span>
          </button>
        </div>
      </div>
      <span v-if="maxChars" class="notes-rich-editor-counter" :class="{ 'is-over': isOverLimit }">
        {{ charCount }}/{{ maxChars }}
      </span>
    </div>
    <div
      ref="editableRef"
      class="notes-rich-editor-body"
      contenteditable="true"
      role="textbox"
      :aria-placeholder="placeholderText"
      :data-placeholder="placeholderText"
      @input="onInput"
      @paste="onPaste"
      @blur="emitSanitized"
      @mouseover="onEntityMouseOver"
      @mousemove="onEntityMouseMove"
      @mouseout="onEntityMouseOut"
    />
    <Teleport to="body">
      <div
        v-if="entityTooltip.show && entityTooltipResolved"
        ref="entityTooltipRef"
        class="notes-entity-tooltip"
        :style="entityTooltipStyle"
      >
        <template v-if="entityTooltipResolved.type === 'item'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.item.name }}</div>
          <div
            class="notes-entity-tooltip-desc"
            v-html="entityTooltipResolved.item.descriptionHtml"
          ></div>
        </template>
        <template v-else-if="entityTooltipResolved.type === 'rune'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.rune.name }}</div>
          <div
            class="notes-entity-tooltip-desc"
            v-html="entityTooltipResolved.rune.descriptionHtml"
          ></div>
        </template>
        <template v-else-if="entityTooltipResolved.type === 'shard'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.shard.name }}</div>
          <div
            class="notes-entity-tooltip-desc"
            v-html="entityTooltipResolved.shard.descriptionHtml"
          />
        </template>
        <template v-else-if="entityTooltipResolved.type === 'spell'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.spell.name }}</div>
          <div
            class="notes-entity-tooltip-desc"
            v-html="entityTooltipResolved.spell.description"
          ></div>
        </template>
        <template v-else-if="entityTooltipResolved.type === 'skill'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.label }}</div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BuildNotesEntityType } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { sanitizeNotesHtml, notesPlainTextLength } from '~/utils/sanitizeNotesHtml'
import { buildNotesEntityHtml } from '~/utils/notesEntityHtml'
import {
  getNotesEntityCategories,
  getNotesEntityCategoryList,
  findRuneInPaths,
  isNotesPassiveSpellId,
  type NotesEntityCategoryKey,
  type NotesEntityOption,
} from '~/utils/notesBuildEntities'
import {
  formatItemTooltipHtml,
  formatRuneTooltipHtml,
  formatShardTooltipHtml,
} from '~/utils/formatTooltipMarkupHtml'
import { formatSummonerSpellTooltipHtml } from '~/utils/gameTooltipFormatter'
import { resolveItemDescription } from '~/utils/itemDescriptionFallbacks'
import { fixedTooltipStyleFromPointer } from '~/utils/tooltipPosition'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    maxChars?: number
  }>(),
  { placeholder: '', maxChars: 0 }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t, locale } = useI18n()
const buildStore = useBuildStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const versionStore = useVersionStore()

const editableRef = ref<HTMLDivElement | null>(null)
const categoryMenuRefs = ref<Partial<Record<NotesEntityCategoryKey, HTMLElement | null>>>({})
const entityTooltipRef = ref<HTMLElement | null>(null)
const isInternalUpdate = ref(false)
const openCategory = ref<NotesEntityCategoryKey | null>(null)
const charCount = ref(0)

function setCategoryMenuRef(key: NotesEntityCategoryKey, el: Element | null) {
  categoryMenuRefs.value[key] = el as HTMLElement | null
}

const versionForImages = computed(
  () => buildStore.displayedBuild?.gameVersion || versionStore.currentVersion || 'latest'
)
const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))

const entityBuildLabel = computed(() => {
  const root = buildStore.currentBuild
  const build = buildStore.displayedBuild
  if (!root || !build || (root.subBuilds?.length ?? 0) === 0) return ''
  if (buildStore.displayedVariant === 'main') {
    return t('buildNotes.entityBuildMain', { name: root.name || t('buildCard.mainBuildName') })
  }
  const idx = buildStore.displayedVariant as number
  const title = root.subBuilds?.[idx]?.title || t('buildCard.variantN', { n: idx + 2 })
  return t('buildNotes.entityBuildVariant', { name: title })
})

const entityCategoryMap = computed(() => {
  const build = buildStore.displayedBuild
  const empty = {
    item: [] as NotesEntityOption[],
    rune: [] as NotesEntityOption[],
    summoner: [] as NotesEntityOption[],
    shard: [] as NotesEntityOption[],
    spell: [] as NotesEntityOption[],
  }
  if (!build) return empty
  return getNotesEntityCategories(
    build,
    versionForImages.value,
    {
      items: t('buildNotes.entities.items'),
      runes: t('buildNotes.entities.runes'),
      summoner: t('buildNotes.entities.summoner'),
      shards: t('buildNotes.entities.shards'),
      spells: t('buildNotes.entities.spells'),
    },
    runesStore.runePaths,
    shardId => t(`runes.shards.${shardId}.name`, String(shardId))
  )
})

const entityCategories = computed(() =>
  getNotesEntityCategoryList(entityCategoryMap.value, {
    item: t('buildNotes.entities.items'),
    rune: t('buildNotes.entities.runes'),
    summoner: t('buildNotes.entities.summoner'),
    shard: t('buildNotes.entities.shards'),
    spell: t('buildNotes.entities.spells'),
  }).map(category => ({
    ...category,
    shortLabel: categoryShortLabels[category.key],
    iconUrl: category.items[0]?.imageUrl ?? categoryIconUrls[category.key],
  }))
)

const categoryShortLabels: Record<NotesEntityCategoryKey, string> = {
  item: 'Item',
  rune: 'Rune',
  summoner: 'Sum',
  shard: 'Shard',
  spell: 'Spell',
}

const categoryIconUrls: Partial<Record<NotesEntityCategoryKey, string>> = {
  shard: '/icons/shards/adaptative.png',
}

const placeholderText = computed(() => props.placeholder || t('buildNotes.placeholder'))
const isOverLimit = computed(() => props.maxChars > 0 && charCount.value > props.maxChars)

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
  editableRef.value?.focus()
  refreshCharCount()
}

function toggleCategoryMenu(key: NotesEntityCategoryKey) {
  openCategory.value = openCategory.value === key ? null : key
}

function insertEntity(entity: NotesEntityOption) {
  const html = buildNotesEntityHtml(entity)
  document.execCommand('insertHTML', false, html)
  openCategory.value = null
  editableRef.value?.focus()
  onInput()
}

function getSanitizedHtml(): string {
  const el = editableRef.value
  if (!el) return ''
  return sanitizeNotesHtml(el.innerHTML)
}

function refreshCharCount() {
  charCount.value = notesPlainTextLength(getSanitizedHtml())
}

function onInput() {
  isInternalUpdate.value = true
  const sanitized = getSanitizedHtml()
  refreshCharCount()
  emit('update:modelValue', sanitized)
  nextTick().then(() => {
    isInternalUpdate.value = false
  })
}

function emitSanitized() {
  if (!editableRef.value) return
  const sanitized = getSanitizedHtml()
  if (sanitized !== editableRef.value.innerHTML) {
    editableRef.value.innerHTML = sanitized
  }
  refreshCharCount()
  emit('update:modelValue', sanitized)
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
}

function syncFromModel() {
  if (!editableRef.value || isInternalUpdate.value) return
  const val = props.modelValue?.trim() || ''
  const sanitized = sanitizeNotesHtml(val)
  if (editableRef.value.innerHTML !== sanitized) {
    editableRef.value.innerHTML = sanitized
  }
  refreshCharCount()
}

watch(
  () => props.modelValue,
  () => syncFromModel()
)

function onDocumentPointerDown(event: MouseEvent) {
  if (!openCategory.value) return
  const target = event.target as Node | null
  const openEl = categoryMenuRefs.value[openCategory.value]
  if (target && openEl?.contains(target)) return
  openCategory.value = null
}

onMounted(() => {
  syncFromModel()
  document.addEventListener('mousedown', onDocumentPointerDown)
  if (runesStore.runePaths.length === 0) {
    runesStore.loadRunes().catch(() => undefined)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
})

const entityTooltip = ref<{
  show: boolean
  type: BuildNotesEntityType | null
  id: string
  pointer: { x: number; y: number }
}>({
  show: false,
  type: null,
  id: '',
  pointer: { x: 0, y: 0 },
})

const entityTooltipStyle = ref<Record<string, string>>({})

const entityTooltipResolved = computed(() => {
  const tt = entityTooltip.value
  if (!tt.show || !tt.type || !tt.id) return null
  switch (tt.type) {
    case 'item': {
      const item = itemsStore.items.find(i => i.id === tt.id)
      if (!item) return null
      return {
        type: 'item' as const,
        item: {
          name: item.name,
          descriptionHtml: formatItemTooltipHtml(resolveItemDescription(item, riotLocale.value)),
        },
      }
    }
    case 'rune': {
      const rune = findRuneInPaths(runesStore.runePaths, Number(tt.id))
      if (!rune) return null
      return {
        type: 'rune' as const,
        rune: { name: rune.name, descriptionHtml: formatRuneTooltipHtml(rune) },
      }
    }
    case 'shard': {
      const shardId = Number(tt.id)
      if (!Number.isFinite(shardId)) return null
      return {
        type: 'shard' as const,
        shard: {
          name: t(`runes.shards.${shardId}.name`, String(shardId)),
          descriptionHtml: formatShardTooltipHtml(t(`runes.shards.${shardId}.desc`, '')),
        },
      }
    }
    case 'summoner': {
      const spell = summonerSpellsStore.getSpellById(tt.id)
      if (!spell) return null
      return {
        type: 'spell' as const,
        spell: { name: spell.name, description: formatSummonerSpellTooltipHtml(spell) },
      }
    }
    case 'spell': {
      const champion = buildStore.displayedBuild?.champion
      if (isNotesPassiveSpellId(tt.id, champion?.id)) {
        const passive = champion?.passive
        if (!passive) return null
        return {
          type: 'spell' as const,
          spell: { name: passive.name, description: passive.description ?? '' },
        }
      }
      const spell = champion?.spells?.find(s => s.id === tt.id)
      if (!spell) return null
      return {
        type: 'spell' as const,
        spell: { name: spell.name, description: spell.description ?? '' },
      }
    }
    case 'skill':
      return { type: 'skill' as const, label: tt.id }
    default:
      return null
  }
})

function readEntityFromTarget(target: EventTarget | null) {
  const el = (target as HTMLElement | null)?.closest?.('.notes-entity') as HTMLElement | null
  if (!el) return null
  const type = (el.getAttribute('data-entity-type') || '') as BuildNotesEntityType
  const id = el.getAttribute('data-entity-id') || ''
  if (!type || !id) return null
  return { type, id }
}

function onEntityMouseOver(event: MouseEvent) {
  const entity = readEntityFromTarget(event.target)
  if (!entity) return
  entityTooltip.value = {
    show: true,
    type: entity.type,
    id: entity.id,
    pointer: { x: event.clientX, y: event.clientY },
  }
  nextTick(() => applyTooltipPosition())
}

function onEntityMouseMove(event: MouseEvent) {
  if (!entityTooltip.value.show) return
  entityTooltip.value.pointer = { x: event.clientX, y: event.clientY }
  applyTooltipPosition()
}

function onEntityMouseOut(event: MouseEvent) {
  const from = readEntityFromTarget(event.target)
  const to = readEntityFromTarget(event.relatedTarget)
  if (from && !to) {
    entityTooltip.value.show = false
  }
}

function applyTooltipPosition() {
  const tooltipEl = entityTooltipRef.value
  if (!entityTooltip.value.show || !tooltipEl) return
  entityTooltipStyle.value = fixedTooltipStyleFromPointer(tooltipEl, entityTooltip.value.pointer)
}
</script>

<style scoped>
.notes-rich-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 8px;
  background: rgb(var(--rgb-background) / 0.35);
  overflow: hidden;
}

.notes-rich-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.18);
  flex-wrap: wrap;
  background: rgb(var(--rgb-primary) / 0.12);
}

.notes-rich-editor-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.88);
  font-size: 12px;
  cursor: pointer;
}

.notes-rich-editor-btn:hover {
  background: rgb(var(--rgb-accent) / 0.12);
  border-color: rgb(var(--rgb-accent) / 0.35);
  color: var(--color-gold-300);
}

.notes-rich-editor-toolbar-sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.notes-rich-editor-btn--entity {
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
}

.notes-rich-editor-btn--entity.is-open {
  background: rgb(var(--rgb-accent) / 0.16);
  border-color: rgb(var(--rgb-accent) / 0.45);
  color: var(--color-gold-300);
}

.notes-rich-editor-build-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.45);
  white-space: nowrap;
}

.notes-rich-editor-entity-btn-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: cover;
}

.notes-rich-editor-entity-wrap {
  position: relative;
}

.notes-rich-editor-entity-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  min-width: 220px;
  max-width: 280px;
  max-height: 260px;
  overflow: auto;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 18, 28, 0.98);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.notes-rich-editor-entity-group-label {
  padding: 4px 6px 2px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.45);
}

.notes-rich-editor-entity-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.notes-rich-editor-entity-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.notes-rich-editor-entity-thumb {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
}

.notes-rich-editor-entity-empty {
  padding: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.notes-rich-editor-counter {
  margin-left: auto;
  font-size: 11px;
  color: rgb(var(--rgb-text) / 0.5);
}

.notes-rich-editor-counter.is-over {
  color: #f87171;
  font-weight: 700;
}

.notes-rich-editor-body {
  min-height: 96px;
  max-height: 220px;
  overflow: auto;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.92);
  outline: none;
}

.notes-rich-editor-body:empty::before {
  content: attr(data-placeholder);
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.notes-rich-editor-body :deep(.notes-entity) {
  display: inline-flex;
  vertical-align: middle;
  margin: 0 1px;
}

.notes-rich-editor-body :deep(.notes-entity-icon) {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  vertical-align: middle;
}

.notes-rich-editor-body :deep(ul) {
  margin: 0.35em 0;
  padding-left: 1.25em;
}

.notes-entity-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: 280px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 12, 20, 0.96);
  pointer-events: none;
}

.notes-entity-tooltip-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent, #c8aa6e);
  margin-bottom: 4px;
}

.notes-entity-tooltip-desc {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.85);
}
</style>
