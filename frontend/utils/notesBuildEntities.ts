import type { Build, BuildNotesEntityType, RunePath } from '@lelanation/shared-types'
import {
  getChampionPassiveImageUrl,
  getChampionSpellImageUrl,
  getItemImageUrl,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'

export const NOTES_SHARD_ICONS: Record<number, string> = {
  5008: '/icons/shards/adaptative.png',
  5005: '/icons/shards/speed.png',
  5006: '/icons/shards/move.png',
  5010: '/icons/shards/move.png',
  5007: '/icons/shards/cdr.png',
  5001: '/icons/shards/growth.png',
  5002: '/icons/shards/growth.png',
  5011: '/icons/shards/hp.png',
  5003: '/icons/shards/tenacity.png',
  5013: '/icons/shards/tenacity.png',
}

export interface NotesEntityOption {
  type: BuildNotesEntityType
  id: string
  label: string
  imageUrl?: string
}

export type NotesEntityCategoryKey = 'item' | 'rune' | 'summoner' | 'shard' | 'spell'

export function getNotesShardIcon(shardId: number): string {
  return NOTES_SHARD_ICONS[shardId] || '/icons/shards/adaptative.png'
}

export function isNotesPassiveSpellId(id: string, championId?: string | null): boolean {
  if (!championId) return false
  return id === `${championId}_Passive`
}

export function findRuneInPaths(paths: RunePath[], runeId: number) {
  for (const path of paths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}

export function getNotesEntityCategories(
  build: Build,
  version: string,
  labels: {
    items: string
    runes: string
    summoner: string
    shards: string
    spells: string
  },
  runePaths: RunePath[],
  shardLabel: (shardId: number) => string
): Record<NotesEntityCategoryKey, NotesEntityOption[]> {
  const items: NotesEntityOption[] = (build.items ?? []).map(item => ({
    type: 'item',
    id: item.id,
    label: item.name || item.id,
    imageUrl: getItemImageUrl(version, item.image.full),
  }))

  const runeIds = new Set<number>()
  if (build.runes) {
    runeIds.add(build.runes.primary.keystone)
    runeIds.add(build.runes.primary.slot1)
    runeIds.add(build.runes.primary.slot2)
    runeIds.add(build.runes.primary.slot3)
    runeIds.add(build.runes.secondary.slot1)
    runeIds.add(build.runes.secondary.slot2)
  }
  const runes: NotesEntityOption[] = []
  for (const id of runeIds) {
    if (!id) continue
    const rune = findRuneInPaths(runePaths, id)
    if (!rune) continue
    runes.push({
      type: 'rune',
      id: String(id),
      label: rune.name,
      imageUrl: getRuneImageUrl(version, rune.icon),
    })
  }

  const summoner: NotesEntityOption[] = (build.summonerSpells ?? []).filter(Boolean).map(spell => ({
    type: 'summoner',
    id: spell!.id,
    label: spell!.name,
    imageUrl: getSpellImageUrl(version, spell!.image.full),
  }))

  const shards: NotesEntityOption[] = []
  if (build.shards) {
    for (const shardId of [build.shards.slot1, build.shards.slot2, build.shards.slot3]) {
      if (!shardId) continue
      shards.push({
        type: 'shard',
        id: String(shardId),
        label: shardLabel(shardId),
        imageUrl: getNotesShardIcon(shardId),
      })
    }
  }

  const spells: NotesEntityOption[] = []
  const champion = build.champion
  if (champion) {
    if (champion.passive?.name) {
      spells.push({
        type: 'spell',
        id: `${champion.id}_Passive`,
        label: `P — ${champion.passive.name}`,
        imageUrl: getChampionPassiveImageUrl(version, champion.passive.image?.full ?? ''),
      })
    }
    const abilityKeys = ['Q', 'W', 'E', 'R'] as const
    for (const [index, spell] of (champion.spells ?? []).entries()) {
      spells.push({
        type: 'spell',
        id: spell.id || `${champion.id}${abilityKeys[index] ?? index}`,
        label: `${abilityKeys[index] ?? '?'} — ${spell.name}`,
        imageUrl: getChampionSpellImageUrl(version, champion.id, spell.image.full),
      })
    }
  }

  return {
    item: items,
    rune: runes,
    summoner,
    shard: shards,
    spell: spells,
  }
}

export function getNotesEntityCategoryList(
  categories: Record<NotesEntityCategoryKey, NotesEntityOption[]>,
  labels: Record<NotesEntityCategoryKey, string>
): Array<{ key: NotesEntityCategoryKey; label: string; items: NotesEntityOption[] }> {
  return (Object.keys(categories) as NotesEntityCategoryKey[]).map(key => ({
    key,
    label: labels[key],
    items: categories[key],
  }))
}
