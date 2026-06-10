import { getKaynHudImageUrl } from '~/utils/imageUrl'

/** Riot numeric champion keys with in-game transformation stats. */
export const TRANSFORMABLE_CHAMPION_IDS = new Set<number>([141])

/** 0 = base, 1 = Darkin (rouge), 2 = Assassin (bleu). */
export type ChampionTransform = 0 | 1 | 2

export function isTransformableChampion(championId: number): boolean {
  return TRANSFORMABLE_CHAMPION_IDS.has(championId)
}

export function championTransformRowKey(
  championId: number,
  transform: ChampionTransform = 0
): string {
  return `${championId}:${transform}`
}

export function parseChampionTransformRowKey(key: string): {
  championId: number
  transform: ChampionTransform
} {
  const [idRaw, transformRaw] = key.split(':')
  const championId = Number(idRaw)
  const transform = Number(transformRaw ?? 0)
  const safeTransform = transform === 1 || transform === 2 ? transform : 0
  return { championId, transform: safeTransform }
}

export function normalizeChampionTransform(value: unknown): ChampionTransform {
  const n = Number(value)
  if (n === 1 || n === 2) return n
  return 0
}

/** Portrait HUD pour les lignes stats (Kayn uniquement aujourd'hui). */
export function getChampionTransformPortraitSrc(
  championId: number,
  transform: ChampionTransform,
  defaultPortrait: string | null
): string | null {
  if (championId !== 141) return defaultPortrait
  if (transform === 1) return getKaynHudImageUrl('slay')
  if (transform === 2) return getKaynHudImageUrl('ass')
  return defaultPortrait
}

export type ChampionTransformLabelKey =
  | 'statisticsPage.championTransformBase'
  | 'statisticsPage.championTransformDarkin'
  | 'statisticsPage.championTransformAssassin'

export function championTransformLabelKey(transform: ChampionTransform): ChampionTransformLabelKey {
  if (transform === 1) return 'statisticsPage.championTransformDarkin'
  if (transform === 2) return 'statisticsPage.championTransformAssassin'
  return 'statisticsPage.championTransformBase'
}

/** Termes recherchables par locale (Kayn). Ordre : formes spécifiques avant termes génériques. */
const KAYN_TRANSFORM_SEARCH_TERMS: Record<ChampionTransform, readonly string[]> = {
  1: [
    'red kayn',
    'kayn rouge',
    'kayn red',
    'darkin',
    'rhaast',
    'rhaast kayn',
    'slayer',
    'darkin slayer',
    'tueur darkin',
  ],
  2: [
    'blue kayn',
    'kayn bleu',
    'kayn blue',
    'assassin',
    'shadow assassin',
    "assassin de l'ombre",
    'assassin de lombre',
    'ombre',
  ],
  0: ['kayn base', 'base kayn'],
}

function kaynTransformSearchTerms(transform: ChampionTransform): readonly string[] {
  return KAYN_TRANSFORM_SEARCH_TERMS[transform] ?? []
}

/** Forme ciblée par la requête (ex. « red kayn » → Darkin). Null = recherche champion générique. */
export function resolveTransformFromSearchQuery(
  championId: number,
  query: string
): ChampionTransform | null {
  if (!isTransformableChampion(championId)) return null
  const q = query.trim().toLowerCase()
  if (!q) return null

  let best: { transform: ChampionTransform; len: number } | null = null
  for (const transform of [1, 2, 0] as ChampionTransform[]) {
    for (const term of kaynTransformSearchTerms(transform)) {
      if (q === term || q.includes(term)) {
        if (!best || term.length > best.len) {
          best = { transform, len: term.length }
        }
      }
    }
  }
  return best?.transform ?? null
}

function transformSearchTermsMatch(
  championId: number,
  transform: ChampionTransform,
  query: string
): boolean {
  if (!isTransformableChampion(championId)) return false
  const q = query.trim().toLowerCase()
  if (!q) return false
  return kaynTransformSearchTerms(transform).some(term => q === term || q.includes(term))
}

/**
 * Filtre recherche tableau champion global (nom, id, alias de transformation).
 * En mode split : une requête « red kayn » ne garde que la ligne Darkin.
 */
export function championRowMatchesGlobalSearch(opts: {
  championId: number
  championName: string | null | undefined
  championTransform?: ChampionTransform
  query: string
  splitTransform: boolean
}): boolean {
  const q = opts.query.trim().toLowerCase()
  if (!q) return true

  const name = (opts.championName ?? '').toLowerCase()
  const idStr = String(opts.championId)
  const rowTransform = normalizeChampionTransform(opts.championTransform)
  const qualifiedTransform = resolveTransformFromSearchQuery(opts.championId, q)

  if (qualifiedTransform != null) {
    if (opts.splitTransform) {
      return rowTransform === qualifiedTransform
    }
    return opts.championId === 141
  }

  if (name.includes(q) || idStr === q || idStr.includes(q)) {
    return true
  }

  if (!isTransformableChampion(opts.championId)) {
    return false
  }

  if (opts.splitTransform) {
    return transformSearchTermsMatch(opts.championId, rowTransform, q)
  }

  return (
    transformSearchTermsMatch(opts.championId, 1, q) ||
    transformSearchTermsMatch(opts.championId, 2, q) ||
    transformSearchTermsMatch(opts.championId, 0, q)
  )
}
