import type {
  ChampionMiscBaseStatKey,
  ChampionMiscStatRow,
} from '~/utils/championBaseStatsFromJson'
import { championMiscManaUnavailable } from '~/utils/championMiscStatLevel'
import { resolveChampionResourceKind, resolveResourceStatLabel } from '~/utils/theorycraftStats'

type Loc = 'fr' | 'en'

/** Colonnes groupées de la maquette « Stats de base ». */
export const MISC_STAT_GROUPS: ReadonlyArray<{
  key: 'survival' | 'attack' | 'other'
  stats: readonly ChampionMiscBaseStatKey[]
}> = [
  { key: 'survival', stats: ['hp', 'armor', 'magicResist'] },
  { key: 'attack', stats: ['attackDamage', 'attackSpeed', 'attackRange'] },
  { key: 'other', stats: ['mp', 'movespeed'] },
]

function nf(locale: Loc, maxDigits: number, minDigits = 0): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  })
}

export function formatMiscValue(key: ChampionMiscBaseStatKey, value: number, locale: Loc): string {
  const v = Number.isFinite(value) ? value : 0
  if (key === 'attackSpeed') return nf(locale, 3, 3).format(v)
  if (key === 'attackRange' || key === 'movespeed') return nf(locale, 0).format(Math.round(v))
  return nf(locale, 1).format(v)
}

/** "+5,2", "+3,5 %" (vitesse d'attaque) ; null si pas de croissance. */
export function formatMiscGrowth(
  key: ChampionMiscBaseStatKey,
  growth: number,
  locale: Loc
): string | null {
  if (!Number.isFinite(growth) || growth === 0) return null
  const n = nf(locale, 1).format(growth)
  const sign = growth > 0 ? '+' : ''
  if (key === 'attackSpeed') return `${sign}${n}${locale === 'fr' ? ' %' : '%'}`
  return `${sign}${n}`
}

/** "350 mana" ; sinon nom de la ressource (Courage, Fureur, Aucune) au lieu de « NA ». */
export function miscResourceCell(
  row: Pick<ChampionMiscStatRow, 'partype' | 'base'>,
  valueAtLevel: number,
  locale: Loc
): string {
  const kind = resolveChampionResourceKind(row.partype)
  if (kind === 'none') return locale === 'fr' ? 'Aucune' : 'None'
  if (kind === 'mana' && championMiscManaUnavailable(row))
    return locale === 'fr' ? 'Aucune' : 'None'
  const label = resolveResourceStatLabel(row.partype, locale)
  if (kind === 'mana' || kind === 'energy') {
    return `${formatMiscValue('mp', valueAtLevel, locale)} ${label.toLowerCase()}`
  }
  return label
}
