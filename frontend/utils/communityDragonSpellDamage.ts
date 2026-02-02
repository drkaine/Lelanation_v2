/**
 * Load spell damage data (base per rank + ratios) from Community Dragon JSON.
 * Data Dragon championFull.json has spell.effect filled with zeros; CD has real values.
 */

export interface CommunityDragonSpellDamageData {
  baseByRank: number[]
  adRatio?: number
  bonusAdRatio?: number
  apRatio?: number
}

interface SpellDataValue {
  mName?: string
  mValues?: number[]
  __type?: string
}

interface SpellEntry {
  mScriptName?: string
  mSpell?: {
    DataValues?: SpellDataValue[]
  }
}

/** Normalize champion id to Community Dragon file name (e.g. Aatrox -> Aatrox, JarvanIV -> JarvanIV) */
function getCommunityDragonFileName(championId: string): string {
  return championId
}

/**
 * Champions where Community Dragon uses different script names than Data Dragon spell ids.
 * Maps CD script name -> Data Dragon spell id (e.g. Shaco: Deceive -> ShacoQ).
 */
const CD_SCRIPT_TO_DD_SPELL_ID: Record<string, Record<string, string>> = {
  Shaco: {
    Deceive: 'ShacoQ',
    JackInTheBox: 'ShacoW',
    TwoShivPoison: 'ShacoE',
    Hallucinate: 'ShacoR',
  },
}

function getDataDragonSpellId(championId: string, scriptName: string): string | null {
  const prefix = championId.replace(/\s/g, '')
  const mainSpells = ['Q', 'W', 'E', 'R']
  if (mainSpells.some(s => scriptName === prefix + s)) return scriptName
  const map = CD_SCRIPT_TO_DD_SPELL_ID[championId]
  return map?.[scriptName] ?? null
}

/**
 * Fetch Community Dragon JSON for a champion and extract spell damage data per spell (Q,W,E,R).
 * Returns a map spellId (Data Dragon id, e.g. "AatroxQ" or "ShacoQ") -> { baseByRank, adRatio?, bonusAdRatio?, apRatio? }.
 */
export async function getCommunityDragonSpellDamage(
  championId: string
): Promise<Record<string, CommunityDragonSpellDamageData>> {
  const fileName = getCommunityDragonFileName(championId)
  const base = typeof window !== 'undefined' ? '' : ''
  const url = `${base}/data/community-dragon/${fileName}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return {}
    const json = (await res.json()) as Record<string, SpellEntry>
    const result: Record<string, CommunityDragonSpellDamageData> = {}
    for (const entry of Object.values(json)) {
      const scriptName = entry.mScriptName
      const dataValues = entry.mSpell?.DataValues
      if (!scriptName || !dataValues?.length) continue
      const ddSpellId = getDataDragonSpellId(championId, scriptName)
      if (!ddSpellId) continue

      let baseByRank: number[] = []
      let adRatio: number | undefined
      let bonusAdRatio: number | undefined
      let apRatio: number | undefined

      for (const dv of dataValues) {
        const name = dv.mName ?? ''
        const values = dv.mValues ?? []
        if (name.endsWith('BaseDamage') && values.length > 0) {
          // Rank 0 is sometimes -5 or unused; use ranks 1-5 (indices 1-5) or 0-4
          const start = values[0] != null && values[0] < 0 ? 1 : 0
          baseByRank = values.slice(start, start + 5).filter(v => typeof v === 'number')
          if (baseByRank.length < 5 && values.length >= 5) baseByRank = values.slice(0, 5)
        } else if (name.includes('TotalADRatio')) {
          adRatio = values[0] ?? values[1]
        } else if (name.includes('BonusADRatio')) {
          bonusAdRatio = values[0] ?? values[1]
        } else if (
          name.includes('SpellDamageRatio') ||
          name.includes('AbilityPowerRatio') ||
          (name.includes('APRatio') && !name.includes('Bonus'))
        ) {
          apRatio = values[0] ?? values[1]
        }
      }

      if (baseByRank.length > 0 || adRatio != null || bonusAdRatio != null || apRatio != null) {
        result[ddSpellId] = {
          baseByRank: baseByRank.length > 0 ? baseByRank : [0, 0, 0, 0, 0],
          adRatio,
          bonusAdRatio,
          apRatio,
        }
      }
    }
    return result
  } catch {
    return {}
  }
}
