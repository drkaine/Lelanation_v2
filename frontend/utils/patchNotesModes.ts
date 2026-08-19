import type { PatchEntity, EntityCategory } from '~/stores/PatchNotesStore'
import { isBugfixPatchEntity, flattenBugfixItems } from '~/utils/patchBugfixItems'

export type PatchNotesModeId = 'rift' | 'classic' | 'aram' | 'aram-chaos' | 'arena'

export type PatchNotesContentTabId =
  | 'summary'
  | 'champions'
  | 'items'
  | 'runes'
  | 'systems'
  | 'optimizations'
  | 'bugfix'

export const PATCH_NOTES_MODE_ORDER: PatchNotesModeId[] = [
  'rift',
  'classic',
  'aram',
  'aram-chaos',
  'arena',
]

export const PATCH_NOTES_ENTITY_CONTENT_TAB_ORDER: PatchNotesContentTabId[] = [
  'champions',
  'items',
  'runes',
  'systems',
  'optimizations',
  'bugfix',
]

const MODE_TO_ENTITY_CATEGORY: Partial<Record<PatchNotesModeId, EntityCategory>> = {
  classic: 'classic',
  aram: 'aram',
  'aram-chaos': 'aram-chaos',
  arena: 'arena',
}

function normalizeSubSection(value?: string | null): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      .trim() ?? ''
  )
}

function resolveModeContentTab(entity: PatchEntity): PatchNotesContentTabId | null {
  if (isBugfixPatchEntity(entity)) return 'bugfix'

  const sub = normalizeSubSection(entity.subCategory)
  if (!sub) return null

  if (sub.includes('champion') || sub.includes('invite') || sub.includes('honor')) {
    return 'champions'
  }
  if (sub.includes('objet') || sub.includes('item')) return 'items'
  if (sub.includes('rune')) return 'runes'
  if (sub.includes('system') || sub.includes('systeme')) return 'systems'
  if (sub.includes('optim')) return 'optimizations'

  return null
}

function resolveRiftContentTab(entity: PatchEntity): PatchNotesContentTabId | null {
  if (entity.category === 'bugfix') return 'bugfix'
  if (isBugfixPatchEntity(entity)) return null

  switch (entity.category) {
    case 'champion':
      return 'champions'
    case 'item':
      return 'items'
    case 'rune':
      return 'runes'
    case 'system':
      return 'systems'
    default:
      return null
  }
}

export function resolvePatchContentTab(
  entity: PatchEntity,
  mode: PatchNotesModeId
): PatchNotesContentTabId | null {
  if (mode === 'rift') return resolveRiftContentTab(entity)
  const category = MODE_TO_ENTITY_CATEGORY[mode]
  if (!category || entity.category !== category) return null
  return resolveModeContentTab(entity)
}

export function entitiesForPatchMode(
  entities: PatchEntity[],
  mode: PatchNotesModeId
): PatchEntity[] {
  if (mode === 'rift') {
    return entities.filter(entity => resolveRiftContentTab(entity) !== null)
  }

  const category = MODE_TO_ENTITY_CATEGORY[mode]
  if (!category) return []

  return entities.filter(
    entity => entity.category === category && resolveModeContentTab(entity) !== null
  )
}

export function entitiesForPatchModeTab(
  entities: PatchEntity[],
  mode: PatchNotesModeId,
  tab: PatchNotesContentTabId
): PatchEntity[] {
  if (tab === 'summary') return []
  return entitiesForPatchMode(entities, mode).filter(
    entity => resolvePatchContentTab(entity, mode) === tab
  )
}

export function countPatchModeTab(
  entities: PatchEntity[],
  mode: PatchNotesModeId,
  tab: PatchNotesContentTabId
): number {
  if (tab === 'summary') return 0
  const tabEntities = entitiesForPatchModeTab(entities, mode, tab)
  if (tab === 'bugfix') return flattenBugfixItems(tabEntities).length
  return tabEntities.length
}

export function countPatchMode(entities: PatchEntity[], mode: PatchNotesModeId): number {
  return entitiesForPatchMode(entities, mode).length
}

export function visiblePatchEntityContentTabs(
  entities: PatchEntity[],
  mode: PatchNotesModeId
): PatchNotesContentTabId[] {
  return PATCH_NOTES_ENTITY_CONTENT_TAB_ORDER.filter(
    tab => countPatchModeTab(entities, mode, tab) > 0
  )
}

export function visiblePatchContentTabs(
  entities: PatchEntity[],
  mode: PatchNotesModeId,
  hasSummaryImage: boolean
): PatchNotesContentTabId[] {
  const tabs: PatchNotesContentTabId[] = []
  if (hasSummaryImage) tabs.push('summary')
  tabs.push(...visiblePatchEntityContentTabs(entities, mode))
  return tabs
}

export function visiblePatchModes(entities: PatchEntity[]): PatchNotesModeId[] {
  const withContent = PATCH_NOTES_MODE_ORDER.filter(mode => countPatchMode(entities, mode) > 0)
  if (withContent.includes('rift')) return withContent
  return ['rift', ...withContent]
}

export function defaultPatchContentTab(
  entities: PatchEntity[],
  mode: PatchNotesModeId,
  hasSummaryImage: boolean
): PatchNotesContentTabId {
  if (hasSummaryImage) return 'summary'
  const tabs = visiblePatchEntityContentTabs(entities, mode)
  return tabs[0] ?? 'champions'
}

export const PATCH_MODE_I18N_KEYS: Record<PatchNotesModeId, string> = {
  rift: 'patchNotesPage.modes.rift',
  classic: 'patchNotesPage.categories.classic',
  aram: 'patchNotesPage.categories.aram',
  'aram-chaos': 'patchNotesPage.categories.aramChaos',
  arena: 'patchNotesPage.categories.arena',
}

export const PATCH_CONTENT_TAB_I18N_KEYS: Record<PatchNotesContentTabId, string> = {
  summary: 'patchNotesPage.categories.summary',
  champions: 'patchNotesPage.categories.champions',
  items: 'patchNotesPage.categories.items',
  runes: 'patchNotesPage.categories.runes',
  systems: 'patchNotesPage.categories.systems',
  optimizations: 'patchNotesPage.categories.optimizations',
  bugfix: 'patchNotesPage.categories.bugfix',
}
