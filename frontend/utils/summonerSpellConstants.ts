/**
 * Summoner spell tooltip variables (patch ~16.10).
 * DDragon no longer resolves {{ vars }} in description; values come from game data / legacy tooltips.
 * Key = DDragon spell `key` (numeric id string).
 */
export const SUMMONER_SPELL_VARS_BY_KEY: Record<string, Record<string, number | string>> = {
  '21': {
    shieldstrength: '100-460',
    shieldduration: '2.5',
  },
  '1': {
    tenacityvalue: 0.75,
    tenacityduration: '3',
  },
  '14': {
    tooltiptruedamagecalculation: '70-410',
    grievousamount: 0.6,
  },
  '3': {
    slow: '40',
    damagereduction: '35',
    debuffduration: '3',
  },
  '6': {
    movespeedmod: '24-48%',
    duration: '10',
  },
  '7': {
    totalheal: '80-318',
    movespeed: 0.3,
    movespeedduration: '1',
  },
  '11': {
    smitebasedamage: '600-1200',
    firstpvpdamage: '40',
  },
  '12': {
    channelduration: '3',
    upgrademinute: '10',
  },
}
