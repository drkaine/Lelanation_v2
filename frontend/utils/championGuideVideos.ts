import type { YouTubeVideo } from '~/types/youtube'

/** Séries de guides YouTube rattachées à la page d'un champion. */
export type ChampionGuideSeries = 'macro' | 'micro' | 'topMonde' | 'guide'
export type ChampionGuideRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support'

export const CHAMPION_GUIDE_ROLES: readonly ChampionGuideRole[] = [
  'top',
  'jungle',
  'mid',
  'adc',
  'support',
]

/**
 * Règles des titres de guides : pour en ajouter, compléter la liste de la série.
 * Phrases écrites sans accents ni majuscules (le titre est normalisé avant comparaison).
 * Elles servent au filtre « Guide » de /videos et aux guides par champion.
 */
export const GUIDE_TITLE_PHRASES: Readonly<Record<ChampionGuideSeries, readonly string[]>> = {
  macro: ['guide macro'],
  micro: ['guide micro', 'base micro', 'bases micro'],
  topMonde: ['voici comment le top monde', 'une masterclass du top monde'],
  guide: [
    "comment l'elite",
    "la touche en plus que l'elite",
    'comment le meilleur otp',
    'comment la meilleur',
    'comment la meilleure',
    "les erreurs qui t'empechent",
    'la perfection',
    'la micro',
    'la macro',
    'voici comment',
    'comment build et carry',
    "c'est d'abord maitriser les bases",
    "c'est surtout savoir",
    'comme le top',
    'une masterclass',
    'propulse tes bases',
    'plus loin que les bases',
    'le plus gros spammeur',
    'le plus gros spammer',
    "je n'ai jamais vu un otp aussi",
  ],
}

const SERIES_ORDER: readonly ChampionGuideSeries[] = ['macro', 'micro', 'topMonde', 'guide']

function phraseRegExp(phrases: readonly string[]): RegExp {
  return new RegExp(`(?<![a-z0-9])(?:${phrases.map(escapeRegExp).join('|')})(?![a-z0-9])`)
}

const SERIES_PATTERNS: ReadonlyArray<[ChampionGuideSeries, RegExp]> = SERIES_ORDER.map(series => [
  series,
  phraseRegExp(GUIDE_TITLE_PHRASES[series]),
])

/** Titre de guide pour le filtre « Guide » de /videos (règles des séries + règles génériques). */
export function isGuideVideoTitle(title: string): boolean {
  const t = normalize(title)
  if (SERIES_PATTERNS.some(([, pattern]) => pattern.test(t))) return true
  if (/\bguide\b/.test(t) || /comment\s+jouer/.test(t)) return true
  return /\bcomment\b/.test(t) && /\b(builds?|carry)\b/.test(t)
}

/** Rôle n'importe où dans le titre (« top » de « top monde », « top 10 », « le top » exclu). */
const ANY_ROLE_RE = /(?<!\ble )\b(top|jgl|jungle|mid|adc|bot|sup|supp|support)\b(?! monde| ?\d)/

const ROLE_TOKENS: Record<string, ChampionGuideRole> = {
  top: 'top',
  jgl: 'jungle',
  jungle: 'jungle',
  mid: 'mid',
  adc: 'adc',
  bot: 'adc',
  sup: 'support',
  supp: 'support',
  support: 'support',
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").toLowerCase()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Série et rôle d'un titre de guide pour ce champion, ou null s'il ne le concerne pas. */
export function parseChampionGuideTitle(
  title: string,
  championName: string
): { series: ChampionGuideSeries; role: ChampionGuideRole | null } | null {
  const name = normalize(championName).trim()
  if (!name) return null
  const text = normalize(title)
  const series = SERIES_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0]
  if (!series) return null

  const nameRe = new RegExp(`(?<![a-z0-9])${escapeRegExp(name)}(?![a-z0-9'])`, 'g')
  let mentioned = false
  for (const match of text.matchAll(nameRe)) {
    mentioned = true
    const after = text.slice((match.index ?? 0) + match[0].length)
    const token = /^\s+([a-z]+)\b/.exec(after)?.[1]
    const role = token ? ROLE_TOKENS[token] : undefined
    if (role) return { series, role }
  }
  if (!mentioned) return null
  const fallback = ANY_ROLE_RE.exec(text)?.[1]
  return { series, role: fallback ? (ROLE_TOKENS[fallback] ?? null) : null }
}

export type ChampionGuideRoleGroup = {
  role: ChampionGuideRole | null
  videos: YouTubeVideo[]
}

/** Guides du champion rangés par rôle (ordre des lanes, rôle inconnu en dernier), plus récents d'abord. */
export function championGuideVideosByRole(
  videos: readonly YouTubeVideo[],
  championName: string
): ChampionGuideRoleGroup[] {
  const byRole = new Map<ChampionGuideRole | null, Map<string, YouTubeVideo>>()
  for (const video of videos) {
    const parsed = parseChampionGuideTitle(video.title ?? '', championName)
    if (!parsed) continue
    const bucket = byRole.get(parsed.role) ?? new Map<string, YouTubeVideo>()
    bucket.set(video.id, video)
    byRole.set(parsed.role, bucket)
  }
  const order: Array<ChampionGuideRole | null> = [...CHAMPION_GUIDE_ROLES, null]
  return order
    .filter(role => byRole.has(role))
    .map(role => ({
      role,
      videos: [...byRole.get(role)!.values()].sort((a, b) =>
        String(b.publishedAt).localeCompare(String(a.publishedAt))
      ),
    }))
}

/** Vidéo réduite au strict nécessaire pour compter et filtrer les guides (payload SSR léger). */
export type GuideVideoRef = Pick<YouTubeVideo, 'id' | 'title'>

/** Réduit les vidéos à { id, title } : dédoublonnées par id, sans titre vide. */
export function slimGuideVideos(videos: readonly YouTubeVideo[]): GuideVideoRef[] {
  const byId = new Map<string, GuideVideoRef>()
  for (const { id, title } of videos) {
    if (id && title && !byId.has(id)) byId.set(id, { id, title })
  }
  return [...byId.values()]
}

/** Nombre de guides vidéo (ids uniques) par nom de champion. */
export function championGuideVideoCounts(
  videos: readonly GuideVideoRef[],
  championNames: readonly string[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const name of championNames) {
    const ids = new Set<string>()
    for (const video of videos) {
      if (parseChampionGuideTitle(video.title ?? '', name)) ids.add(video.id)
    }
    counts[name] = ids.size
  }
  return counts
}

/** Rôles couverts par les guides de chaque champion, dans l'ordre des lanes. */
export function championGuideRoles(
  videos: readonly GuideVideoRef[],
  championNames: readonly string[]
): Record<string, ChampionGuideRole[]> {
  const out: Record<string, ChampionGuideRole[]> = {}
  for (const name of championNames) {
    const roles = new Set<ChampionGuideRole>()
    for (const video of videos) {
      const role = parseChampionGuideTitle(video.title ?? '', name)?.role
      if (role) roles.add(role)
    }
    out[name] = CHAMPION_GUIDE_ROLES.filter(r => roles.has(r))
  }
  return out
}

/** Recherche par nom (sans accents ni casse) et rôles de guide (au moins un des rôles choisis). */
export function championMatchesGuideFilter(
  champion: { name: string; roles: readonly ChampionGuideRole[] },
  query: string,
  selectedRoles: readonly ChampionGuideRole[]
): boolean {
  const q = normalize(query.trim())
  if (q && !normalize(champion.name).includes(q)) return false
  if (selectedRoles.length > 0 && !selectedRoles.some(r => champion.roles.includes(r))) return false
  return true
}
