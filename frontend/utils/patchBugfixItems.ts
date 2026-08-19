import type { PatchEntity, EntityCategory, StatChange } from '~/stores/PatchNotesStore'

export interface PatchBugfixItem {
  id: string
  text: string
  linkUrl?: string
  linkLabel?: string
  section?: string
}

export interface PatchBugfixSection {
  modeId: EntityCategory
  title: string
  items: PatchBugfixItem[]
}

/** Display order for bugfix sections grouped by game mode. */
export const PATCH_BUGFIX_MODE_ORDER: EntityCategory[] = [
  'champion',
  'item',
  'rune',
  'system',
  'classic',
  'aram',
  'aram-chaos',
  'arena',
  'bugfix',
]

function isBugfixSectionLabel(value?: string | null): boolean {
  if (!value) return false
  const normalized = value.toLowerCase()
  return normalized.includes('bug') || normalized.includes('correction')
}

export function isBugfixPatchEntity(entity: PatchEntity): boolean {
  if (entity.category === 'bugfix') return true
  return isBugfixSectionLabel(entity.subCategory)
}

export function excludeBugfixEntities(entities: PatchEntity[]): PatchEntity[] {
  return entities.filter(entity => !isBugfixPatchEntity(entity))
}

function changeToItem(
  change: StatChange,
  entity: PatchEntity,
  index: number
): PatchBugfixItem | null {
  const text = change.after?.trim()
  if (!text) return null

  const section = change.subCategory?.trim() || entity.subCategory?.trim() || undefined

  return {
    id: `${entity.category}-${entity.name || 'bugfix'}-${index}-${text.slice(0, 48)}`,
    text,
    linkUrl: change.linkUrl,
    linkLabel: change.linkLabel,
    section,
  }
}

export function flattenBugfixItems(entities: PatchEntity[]): PatchBugfixItem[] {
  const items: PatchBugfixItem[] = []

  for (const entity of entities) {
    entity.changes.forEach((change, index) => {
      const item = changeToItem(change, entity, index)
      if (item) items.push(item)
    })
  }

  return items
}

export function groupBugfixItemsByMode(
  entities: PatchEntity[],
  resolveModeTitle: (modeId: EntityCategory) => string
): PatchBugfixSection[] {
  const bugfixEntities = entities.filter(isBugfixPatchEntity)
  const itemsByMode = new Map<EntityCategory, PatchBugfixItem[]>()

  for (const entity of bugfixEntities) {
    const modeId = entity.category
    const items = flattenBugfixItems([entity])
    if (items.length === 0) continue
    const existing = itemsByMode.get(modeId) ?? []
    itemsByMode.set(modeId, [...existing, ...items])
  }

  return PATCH_BUGFIX_MODE_ORDER.filter(modeId => (itemsByMode.get(modeId)?.length ?? 0) > 0).map(
    modeId => ({
      modeId,
      title: resolveModeTitle(modeId),
      items: itemsByMode.get(modeId)!,
    })
  )
}

export function splitBugfixLinkText(item: PatchBugfixItem): { before: string; after: string } {
  const label = item.linkLabel?.trim()
  if (!label) {
    return { before: item.text, after: '' }
  }

  const index = item.text.toLowerCase().indexOf(label.toLowerCase())
  if (index === -1) {
    return { before: item.text, after: '' }
  }

  return {
    before: item.text.slice(0, index),
    after: item.text.slice(index + label.length),
  }
}
