import type { ParsedParticipantDto } from '../dto/match.dto.js'

const U15_METRIC_GETTERS: Record<string, (p: ParsedParticipantDto) => number> = {
  sum_physique_damage_done_to_champion_u15: (p) => p.u15.physDmgToChampion,
  sum_magic_damage_done_to_champion_u15: (p) => p.u15.magicDmgToChampion,
  sum_true_damage_done_to_champion_u15: (p) => p.u15.trueDmgToChampion,
  sum_kill_u15: (p) => p.u15.kills,
  sum_assist_u15: (p) => p.u15.assists,
  sum_death_u15: (p) => p.u15.deaths,
  sum_vision_score_u15: (p) => p.u15.visionScore,
  sum_shield_and_heal_u15: (p) => p.u15.shieldAndHeal,
  sum_minions_killed_u15: (p) => p.u15.cs,
}

export function championVsMetricValue(participant: ParsedParticipantDto, column: string): number {
  const u15 = U15_METRIC_GETTERS[column]
  if (u15) {
    const v = u15(participant)
    return Number.isFinite(v) ? Math.trunc(v) : 0
  }
  if (column === 'sum_gold_earned') return Math.trunc(Number(participant.goldEarned) || 0)
  if (column === 'sum_gold_spent') return Math.trunc(Number(participant.goldSpent) || 0)
  const raw = (participant as Record<string, unknown>)[column]
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  return 0
}
