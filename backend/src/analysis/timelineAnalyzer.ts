import { INITIAL_TOWERS, type TowerPosition } from "../constants/map.js";
import { isDive, isGank, isRoam } from "./eventClassifier.js";
import type { ParticipantEventCounts, ParticipantMeta } from "../types/eventClassifier.js";
import type {
  BuildingKillEvent,
  ChampionKillEvent,
  RiotTimeline,
  TimelineEvent,
} from "../types/timeline.js";

function emptyCounts(participantId: number): ParticipantEventCounts {
  return {
    participantId,
    killByDive: 0,
    deathByDive: 0,
    killByGank: 0,
    deathByGank: 0,
    killByRoam: 0,
    deathByRoam: 0,
  };
}

function asChampionKill(event: TimelineEvent): ChampionKillEvent | null {
  if (event.type !== "CHAMPION_KILL") return null;
  const kill = event as ChampionKillEvent;
  const pos = kill.position;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return null;
  return {
    type: "CHAMPION_KILL",
    timestamp: kill.timestamp,
    killerId: kill.killerId,
    victimId: kill.victimId,
    assistingParticipantIds: Array.isArray(kill.assistingParticipantIds)
      ? kill.assistingParticipantIds
      : [],
    position: { x: pos.x, y: pos.y },
  };
}

function asBuildingKill(event: TimelineEvent): BuildingKillEvent | null {
  if (event.type !== "BUILDING_KILL") return null;
  const bk = event as BuildingKillEvent;
  const pos = bk.position;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return null;
  return bk;
}

function removeDestroyedTower(standingTowers: TowerPosition[], bk: BuildingKillEvent): void {
  const idx = standingTowers.findIndex(
    (t) =>
      t.teamId === bk.teamId &&
      Math.sqrt((t.x - bk.position.x) ** 2 + (t.y - bk.position.y) ** 2) < 500,
  );
  if (idx !== -1) standingTowers.splice(idx, 1);
}

export function processTimeline(
  timeline: RiotTimeline,
  participants: ParticipantMeta[],
): ParticipantEventCounts[] {
  const participantMap = new Map<number, ParticipantMeta>(
    participants.map((p) => [p.participantId, p]),
  );

  const counts = new Map<number, ParticipantEventCounts>(
    participants.map((p) => [p.participantId, emptyCounts(p.participantId)]),
  );

  const standingTowers: TowerPosition[] = [...INITIAL_TOWERS];

  const frameIndex = new Map<number, Map<number, { x: number; y: number }>>();
  for (const frame of timeline.info.frames) {
    const posMap = new Map<number, { x: number; y: number }>();
    for (const [idStr, pf] of Object.entries(frame.participantFrames)) {
      const pos = pf.position;
      if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
        posMap.set(Number(idStr), { x: pos.x, y: pos.y });
      }
    }
    frameIndex.set(frame.timestamp, posMap);
  }

  function getPositions60sBefore(timestamp: number): Map<number, { x: number; y: number }> {
    const targetTs = timestamp - 60_000;
    let closest: number | null = null;
    for (const ts of frameIndex.keys()) {
      if (ts <= targetTs && (closest === null || ts > closest)) closest = ts;
    }
    return closest !== null ? (frameIndex.get(closest) ?? new Map()) : new Map();
  }

  const allEvents = timeline.info.frames.flatMap((f) => f.events);
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  for (const event of allEvents) {
    const buildingKill = asBuildingKill(event);
    if (buildingKill?.buildingType === "TOWER_BUILDING") {
      removeDestroyedTower(standingTowers, buildingKill);
    }

    const kill = asChampionKill(event);
    if (!kill || kill.killerId === 0) continue;

    const killer = participantMap.get(kill.killerId);
    const victim = participantMap.get(kill.victimId);
    if (!killer || !victim) continue;

    const framesBefore = getPositions60sBefore(kill.timestamp);

    const dive = isDive(kill.position, victim.teamId, standingTowers);
    const gank = !dive && isGank(kill, participantMap, killer.teamId, framesBefore);
    const roam = !dive && !gank && isRoam(kill, killer, kill.timestamp);

    const allActors = [kill.killerId, ...kill.assistingParticipantIds]
      .map((id) => participantMap.get(id))
      .filter((p): p is ParticipantMeta => p !== undefined);

    if (dive) {
      for (const actor of allActors) {
        counts.get(actor.participantId)!.killByDive++;
      }
      counts.get(victim.participantId)!.deathByDive++;
    } else if (gank) {
      for (const actor of allActors) {
        if (actor.teamPosition !== "JUNGLE") {
          counts.get(actor.participantId)!.killByGank++;
        }
      }
      counts.get(victim.participantId)!.deathByGank++;
    } else if (roam) {
      counts.get(killer.participantId)!.killByRoam++;
      counts.get(victim.participantId)!.deathByRoam++;
    }
  }

  return Array.from(counts.values());
}
