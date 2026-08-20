<template>
  <div
    ref="rootRef"
    class="notes-content-renderer"
    @mouseover="onEntityMouseOver"
    @mousemove="onEntityMouseMove"
    @mouseout="onEntityMouseOut"
  >
    <!-- eslint-disable vue/no-v-html -->
    <div class="notes-content-renderer__html" v-html="sanitizedHtml" />
    <!-- eslint-enable vue/no-v-html -->

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
          />
        </template>
        <template v-else-if="entityTooltipResolved.type === 'rune'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.rune.name }}</div>
          <div
            class="notes-entity-tooltip-desc"
            v-html="entityTooltipResolved.rune.descriptionHtml"
          />
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
          <div class="notes-entity-tooltip-desc" v-html="entityTooltipResolved.spell.description" />
        </template>
        <template v-else-if="entityTooltipResolved.type === 'skill'">
          <div class="notes-entity-tooltip-name">{{ entityTooltipResolved.label }}</div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { BuildNotesEntityType, Champion } from '@lelanation/shared-types'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { sanitizeNotesHtml } from '~/utils/sanitizeNotesHtml'
import {
  formatItemTooltipHtml,
  formatRuneTooltipHtml,
  formatShardTooltipHtml,
} from '~/utils/formatTooltipMarkupHtml'
import { formatSummonerSpellTooltipHtml } from '~/utils/gameTooltipFormatter'
import { resolveItemDescription } from '~/utils/itemDescriptionFallbacks'
import { fixedTooltipStyleFromPointer } from '~/utils/tooltipPosition'
import { findRuneInPaths, isNotesPassiveSpellId } from '~/utils/notesBuildEntities'

const props = defineProps<{
  html: string
  champion?: Champion | null
}>()

const { locale, t } = useI18n()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()

const rootRef = ref<HTMLElement | null>(null)
const entityTooltipRef = ref<HTMLElement | null>(null)
const entityTooltipStyle = ref<Record<string, string>>({})
const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))

const sanitizedHtml = computed(() => sanitizeNotesHtml(props.html || ''))

function findRuneInStore(runeId: number) {
  return findRuneInPaths(runesStore.runePaths, runeId)
}

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

const entityTooltipResolved = computed(() => {
  const tt = entityTooltip.value
  if (!tt.show || !tt.type || !tt.id) return null
  switch (tt.type) {
    case 'item': {
      const item = itemsStore.items.find(i => String(i.id) === String(tt.id))
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
      const rune = findRuneInStore(Number(tt.id))
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
      if (isNotesPassiveSpellId(tt.id, props.champion?.id)) {
        const passive = props.champion?.passive
        if (!passive) return null
        return {
          type: 'spell' as const,
          spell: { name: passive.name, description: passive.description ?? '' },
        }
      }
      const spell = props.champion?.spells?.find(s => s.id === tt.id)
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
  if (from && !to) entityTooltip.value.show = false
}

function applyTooltipPosition() {
  const tooltipEl = entityTooltipRef.value
  if (!entityTooltip.value.show || !tooltipEl) return
  entityTooltipStyle.value = fixedTooltipStyleFromPointer(tooltipEl, entityTooltip.value.pointer)
}

watch(
  () => props.html,
  () => {
    entityTooltip.value.show = false
  }
)
</script>

<style scoped>
.notes-content-renderer__html {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.9);
}

.notes-content-renderer__html :deep(.notes-entity) {
  display: inline-flex;
  vertical-align: middle;
  margin: 0 2px;
}

.notes-content-renderer__html :deep(.notes-entity-icon) {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  vertical-align: middle;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.notes-content-renderer__html :deep(ul) {
  margin: 0.5em 0;
  padding-left: 1.25em;
}

.notes-content-renderer__html :deep(li) {
  margin: 0.25em 0;
}

.notes-content-renderer__html :deep(strong),
.notes-content-renderer__html :deep(b) {
  color: rgba(255, 255, 255, 0.98);
  font-weight: 700;
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
