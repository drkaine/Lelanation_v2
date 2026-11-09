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

const MISC_STAT_META: Record<ChampionMiscBaseStatKey, { icon: string; color: string }> = {
  hp: { icon: '/icons/statsicon/Health.svg', color: '#3fb56b' },
  armor: { icon: '/icons/statsicon/Armor.png', color: '#e0a347' },
  magicResist: { icon: '/icons/statsicon/Magic_resistance.png', color: '#a77fe0' },
  attackDamage: { icon: '/icons/statsicon/AD.png', color: '#e2665a' },
  attackSpeed: { icon: '/icons/statsicon/AS.png', color: '#f0c75e' },
  attackRange: { icon: '/icons/statsicon/Range.png', color: '#c8aa6e' },
  mp: { icon: '/icons/statsicon/Mana.svg', color: '#4a9fe8' },
  hpRegen: { icon: '/icons/statsicon/Health_regeneration.svg', color: '#3fb56b' },
  mpRegen: { icon: '/icons/statsicon/Mana_regeneration.svg', color: '#4a9fe8' },
  movespeed: { icon: '/icons/statsicon/Movement_speed.png', color: '#cbc3b0' },
}

/** Icône et couleur d'une stat de base (en-têtes, cartes mobiles, valeurs). */
export function miscStatMeta(key: ChampionMiscBaseStatKey): { icon: string; color: string } {
  return MISC_STAT_META[key]
}
