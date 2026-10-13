/** Logique pure des notes de patch « gaming » (prototype sur /test). */
import type { PatchNotesContentTabId } from '~/utils/patchNotesModes'
import {
  PATCH_ENTITY_TAG_FILTER_ORDER,
  type PatchEntitySummaryType,
} from '~/utils/patchEntitySummary'

/** Patch précédent (plus ancien) et suivant (plus récent) ; `versions` du plus récent au plus ancien. */
export function patchNeighbors(
  versions: string[],
  current: string
): { older: string | null; newer: string | null } {
  const index = versions.indexOf(current)
  if (index === -1) return { older: null, newer: null }
  return { older: versions[index + 1] ?? null, newer: versions[index - 1] ?? null }
}

export function countPatchTags(
  tags: Array<PatchEntitySummaryType | null | undefined>
): { id: PatchEntitySummaryType; count: number }[] {
  return PATCH_ENTITY_TAG_FILTER_ORDER.map(id => ({
    id,
    count: tags.filter(tag => tag === id).length,
  })).filter(entry => entry.count > 0)
}

/** Couleurs : tokens existants (info / error / warning / muted). */
export const PATCH_TAG_TILES: Record<PatchEntitySummaryType, { icon: string; tone: string }> = {
  buff: { icon: 'mdi:arrow-up-bold', tone: 'info' },
  nerf: { icon: 'mdi:arrow-down-bold', tone: 'error' },
  adjustment: { icon: 'mdi:swap-vertical-bold', tone: 'warning' },
  new: { icon: 'mdi:star-four-points', tone: 'info' },
  removed: { icon: 'mdi:close-thick', tone: 'muted' },
}

export const PATCH_TAB_ICONS: Record<PatchNotesContentTabId, string> = {
  summary: 'mdi:image-filter-hdr',
  champions: 'mdi:account-star',
  items: 'mdi:treasure-chest',
  runes: 'mdi:rhombus-split',
  systems: 'mdi:cog-transfer',
  optimizations: 'mdi:speedometer',
  bugfix: 'mdi:bug',
}
