/** Formulaire « Balance Framework Rules » (admin) : lecture tolérante et payload PUT. */
export type BalanceRulesForm = {
  averageWinrateHigh: number
  averageWinrateLow: number
  averageBanrateMultiplier: number
  averageWinrateMax: number
  skilledWinrateHigh: number
  skilledWinrateLow: number
  skilledBanrateMultiplier: number
  skilledWinrateMax: number
  eliteWinrateHigh: number
  eliteWinrateLow: number
  eliteBanrateMultiplier: number
  eliteBanrateTwoPatchAvgMin: number
  elitePresenceMax: number
}

export const DEFAULT_BALANCE_RULES_FORM: BalanceRulesForm = {
  averageWinrateHigh: 54,
  averageWinrateLow: 52.5,
  averageBanrateMultiplier: 5,
  averageWinrateMax: 49,
  skilledWinrateHigh: 53.5,
  skilledWinrateLow: 52,
  skilledBanrateMultiplier: 5,
  skilledWinrateMax: 49,
  eliteWinrateHigh: 54,
  eliteWinrateLow: 52.5,
  eliteBanrateMultiplier: 5,
  eliteBanrateTwoPatchAvgMin: 50,
  elitePresenceMax: 7.5,
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function parseBalanceRulesForm(rules: unknown): BalanceRulesForm {
  const levels = obj(obj(rules).levels)
  const level = (name: string) => {
    const l = obj(levels[name])
    return { op: obj(l.overpowered), up: obj(l.underpowered) }
  }
  const avg = level('average')
  const sk = level('skilled')
  const el = level('elite')
  const d = DEFAULT_BALANCE_RULES_FORM
  return {
    averageWinrateHigh: num(avg.op.winrateHigh, d.averageWinrateHigh),
    averageWinrateLow: num(avg.op.winrateLow, d.averageWinrateLow),
    averageBanrateMultiplier: num(avg.op.banrateMultiplier, d.averageBanrateMultiplier),
    averageWinrateMax: num(avg.up.winrateMax, d.averageWinrateMax),
    skilledWinrateHigh: num(sk.op.winrateHigh, d.skilledWinrateHigh),
    skilledWinrateLow: num(sk.op.winrateLow, d.skilledWinrateLow),
    skilledBanrateMultiplier: num(sk.op.banrateMultiplier, d.skilledBanrateMultiplier),
    skilledWinrateMax: num(sk.up.winrateMax, d.skilledWinrateMax),
    eliteWinrateHigh: num(el.op.winrateHigh, d.eliteWinrateHigh),
    eliteWinrateLow: num(el.op.winrateLow, d.eliteWinrateLow),
    eliteBanrateMultiplier: num(el.op.banrateMultiplier, d.eliteBanrateMultiplier),
    eliteBanrateTwoPatchAvgMin: num(el.op.banrateTwoPatchAvgMin, d.eliteBanrateTwoPatchAvgMin),
    elitePresenceMax: num(el.up.presenceMax, d.elitePresenceMax),
  }
}

export function balanceRulesPayload(f: BalanceRulesForm) {
  return {
    levels: {
      average: {
        tiers: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
        overpowered: {
          winrateHigh: f.averageWinrateHigh,
          winrateLow: f.averageWinrateLow,
          banrateMultiplier: f.averageBanrateMultiplier,
          minGames: 50,
        },
        underpowered: { winrateMax: f.averageWinrateMax },
      },
      skilled: {
        tiers: ['PLATINUM', 'EMERALD', 'DIAMOND'],
        overpowered: {
          winrateHigh: f.skilledWinrateHigh,
          winrateLow: f.skilledWinrateLow,
          banrateMultiplier: f.skilledBanrateMultiplier,
          minGames: 50,
        },
        underpowered: { winrateMax: f.skilledWinrateMax },
      },
      elite: {
        tiers: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        overpowered: {
          winrateHigh: f.eliteWinrateHigh,
          winrateLow: f.eliteWinrateLow,
          banrateMultiplier: f.eliteBanrateMultiplier,
          minGames: 30,
          banrateTwoPatchAvgMin: f.eliteBanrateTwoPatchAvgMin,
        },
        underpowered: { presenceMax: f.elitePresenceMax },
      },
    },
  }
}
