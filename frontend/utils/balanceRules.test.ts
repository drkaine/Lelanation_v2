import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BALANCE_RULES_FORM,
  balanceRulesPayload,
  parseBalanceRulesForm,
} from './balanceRules'

describe('balanceRules', () => {
  it('valeurs par défaut si réponse vide ou invalide', () => {
    expect(parseBalanceRulesForm(null)).toEqual(DEFAULT_BALANCE_RULES_FORM)
    expect(parseBalanceRulesForm({ levels: { elite: 'x' } })).toEqual(DEFAULT_BALANCE_RULES_FORM)
  })

  it('lit les seuils par niveau', () => {
    const form = parseBalanceRulesForm({
      levels: {
        average: { overpowered: { winrateHigh: 55 }, underpowered: { winrateMax: 48 } },
        elite: { overpowered: { banrateTwoPatchAvgMin: 40 }, underpowered: { presenceMax: '6' } },
      },
    })
    expect(form.averageWinrateHigh).toBe(55)
    expect(form.averageWinrateMax).toBe(48)
    expect(form.eliteBanrateTwoPatchAvgMin).toBe(40)
    expect(form.elitePresenceMax).toBe(6)
    expect(form.skilledWinrateHigh).toBe(53.5)
  })

  it('aller-retour formulaire → payload → formulaire', () => {
    const form = { ...DEFAULT_BALANCE_RULES_FORM, skilledWinrateLow: 51, eliteBanrateMultiplier: 4 }
    const payload = balanceRulesPayload(form)
    expect(payload.levels.average.tiers).toEqual(['IRON', 'BRONZE', 'SILVER', 'GOLD'])
    expect(payload.levels.elite.overpowered.minGames).toBe(30)
    expect(parseBalanceRulesForm(payload)).toEqual(form)
  })
})
