import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

export type BalanceLevelKey = 'average' | 'skilled' | 'elite'

export interface BalanceOpRule {
  winrateHigh: number
  winrateLow: number
  banrateMultiplier: number
  minGames: number
  banrateTwoPatchAvgMin?: number
}

export interface BalanceUpRule {
  winrateMax?: number
  presenceMax?: number
}

export interface BalanceLevelRules {
  tiers: string[]
  overpowered: BalanceOpRule
  underpowered: BalanceUpRule
}

export interface BalanceRulesConfig {
  levels: {
    average: BalanceLevelRules
    skilled: BalanceLevelRules
    elite: BalanceLevelRules
  }
}

const BALANCE_RULES_FILE = join(process.cwd(), 'data', 'stats', 'balance-rules.json')

export function getDefaultBalanceRules(): BalanceRulesConfig {
  return {
    levels: {
      average: {
        tiers: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
        overpowered: {
          winrateHigh: 54,
          winrateLow: 52.5,
          banrateMultiplier: 5,
          minGames: 50,
        },
        underpowered: {
          winrateMax: 49,
        },
      },
      skilled: {
        tiers: ['PLATINUM', 'EMERALD', 'DIAMOND'],
        overpowered: {
          winrateHigh: 53.5,
          winrateLow: 52,
          banrateMultiplier: 5,
          minGames: 50,
        },
        underpowered: {
          winrateMax: 49,
        },
      },
      elite: {
        tiers: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        overpowered: {
          winrateHigh: 54,
          winrateLow: 52.5,
          banrateMultiplier: 5,
          minGames: 30,
          banrateTwoPatchAvgMin: 50,
        },
        underpowered: {
          presenceMax: 7.5,
        },
      },
    },
  }
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function asNumber(input: unknown, fallback: number): number {
  const n = typeof input === 'number' ? input : Number(input)
  return Number.isFinite(n) ? n : fallback
}

function asTierArray(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return [...fallback]
  const out = input
    .map((v) => String(v ?? '').trim().toUpperCase())
    .filter(Boolean)
  return out.length > 0 ? out : [...fallback]
}

export function sanitizeBalanceRules(input: unknown): BalanceRulesConfig {
  const def = getDefaultBalanceRules()
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const levels = (src.levels && typeof src.levels === 'object'
    ? src.levels
    : {}) as Record<string, unknown>

  const parseLevel = (key: BalanceLevelKey): BalanceLevelRules => {
    const levelSrc = (levels[key] && typeof levels[key] === 'object'
      ? levels[key]
      : {}) as Record<string, unknown>
    const defLevel = def.levels[key]
    const opSrc = (levelSrc.overpowered && typeof levelSrc.overpowered === 'object'
      ? levelSrc.overpowered
      : {}) as Record<string, unknown>
    const upSrc = (levelSrc.underpowered && typeof levelSrc.underpowered === 'object'
      ? levelSrc.underpowered
      : {}) as Record<string, unknown>

    const overpowered: BalanceOpRule = {
      winrateHigh: clampPct(asNumber(opSrc.winrateHigh, defLevel.overpowered.winrateHigh)),
      winrateLow: clampPct(asNumber(opSrc.winrateLow, defLevel.overpowered.winrateLow)),
      banrateMultiplier: Math.max(0, asNumber(opSrc.banrateMultiplier, defLevel.overpowered.banrateMultiplier)),
      minGames: Math.max(1, Math.trunc(asNumber(opSrc.minGames, defLevel.overpowered.minGames))),
    }
    if (key === 'elite') {
      overpowered.banrateTwoPatchAvgMin = clampPct(
        asNumber(opSrc.banrateTwoPatchAvgMin, defLevel.overpowered.banrateTwoPatchAvgMin ?? 50)
      )
    }

    const underpowered: BalanceUpRule = {}
    if (key === 'elite') {
      underpowered.presenceMax = clampPct(
        asNumber(upSrc.presenceMax, defLevel.underpowered.presenceMax ?? 7.5)
      )
    } else {
      underpowered.winrateMax = clampPct(
        asNumber(upSrc.winrateMax, defLevel.underpowered.winrateMax ?? 49)
      )
    }

    return {
      tiers: asTierArray(levelSrc.tiers, defLevel.tiers),
      overpowered,
      underpowered,
    }
  }

  return {
    levels: {
      average: parseLevel('average'),
      skilled: parseLevel('skilled'),
      elite: parseLevel('elite'),
    },
  }
}

export async function readBalanceRules(): Promise<BalanceRulesConfig> {
  const read = await FileManager.readJson<unknown>(BALANCE_RULES_FILE)
  if (read.isErr()) {
    return getDefaultBalanceRules()
  }
  return sanitizeBalanceRules(read.unwrap())
}

export async function writeBalanceRules(input: unknown): Promise<{
  ok: boolean
  data?: BalanceRulesConfig
  error?: string
}> {
  const sanitized = sanitizeBalanceRules(input)
  const write = await FileManager.writeJson(BALANCE_RULES_FILE, sanitized)
  if (write.isErr()) {
    return { ok: false, error: write.unwrapErr().message }
  }
  return { ok: true, data: sanitized }
}

export function getBalanceRulesFilePath(): string {
  return BALANCE_RULES_FILE
}
