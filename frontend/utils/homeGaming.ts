/** Logique pure de la home « gaming » (prototype sur /test). */
import type { StatChange } from '~/stores/PatchNotesStore'
import { resolvePatchEntitySummaryTag } from '~/utils/patchEntitySummary'
import { countPatchTags } from '~/utils/patchGaming'

export type HomeGamingRow = {
  rank: number
  championId: number
  tier: string
}

export type HomeGamingRoleBlock<R extends HomeGamingRow> = {
  role: string
  champions: R[]
}

const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D', 'F']

export function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier)
  return index === -1 ? TIER_ORDER.length : index
}

function compareRows(a: HomeGamingRow, b: HomeGamingRow): number {
  return tierRank(a.tier) - tierRank(b.tier) || a.rank - b.rank
}

export function topPicksByRole<R extends HomeGamingRow, B extends HomeGamingRoleBlock<R>>(
  blocks: B[],
  count: number
): B[] {
  return blocks.map(block => ({
    ...block,
    champions: [...block.champions].sort(compareRows).slice(0, count),
  }))
}

export function pickHeroRow<R extends HomeGamingRow>(blocks: HomeGamingRoleBlock<R>[]): R | null {
  const all = blocks.flatMap(block => block.champions)
  if (all.length === 0) return null
  return [...all].sort(compareRows)[0] ?? null
}

/** La section guides n'apparaît qu'au-delà de ce nombre de guides publics. */
export const HOME_GUIDES_MIN = 5

type HomeGuideLike = { updatedAt: string; visibility?: 'public' | 'private' }

/** Guides publics les plus récents, vide s'il y en a 5 ou moins. */
export function homeGuides<G extends HomeGuideLike>(guides: G[], count: number): G[] {
  const visible = guides.filter(g => g.visibility !== 'private')
  if (visible.length <= HOME_GUIDES_MIN) return []
  return [...visible].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, count)
}

type HomePatchEntityLike = { category: string; changes: StatChange[]; isNewRelease?: boolean }

/** Catégories de la Faille comptées dans le récap (pas les modes ni les correctifs). */
const RECAP_CATEGORIES = ['champion', 'item', 'rune']

/** Récap du patch : compte par verdict (Faille) et toutes les entités de chaque verdict. */
export function homePatchRecap<E extends HomePatchEntityLike>(entities: E[]) {
  const rift = entities.filter(e => RECAP_CATEGORIES.includes(e.category))
  const champions = rift.filter(e => e.category === 'champion')
  /** Champions, puis items, puis runes : autant d'entités que le compteur. */
  const ordered = RECAP_CATEGORIES.flatMap(category => rift.filter(e => e.category === category))
  const withTag = (tag: string) => ordered.filter(e => resolvePatchEntitySummaryTag(e) === tag)
  return {
    counts: countPatchTags(rift.map(e => resolvePatchEntitySummaryTag(e))),
    buffs: withTag('buff'),
    nerfs: withTag('nerf'),
    adjustments: withTag('adjustment'),
    championCount: champions.length,
  }
}
