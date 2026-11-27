import type { ParticipantEventCounts } from "../types/eventClassifier.js";

/**
 * Colonnes lane events d'un participant, fusionnées dans la ligne avant l'INSERT
 * (un seul write par ligne : pas d'UPDATE qui laisse une version morte dans le heap et le TOAST).
 */
export function laneEventColumns(
  byParticipant: Map<number, ParticipantEventCounts>,
  participantId: number,
): Record<string, number> {
  const c = byParticipant.get(participantId);
  if (!c) return {};
  return {
    kill_by_dive: c.killByDive,
    death_by_dive: c.deathByDive,
    kill_by_gank: c.killByGank,
    death_by_gank: c.deathByGank,
    kill_by_roaming: c.killByRoam,
    death_by_roaming: c.deathByRoam,
    kill_on_objective: c.killOnObjective,
    death_on_objective: c.deathOnObjective,
  };
}
