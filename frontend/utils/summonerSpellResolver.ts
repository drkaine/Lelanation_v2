import type { SummonerSpell } from '@lelanation/shared-types'

export type SummonerSpellRefLike = {
  id?: string
  key?: string
  name?: string
  image?: { full?: string }
  tooltip?: string
  description?: string
}

function imageStem(filename: string | undefined): string {
  return String(filename ?? '')
    .trim()
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
}

function lookupInCatalog(
  id: string,
  getSpellById: (id: string) => SummonerSpell | undefined,
  spells?: SummonerSpell[]
): SummonerSpell | undefined {
  const normalized = String(id ?? '').trim()
  if (!normalized) return undefined

  const fromGetter = getSpellById(normalized)
  if (fromGetter) return fromGetter

  if (!spells?.length) return undefined

  return spells.find(
    spell =>
      spell.key === normalized ||
      spell.id === normalized ||
      spell.id.toLowerCase() === normalized.toLowerCase()
  )
}

/** Resolve a lightweight build ref to full DDragon summoner spell data. */
export function resolveSummonerSpellFromRef(
  ref: SummonerSpellRefLike | null | undefined,
  getSpellById: (id: string) => SummonerSpell | undefined,
  spells?: SummonerSpell[]
): SummonerSpell | undefined {
  if (!ref) return undefined

  const candidates = new Set<string>()
  for (const value of [ref.id, ref.key, imageStem(ref.image?.full)]) {
    const trimmed = String(value ?? '').trim()
    if (trimmed) candidates.add(trimmed)
  }

  for (const candidate of candidates) {
    const found = lookupInCatalog(candidate, getSpellById, spells)
    if (found) return found
  }

  const inlineTooltip = String(ref.tooltip ?? ref.description ?? '').trim()
  if (!inlineTooltip) return undefined

  return {
    id: String(ref.id ?? ref.key ?? 'Unknown'),
    key: String(ref.key ?? ref.id ?? ''),
    name: String(ref.name ?? ref.id ?? 'Summoner spell'),
    description: inlineTooltip,
    tooltip: inlineTooltip,
    maxrank: 1,
    cooldown: [],
    cooldownBurn: '',
    cost: [],
    costBurn: '',
    datavalues: {},
    effect: [],
    effectBurn: [],
    vars: [],
    summonerLevel: 1,
    modes: [],
    costType: '',
    maxammo: '',
    range: [],
    rangeBurn: '',
    image: ref.image ?? { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
    resource: '',
  } as SummonerSpell
}

export function normalizeSummonerSpell(spell: SummonerSpell): SummonerSpell {
  const tooltip = String(spell.tooltip ?? '').trim()
  const description = String(spell.description ?? '').trim()
  return {
    ...spell,
    tooltip: tooltip || description,
    description: description || tooltip,
  }
}
