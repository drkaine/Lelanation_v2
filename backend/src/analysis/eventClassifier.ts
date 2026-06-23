import { getLaneZone, positionToZone, TOWER_AGGRO_RADIUS, type TowerPosition } from "../constants/map.js";
import type { ParticipantMeta } from "../types/eventClassifier.js";
import type { ChampionKillEvent } from "../types/timeline.js";

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function isDive(
  killPosition: { x: number; y: number },
  victimTeamId: number,
  standingTowers: TowerPosition[],
): boolean {
  return standingTowers
    .filter((t) => t.teamId === victimTeamId)
    .some((t) => dist(killPosition.x, killPosition.y, t.x, t.y) <= TOWER_AGGRO_RADIUS);
}

export function isGank(
  killEvent: ChampionKillEvent,
  participantMap: Map<number, ParticipantMeta>,
  killerTeamId: number,
  framesBefore: Map<number, { x: number; y: number }>,
): boolean {
  const killZone = getLaneZone(killEvent.position.x, killEvent.position.y);
  if (killZone === "JUNGLE") return false;

  const allParticipants = [killEvent.killerId, ...killEvent.assistingParticipantIds];
  const jungler = allParticipants
    .map((id) => participantMap.get(id))
    .find((p) => p?.teamId === killerTeamId && p?.teamPosition === "JUNGLE");

  if (!jungler) return false;

  const junglerPosBefore = framesBefore.get(jungler.participantId);
  if (!junglerPosBefore) return true;
  const junglerZoneBefore = getLaneZone(junglerPosBefore.x, junglerPosBefore.y);
  return junglerZoneBefore === "JUNGLE";
}

export function isRoam(
  killEvent: ChampionKillEvent,
  killer: ParticipantMeta,
  timestamp: number,
): boolean {
  if (killer.teamPosition === "JUNGLE") return false;
  if (timestamp >= 1_200_000) return false;

  const killZone = getLaneZone(killEvent.position.x, killEvent.position.y);
  if (killZone === "JUNGLE") return false;

  const killerZone = positionToZone(killer.teamPosition);
  return killerZone !== null && killerZone !== killZone;
}
