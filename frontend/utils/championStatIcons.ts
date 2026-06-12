/** Stat icons used in builder info (StatsTable) and statistics misc tab. */
export const championStatIconByKey: Record<string, string> = {
  health: '/icons/statsicon/Health.svg',
  mana: '/icons/statsicon/Mana.svg',
  attackDamage: '/icons/statsicon/AD.png',
  abilityPower: '/icons/statsicon/ap.png',
  armor: '/icons/statsicon/Armor.png',
  magicResist: '/icons/statsicon/Magic_resistance.png',
  movementSpeed: '/icons/statsicon/Movement_speed.png',
  healthRegen: '/icons/statsicon/Health_regeneration.svg',
  attackSpeed: '/icons/statsicon/AS.png',
  critChance: '/icons/statsicon/Critical_strike_damage.png',
  critDamage: '/icons/statsicon/Critical_strike.png',
  manaRegen: '/icons/statsicon/Mana_regeneration.svg',
  attackRange: '/icons/statsicon/Range.png',
  cooldownReduction: '/icons/statsicon/Cooldown_reduction.png',
  goldValue: '/icons/statsicon/Gold.svg',
  goldCost: '/icons/statsicon/Gold.svg',
  goldEfficiency: '/icons/statsicon/Gold.svg',
  goldPer10: '/icons/statsicon/Gold.svg',
  lifeSteal: '/icons/statsicon/Life_steal.svg',
  spellVamp: '/icons/statsicon/Spell_vamp.png',
  omnivamp: '/icons/statsicon/Omnivamp.svg',
  tenacity: '/icons/statsicon/Tenacity.png',
  lethality: '/icons/statsicon/Armor_penetration.png',
  armorPenetration: '/icons/statsicon/Armor_penetration.png',
  magicPenetration: '/icons/statsicon/Magic_penetration.png',
  shield: '/icons/statsicon/Heal_and_shield_power.png',
  healShieldPower: '/icons/statsicon/Heal_and_shield_power.png',
}

export function getChampionStatIconSrc(key: string): string | null {
  return championStatIconByKey[key] ?? null
}

export function getChampionStatIconImageClass(key: string): string {
  const compactKeys = new Set([
    'tenacity',
    'shield',
    'healShieldPower',
    'abilityHaste',
    'cooldownReduction',
    'movementSpeed',
    'attackSpeed',
    'armor',
  ])
  return compactKeys.has(key) ? 'stat-inline-icon-image--compact' : ''
}

/** Pastille colorée autour de l’icône (aligné builder infos / StatsTable). */
export function getChampionStatIconToneClass(key: string): string {
  const hpKeys = new Set(['health', 'healthRegen', 'totalEffectiveHealth'])
  const armorKeys = new Set(['armor', 'physicalEffectiveHealth', 'armorDamageReductionPercent'])
  const manaKeys = new Set(['mana', 'manaRegen'])
  const apKeys = new Set(['abilityPower'])
  const hasteKeys = new Set(['abilityHaste', 'cooldownReduction'])
  const critKeys = new Set(['critChance'])
  const vampKeys = new Set(['lifeSteal', 'spellVamp', 'omnivamp'])
  const adKeys = new Set(['attackDamage'])
  const asKeys = new Set(['attackSpeed'])
  const arpenKeys = new Set(['armorPenetration', 'lethality'])
  const shieldKeys = new Set(['shield', 'healShieldPower'])
  const tenacityKeys = new Set(['tenacity'])
  const mrKeys = new Set(['magicResist', 'magicalEffectiveHealth', 'magicDamageReductionPercent'])

  if (hpKeys.has(key)) return 'stat-inline-icon--hp'
  if (armorKeys.has(key)) return 'stat-inline-icon--armor'
  if (manaKeys.has(key)) return 'stat-inline-icon--mana'
  if (apKeys.has(key)) return 'stat-inline-icon--ap'
  if (hasteKeys.has(key)) return 'stat-inline-icon--haste'
  if (critKeys.has(key)) return 'stat-inline-icon--crit'
  if (vampKeys.has(key)) return 'stat-inline-icon--vamp'
  if (adKeys.has(key)) return 'stat-inline-icon--ad'
  if (asKeys.has(key)) return 'stat-inline-icon--as'
  if (arpenKeys.has(key)) return 'stat-inline-icon--arpen'
  if (shieldKeys.has(key)) return 'stat-inline-icon--shield'
  if (tenacityKeys.has(key)) return 'stat-inline-icon--tenacity'
  if (mrKeys.has(key)) return 'stat-inline-icon--mr'
  return 'stat-inline-icon--default'
}
