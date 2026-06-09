import type { ChangeType, EntityCategory, EntityChanges, PatchJson } from '../scraper/types.js'

export type PatchNotesTargetType = 'champion' | 'items' | 'runes'

export type PatchNotesStatsRow = {
  typeCible: PatchNotesTargetType
  idCible: string
  gameVersion: string
  countNerf: number
  countUp: number
  countAjust: number
}

const TRACKED_CATEGORIES: ReadonlySet<EntityCategory> = new Set(['champion', 'item', 'rune'])

function categoryToTargetType(category: EntityCategory): PatchNotesTargetType | null {
  if (category === 'champion') return 'champion'
  if (category === 'item') return 'items'
  if (category === 'rune') return 'runes'
  return null
}

function countsForChangeType(type: ChangeType): Pick<PatchNotesStatsRow, 'countNerf' | 'countUp' | 'countAjust'> {
  if (type === 'nerf') return { countNerf: 1, countUp: 0, countAjust: 0 }
  if (type === 'buff') return { countNerf: 0, countUp: 1, countAjust: 0 }
  if (type === 'adjustment' || type === 'new') return { countNerf: 0, countUp: 0, countAjust: 1 }
  return { countNerf: 0, countUp: 0, countAjust: 0 }
}

/** Count nerf / buff / adjust lines for one entity in a patch. */
export function buildEntityPatchStats(
  entity: EntityChanges,
  gameVersion: string
): PatchNotesStatsRow | null {
  const typeCible = categoryToTargetType(entity.category)
  if (!typeCible || !TRACKED_CATEGORIES.has(entity.category)) return null

  const idCible = String(entity.id ?? '').trim()
  if (!idCible) return null

  let countNerf = 0
  let countUp = 0
  let countAjust = 0

  for (const change of entity.changes ?? []) {
    const part = countsForChangeType(change.type)
    countNerf += part.countNerf
    countUp += part.countUp
    countAjust += part.countAjust
  }

  if (countNerf + countUp + countAjust <= 0) return null

  return {
    typeCible,
    idCible,
    gameVersion,
    countNerf,
    countUp,
    countAjust,
  }
}

/** Build all stat rows for a patch JSON (en-GB recommended — one locale per version). */
export function buildPatchNotesStats(patch: PatchJson): PatchNotesStatsRow[] {
  const version = String(patch.patchVersion ?? '').trim()
  if (!version) return []

  const rows: PatchNotesStatsRow[] = []
  for (const entity of patch.entities ?? []) {
    const row = buildEntityPatchStats(entity, version)
    if (row) rows.push(row)
  }
  return rows
}
