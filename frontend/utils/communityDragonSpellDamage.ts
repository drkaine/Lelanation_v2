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

/** v1 champion JSON (rcp-be-lol-game-data/global/default/v1/champions/{id}.json). */
interface V1Spell {
  spellKey?: string
  coefficients?: { coefficient1?: number; coefficient2?: number }
  effectAmounts?: Record<string, number[]>
}

interface V1ChampionJson {
  name?: string
  spells?: V1Spell[]
}

function isV1ChampionJson(json: unknown): json is V1ChampionJson {
  return (
    json != null &&
    typeof json === 'object' &&
    Array.isArray((json as V1ChampionJson).spells) &&
    (json as V1ChampionJson).spells!.length > 0
  )
}

/** Normalize champion id/key to Community Dragon file name. v1 uses numeric key (e.g. 266). */
function getCommunityDragonFileName(championIdOrKey: string): string {
  return championIdOrKey
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

const SPELL_KEYS = ['Q', 'W', 'E', 'R'] as const

function parseV1SpellDamage(json: V1ChampionJson): Record<string, CommunityDragonSpellDamageData> {
  const championName = json.name ?? ''
  const result: Record<string, CommunityDragonSpellDamageData> = {}
  const spells = json.spells ?? []
  for (let i = 0; i < Math.min(4, spells.length); i++) {
    const s = spells[i]
    const key = SPELL_KEYS[Math.max(0, Math.min(i, 3))]
    const spellId = championName ? `${championName}${key}` : `${key}`

    let baseByRank: number[] = []
    if (s.effectAmounts) {
      for (const arr of Object.values(s.effectAmounts)) {
        if (Array.isArray(arr) && arr.some((v: number) => typeof v === 'number' && v !== 0)) {
          const slice = arr.slice(0, 6).filter((v): v is number => typeof v === 'number')
          if (slice.length >= 1) {
            baseByRank = slice
            break
          }
        }
      }
    }

    const coef = s.coefficients ?? {}
    const adRatio =
      coef.coefficient2 != null && coef.coefficient2 !== 0 ? coef.coefficient2 : undefined
    const apRatio =
      coef.coefficient1 != null && coef.coefficient1 !== 0 ? coef.coefficient1 : undefined

    if (baseByRank.length > 0 || adRatio != null || apRatio != null) {
      result[spellId] = {
        baseByRank: baseByRank.length > 0 ? baseByRank : [0, 0, 0, 0, 0],
        adRatio,
        bonusAdRatio: undefined,
        apRatio,
      }
    }
  }
  return result
}

/**
 * Fetch Community Dragon JSON for a champion and extract spell damage data per spell (Q,W,E,R).
 * Prefers v1 format (file by numeric key: /data/community-dragon/266.json) with coefficients/effectAmounts.
 * Returns a map spellId (Data Dragon id, e.g. "AatroxQ") -> { baseByRank, adRatio?, bonusAdRatio?, apRatio? }.
 */
export async function getCommunityDragonSpellDamage(
  championIdOrKey: string
): Promise<Record<string, CommunityDragonSpellDamageData>> {
  const fileName = getCommunityDragonFileName(championIdOrKey)
  const base = typeof window !== 'undefined' ? '' : ''
  const url = `${base}/data/community-dragon/${fileName}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return {}
    const json = (await res.json()) as V1ChampionJson | Record<string, SpellEntry>
    if (isV1ChampionJson(json)) return parseV1SpellDamage(json)

    const result: Record<string, CommunityDragonSpellDamageData> = {}
    for (const entry of Object.values(json)) {
      const scriptName = entry.mScriptName
      const dataValues = entry.mSpell?.DataValues
      if (!scriptName || !dataValues?.length) continue
      const ddSpellId = getDataDragonSpellId(championIdOrKey, scriptName)
      if (!ddSpellId) continue

      let baseByRank: number[] = []
      let adRatio: number | undefined
      let bonusAdRatio: number | undefined
      let apRatio: number | undefined

      for (const dv of dataValues) {
        const name = dv.mName ?? ''
        const values = dv.mValues ?? []
        if (name.endsWith('BaseDamage') && values.length > 0) {
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
