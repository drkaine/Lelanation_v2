import {
  getChampionStatIconImageClass,
  getChampionStatIconSrc,
  getChampionStatIconToneClass,
} from './championStatIcons'

/** Maps Data Dragon item filter tags to builder stat icon keys. */
export const ITEM_TAG_STAT_KEY: Record<string, string> = {
  Damage: 'attackDamage',
  CriticalStrike: 'critChance',
  AttackSpeed: 'attackSpeed',
  OnHit: 'attackSpeed',
  ArmorPenetration: 'armorPenetration',
  AbilityPower: 'abilityPower',
  Mana: 'mana',
  MagicPenetration: 'magicPenetration',
  Health: 'health',
  Armor: 'armor',
  MagicResist: 'magicResist',
  AbilityHaste: 'abilityHaste',
  NonbootsMovement: 'movementSpeed',
  LifeSteal: 'lifeSteal',
  Omnivamp: 'omnivamp',
}

export function getItemTagStatKey(tag: string): string | null {
  return ITEM_TAG_STAT_KEY[tag] ?? null
}

export function getItemTagIconSrc(tag: string): string | null {
  const key = getItemTagStatKey(tag)
  return key ? getChampionStatIconSrc(key) : null
}

export function getItemTagIconToneClass(tag: string): string {
  const key = getItemTagStatKey(tag)
  return key ? getChampionStatIconToneClass(key) : 'stat-inline-icon--default'
}

export function getItemTagIconImageClass(tag: string): string {
  const key = getItemTagStatKey(tag)
  return key ? getChampionStatIconImageClass(key) : ''
}
