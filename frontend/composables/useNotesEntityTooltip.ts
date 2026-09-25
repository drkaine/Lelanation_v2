import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BuildNotesEntityType, Champion } from '@lelanation/shared-types'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import {
  formatItemTooltipHtml,
  formatRuneTooltipHtml,
  formatShardTooltipHtml,
} from '~/utils/formatTooltipMarkupHtml'
import { formatSummonerSpellTooltipHtml } from '~/utils/gameTooltipFormatter'
import { resolveItemDescription } from '~/utils/itemDescriptionFallbacks'
import { findRuneInPaths, isNotesPassiveSpellId } from '~/utils/notesBuildEntities'
import { riotLanguage } from '~/utils/riotLanguage'

/** Tooltip title and HTML body (null: title only). */
export type NotesEntityTooltipContent = { name: string; html: string | null }

function readEntityFromTarget(target: EventTarget | null) {
  const el = (target as HTMLElement | null)?.closest?.('.notes-entity') as HTMLElement | null
  if (!el) return null
  const type = (el.getAttribute('data-entity-type') || '') as BuildNotesEntityType
  const id = el.getAttribute('data-entity-id') || ''
  if (!type || !id) return null
  return { type, id }
}

/**
 * Hover tooltip of the `.notes-entity` chips (items, runes, shards, spells, skills) of build notes.
 * `champion` resolves the champion spells and passive.
 */
export function useNotesEntityTooltip(champion: () => Champion | null | undefined) {
  const { locale, t } = useI18n()
  const itemsStore = useItemsStore()
  const runesStore = useRunesStore()
  const summonerSpellsStore = useSummonerSpellsStore()

  const entityTooltip = ref<{
    show: boolean
    type: BuildNotesEntityType | null
    id: string
    pointer: { x: number; y: number }
  }>({ show: false, type: null, id: '', pointer: { x: 0, y: 0 } })

  function resolve(type: BuildNotesEntityType, id: string): NotesEntityTooltipContent | null {
    switch (type) {
      case 'item': {
        const item = itemsStore.items.find(i => String(i.id) === id)
        if (!item) return null
        const description = resolveItemDescription(item, riotLanguage(locale.value))
        return { name: item.name, html: formatItemTooltipHtml(description) }
      }
      case 'rune': {
        const rune = findRuneInPaths(runesStore.runePaths, Number(id))
        return rune ? { name: rune.name, html: formatRuneTooltipHtml(rune) } : null
      }
      case 'shard': {
        const shardId = Number(id)
        if (!Number.isFinite(shardId)) return null
        return {
          name: t(`runes.shards.${shardId}.name`, String(shardId)),
          html: formatShardTooltipHtml(t(`runes.shards.${shardId}.desc`, '')),
        }
      }
      case 'summoner': {
        const spell = summonerSpellsStore.getSpellById(id)
        return spell ? { name: spell.name, html: formatSummonerSpellTooltipHtml(spell) } : null
      }
      case 'spell': {
        const champ = champion()
        const spell = isNotesPassiveSpellId(id, champ?.id)
          ? champ?.passive
          : champ?.spells?.find(s => s.id === id)
        return spell ? { name: spell.name, html: spell.description ?? '' } : null
      }
      case 'skill':
        return { name: id, html: null }
      default:
        return null
    }
  }

  const entityTooltipResolved = computed(() => {
    const tt = entityTooltip.value
    if (!tt.show || !tt.type || !tt.id) return null
    return resolve(tt.type, tt.id)
  })

  function onEntityMouseOver(event: MouseEvent) {
    const entity = readEntityFromTarget(event.target)
    if (!entity) return
    entityTooltip.value = {
      show: true,
      type: entity.type,
      id: entity.id,
      pointer: { x: event.clientX, y: event.clientY },
    }
  }

  function onEntityMouseMove(event: MouseEvent) {
    if (!entityTooltip.value.show) return
    entityTooltip.value.pointer = { x: event.clientX, y: event.clientY }
  }

  function onEntityMouseOut(event: MouseEvent) {
    const from = readEntityFromTarget(event.target)
    const to = readEntityFromTarget(event.relatedTarget)
    if (from && !to) entityTooltip.value.show = false
  }

  function hide() {
    entityTooltip.value.show = false
  }

  return {
    entityTooltip,
    entityTooltipResolved,
    onEntityMouseOver,
    onEntityMouseMove,
    onEntityMouseOut,
    hide,
  }
}
