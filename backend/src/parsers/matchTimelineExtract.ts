/**
 * Extraction timeline → buckets 5 min, historiques (items, sorts, K/D/A, wards, camps).
 */
import type { MatchTimelineDto, MatchTimelineEventDto, MatchTimelineFrameDto } from "../riot/types.js";
import { isKeptMatchPlayerDurationBucket } from "../worker/matchPlayerBucketPolicy.js";
import {
  eliteMonsterCampClears,
  inferNeutralJungleCampClears,
  mergeJungleCampHistory,
} from "./jungleCampInfer.js";
import { buildSpellHistoryDocFromEvents, type SpellHistoryDoc } from "./spellHistoryDoc.js";

function ti(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function normalizeDragonObjectiveType(monsterSubType: string): string | null {
  const v = monsterSubType.trim().toUpperCase();
  if (v.includes("ELDER")) return "elder_drake";
  if (v.includes("MOUNTAIN") || v.includes("EARTH")) return "earth_drake";
  if (v.includes("OCEAN") || v.includes("WATER")) return "water_drake";
  if (v.includes("CLOUD") || v.includes("WIND") || v.includes("AIR")) return "wind_drake";
  if (v.includes("INFERNAL") || v.includes("FIRE")) return "fire_drake";
  if (v.includes("HEXTECH") || v.includes("HEXTEC")) return "hextec_drake";
  if (v.includes("CHEMTECH") || v.includes("CHEM")) return "chem_drake";
  return null;
}

function eliteMonsterObjectiveType(monsterType: string, monsterSubType: string): string | null {
  const mt = monsterType.trim().toUpperCase();
  if (mt === "DRAGON") return normalizeDragonObjectiveType(monsterSubType) ?? "dragon";
  if (mt.includes("BARON")) return "baron";
  if (mt.includes("RIFTHERALD") || mt.includes("RIFT_HERALD")) return "rift_herald";
  if (mt.includes("HORDE") || mt.includes("GRUB") || mt.includes("VOIDGRUB")) return "horde";
  return null;
}

export type TimelineBucketSet = {
  goldBuckets: number[];
  csBuckets: number[];
  levelBuckets: number[];
  xpBuckets: number[];
  killBuckets: number[];
  assistBuckets: number[];
  deathBuckets: number[];
  jungleBuckets: number[];
  physicalDamageBuckets: number[];
  physicalDamageTakenBuckets: number[];
  magicDamageBuckets: number[];
  magicDamageTakenBuckets: number[];
  trueDamageBuckets: number[];
  trueDamageTakenBuckets: number[];
  wardPlacedBuckets: number[];
  wardKilledBuckets: number[];
  ccTimeBuckets: number[];
  goldSpentBuckets: number[];
  turretDamageBuckets: number[];
  objectiveDamageBuckets: number[];
};

export type ParticipantTimelineHistories = {
  itemHistory: Record<string, number>;
  spellHistory: SpellHistoryDoc;
  deathHistory: Array<{ death_by: number; timestamp_ms: number; position: { x: number; y: number } }>;
  killHistory: Array<{ kill_who: number; timestamp_ms: number; position: { x: number; y: number } }>;
  assistHistory: Array<{ assist_who: number; timestamp_ms: number; position: { x: number; y: number } }>;
  wardHistory: Array<{ ward_type: string; timestamp_ms: number; position: { x: number; y: number } }>;
  wardKilledHistory: Array<{ ward_type: string; timestamp_ms: number; position: { x: number; y: number } }>;
  jungleCampHistory: Array<{ camp_type: string; timestamp_ms: number }>;
  buckets: TimelineBucketSet;
};

type BucketWindow = {
  minute: number;
  startMs: number;
  endMs: number;
};

function emptyBuckets(): TimelineBucketSet {
  return {
    goldBuckets: [],
    csBuckets: [],
    levelBuckets: [],
    xpBuckets: [],
    killBuckets: [],
    assistBuckets: [],
    deathBuckets: [],
    jungleBuckets: [],
    physicalDamageBuckets: [],
    physicalDamageTakenBuckets: [],
    magicDamageBuckets: [],
    magicDamageTakenBuckets: [],
    trueDamageBuckets: [],
    trueDamageTakenBuckets: [],
    wardPlacedBuckets: [],
    wardKilledBuckets: [],
    ccTimeBuckets: [],
    goldSpentBuckets: [],
    turretDamageBuckets: [],
    objectiveDamageBuckets: [],
  };
}

function bucketWindows(gameDurationSec: number): BucketWindow[] {
  const maxMinute = Math.floor(gameDurationSec / 60);
  const windows: BucketWindow[] = [];
  for (let minute = 5; minute <= maxMinute; minute += 5) {
    if (!isKeptMatchPlayerDurationBucket(minute)) continue;
    windows.push({
      minute,
      startMs: (minute - 5) * 60_000,
      endMs: minute * 60_000,
    });
  }
  return windows;
}

function frameAtMinute(frames: MatchTimelineFrameDto[], minute: number): MatchTimelineFrameDto | null {
  const targetMs = minute * 60_000;
  let best: MatchTimelineFrameDto | null = null;
  for (const frame of frames) {
    const ts = ti(frame.timestamp);
    if (ts <= targetMs) best = frame;
    else break;
  }
  return best;
}

function participantFrameAtMinute(
  frames: MatchTimelineFrameDto[],
  minute: number,
  participantId: number,
): MatchTimelineFrameDto["participantFrames"][string] | undefined {
  return frameAtMinute(frames, minute)?.participantFrames?.[String(participantId)];
}

function goldSpentAtMinute(frames: MatchTimelineFrameDto[], minute: number, participantId: number): number {
  const pf = participantFrameAtMinute(frames, minute, participantId);
  if (!pf) return 0;
  return Math.max(0, ti(pf.totalGold) - ti(pf.currentGold));
}

function timeEnemySpentControlledAtMinute(
  frames: MatchTimelineFrameDto[],
  minute: number,
  participantId: number,
): number {
  return ti(participantFrameAtMinute(frames, minute, participantId)?.timeEnemySpentControlled);
}

function nonChampionDamageAtMinute(
  frames: MatchTimelineFrameDto[],
  minute: number,
  participantId: number,
): number {
  const ds = participantFrameAtMinute(frames, minute, participantId)?.damageStats ?? {};
  const total = ti(ds.totalDamageDone);
  const toChampions = ti(ds.totalDamageDoneToChampions);
  return Math.max(0, total - toChampions);
}

function isInWindow(ts: number, window: BucketWindow): boolean {
  return ts > window.startMs && ts <= window.endMs;
}

function wardTypeFromEvent(ev: MatchTimelineEventDto): string {
  const raw = String((ev as { wardType?: unknown }).wardType ?? "").trim().toUpperCase();
  return raw || "UNKNOWN";
}

function frameAtTimestamp(
  frames: MatchTimelineFrameDto[],
  timestampMs: number,
): MatchTimelineFrameDto | null {
  let best: MatchTimelineFrameDto | null = null;
  for (const frame of frames) {
    const ts = ti(frame.timestamp);
    if (ts <= timestampMs) best = frame;
    else break;
  }
  return best;
}

function participantPositionAtTimestamp(
  frames: MatchTimelineFrameDto[],
  timestampMs: number,
  participantId: number,
): { x: number; y: number } {
  const pf = frameAtTimestamp(frames, timestampMs)?.participantFrames?.[String(participantId)];
  return {
    x: ti(pf?.position?.x),
    y: ti(pf?.position?.y),
  };
}

function eventPosition(ev: MatchTimelineEventDto): { x: number; y: number } {
  return {
    x: ti((ev as { position?: { x?: unknown } }).position?.x),
    y: ti((ev as { position?: { y?: unknown } }).position?.y),
  };
}

/** Position événement Riot si présente, sinon position du joueur dans la frame timeline la plus proche. */
function resolveParticipantEventPosition(
  ev: MatchTimelineEventDto,
  frames: MatchTimelineFrameDto[],
  participantId: number,
  timestampMs: number,
): { x: number; y: number } {
  const fromEvent = eventPosition(ev);
  if (fromEvent.x > 0 || fromEvent.y > 0) return fromEvent;
  return participantPositionAtTimestamp(frames, timestampMs, participantId);
}

function isParticipantInvolvedInEvent(ev: MatchTimelineEventDto, participantId: number): boolean {
  const killerId = ti((ev as { killerId?: unknown }).killerId);
  if (killerId === participantId) return true;
  const assists = (ev as { assistingParticipantIds?: number[] }).assistingParticipantIds ?? [];
  return assists.includes(participantId);
}

function wardPlacedInWindow(
  events: MatchTimelineEventDto[],
  participantId: number,
  window: BucketWindow,
): number {
  let count = 0;
  for (const ev of events) {
    if (!isInWindow(ti(ev.timestamp), window)) continue;
    if (String(ev.type ?? "").toUpperCase() !== "WARD_PLACED") continue;
    if (ti((ev as { creatorId?: unknown }).creatorId) === participantId) count += 1;
  }
  return count;
}

function wardKilledInWindow(
  events: MatchTimelineEventDto[],
  participantId: number,
  window: BucketWindow,
): number {
  let count = 0;
  for (const ev of events) {
    if (!isInWindow(ti(ev.timestamp), window)) continue;
    if (String(ev.type ?? "").toUpperCase() !== "WARD_KILL") continue;
    if (ti((ev as { killerId?: unknown }).killerId) === participantId) count += 1;
  }
  return count;
}

/** Pression structurelle : bounty des tours détruites + plaques (pas de HP damage par frame côté Riot). */
function turretPressureInWindow(
  events: MatchTimelineEventDto[],
  participantId: number,
  window: BucketWindow,
): number {
  let score = 0;
  for (const ev of events) {
    if (!isInWindow(ti(ev.timestamp), window)) continue;
    const type = String(ev.type ?? "").toUpperCase();
    if (type === "BUILDING_KILL") {
      const buildingType = String((ev as { buildingType?: unknown }).buildingType ?? "").toUpperCase();
      if (!buildingType.includes("TOWER")) continue;
      if (!isParticipantInvolvedInEvent(ev, participantId)) continue;
      score += ti((ev as { bounty?: unknown }).bounty);
    } else if (type === "TURRET_PLATE_DESTROYED") {
      if (ti((ev as { killerId?: unknown }).killerId) === participantId) score += 1;
    }
  }
  return score;
}

function extractBucketsForParticipant(
  frames: MatchTimelineFrameDto[],
  events: MatchTimelineEventDto[],
  participantId: number,
  gameDurationSec: number,
): TimelineBucketSet {
  const buckets = emptyBuckets();
  const pid = ti(participantId);
  const windows = bucketWindows(gameDurationSec);

  let prevCcMs = 0;
  let prevGoldSpent = 0;
  let prevNonChampionDamage = 0;

  for (const window of windows) {
    const minute = window.minute;
    const pf = participantFrameAtMinute(frames, minute, pid);
    const ds = pf?.damageStats ?? {};

    buckets.goldBuckets.push(ti(pf?.totalGold));
    buckets.csBuckets.push(ti(pf?.minionsKilled) + ti(pf?.jungleMinionsKilled));
    buckets.levelBuckets.push(ti(pf?.level));
    buckets.xpBuckets.push(ti(pf?.xp));
    buckets.jungleBuckets.push(ti(pf?.jungleMinionsKilled));
    buckets.physicalDamageBuckets.push(ti(ds.physicalDamageDoneToChampions ?? ds.physicalDamageDealtToChampions));
    buckets.magicDamageBuckets.push(ti(ds.magicDamageDoneToChampions ?? ds.magicDamageDealtToChampions));
    buckets.trueDamageBuckets.push(ti(ds.trueDamageDoneToChampions ?? ds.trueDamageDealtToChampions));
    buckets.physicalDamageTakenBuckets.push(ti(ds.physicalDamageTaken));
    buckets.magicDamageTakenBuckets.push(ti(ds.magicDamageTaken));
    buckets.trueDamageTakenBuckets.push(ti(ds.trueDamageTaken));
    buckets.killBuckets.push(0);
    buckets.assistBuckets.push(0);
    buckets.deathBuckets.push(0);

    const ccMs = timeEnemySpentControlledAtMinute(frames, minute, pid);
    buckets.ccTimeBuckets.push(Math.max(0, Math.round((ccMs - prevCcMs) / 1000)));
    prevCcMs = ccMs;

    const goldSpent = goldSpentAtMinute(frames, minute, pid);
    buckets.goldSpentBuckets.push(Math.max(0, goldSpent - prevGoldSpent));
    prevGoldSpent = goldSpent;

    buckets.wardPlacedBuckets.push(wardPlacedInWindow(events, pid, window));
    buckets.wardKilledBuckets.push(wardKilledInWindow(events, pid, window));
    buckets.turretDamageBuckets.push(turretPressureInWindow(events, pid, window));

    const nonChampionDamage = nonChampionDamageAtMinute(frames, minute, pid);
    buckets.objectiveDamageBuckets.push(Math.max(0, nonChampionDamage - prevNonChampionDamage));
    prevNonChampionDamage = nonChampionDamage;
  }

  const killByMinute = new Map<number, number>();
  const deathByMinute = new Map<number, number>();
  const assistByMinute = new Map<number, number>();
  for (const ev of events) {
    if (String(ev.type ?? "").toUpperCase() !== "CHAMPION_KILL") continue;
    const ts = ti(ev.timestamp);
    const minute = Math.ceil(ts / 60_000 / 5) * 5;
    if (!isKeptMatchPlayerDurationBucket(minute)) continue;
    if (ti(ev.killerId) === pid) killByMinute.set(minute, (killByMinute.get(minute) ?? 0) + 1);
    if (ti(ev.victimId) === pid) deathByMinute.set(minute, (deathByMinute.get(minute) ?? 0) + 1);
    if ((ev.assistingParticipantIds ?? []).includes(pid)) {
      assistByMinute.set(minute, (assistByMinute.get(minute) ?? 0) + 1);
    }
  }
  let ki = 0;
  let di = 0;
  let ai = 0;
  for (let i = 0; i < buckets.killBuckets.length; i += 1) {
    const minute = 5 + i * 5;
    ki += killByMinute.get(minute) ?? 0;
    di += deathByMinute.get(minute) ?? 0;
    ai += assistByMinute.get(minute) ?? 0;
    buckets.killBuckets[i] = ki;
    buckets.deathBuckets[i] = di;
    buckets.assistBuckets[i] = ai;
  }

  return buckets;
}

export function extractParticipantTimelineData(
  timeline: MatchTimelineDto,
  participantId: number,
  gameDurationSec: number,
): ParticipantTimelineHistories {
  const frames = timeline.info?.frames ?? [];
  const events: MatchTimelineEventDto[] = [];
  for (const frame of frames) {
    for (const ev of frame.events ?? []) events.push(ev);
  }

  const pid = ti(participantId);
  const itemHistory: Record<string, number> = {};
  const deathHistory: ParticipantTimelineHistories["deathHistory"] = [];
  const killHistory: ParticipantTimelineHistories["killHistory"] = [];
  const assistHistory: ParticipantTimelineHistories["assistHistory"] = [];
  const wardHistory: ParticipantTimelineHistories["wardHistory"] = [];
  const wardKilledHistory: ParticipantTimelineHistories["wardKilledHistory"] = [];

  for (const ev of events) {
    const ts = ti(ev.timestamp);
    const evType = String(ev.type ?? "").trim().toUpperCase();
    const pos = eventPosition(ev);

    if (evType === "ITEM_PURCHASED" && ti(ev.participantId) === pid) {
      const itemId = ti((ev as { itemId?: unknown }).itemId);
      if (itemId > 0) itemHistory[String(itemId)] = ts;
      continue;
    }
    if (evType === "CHAMPION_KILL") {
      if (ti(ev.victimId) === pid) {
        deathHistory.push({
          death_by: ti((ev as { killerId?: unknown }).killerId),
          timestamp_ms: ts,
          position: pos,
        });
      }
      if (ti((ev as { killerId?: unknown }).killerId) === pid) {
        killHistory.push({
          kill_who: ti(ev.victimId),
          timestamp_ms: ts,
          position: pos,
        });
      }
      if ((ev.assistingParticipantIds ?? []).includes(pid)) {
        for (const aid of ev.assistingParticipantIds ?? []) {
          if (aid === pid) continue;
          assistHistory.push({ assist_who: ti(aid), timestamp_ms: ts, position: pos });
        }
      }
      continue;
    }
    if (evType === "WARD_PLACED" && ti(ev.creatorId) === pid) {
      wardHistory.push({
        ward_type: wardTypeFromEvent(ev),
        timestamp_ms: ts,
        position: resolveParticipantEventPosition(ev, frames, pid, ts),
      });
      continue;
    }
    if (evType === "WARD_KILL" && ti((ev as { killerId?: unknown }).killerId) === pid) {
      wardKilledHistory.push({
        ward_type: wardTypeFromEvent(ev),
        timestamp_ms: ts,
        position: resolveParticipantEventPosition(ev, frames, pid, ts),
      });
      continue;
    }
  }

  const jungleCampHistory = mergeJungleCampHistory(
    inferNeutralJungleCampClears(frames, pid),
    eliteMonsterCampClears(events, pid),
  );

  const buckets = extractBucketsForParticipant(frames, events, pid, gameDurationSec);
  const spellHistory = buildSpellHistoryDocFromEvents(events, pid);

  return {
    itemHistory,
    spellHistory,
    deathHistory,
    killHistory,
    assistHistory,
    wardHistory,
    wardKilledHistory,
    jungleCampHistory,
    buckets,
  };
}

export type TeamObjectiveHistogramEntry = {
  objective_type: string;
  timestamp_ms_end: number;
  timestamp_ms_begin: number;
  champion_id_initiator: number;
};

export function extractTeamObjectiveHistogram(
  timeline: MatchTimelineDto,
  teamId: 100 | 200,
  participantChampionById: Map<number, number>,
): TeamObjectiveHistogramEntry[] {
  const out: TeamObjectiveHistogramEntry[] = [];
  const frames = timeline.info?.frames ?? [];

  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      const evType = String(ev.type ?? "").trim().toUpperCase();
      const ts = ti(ev.timestamp);
      const killerId = ti((ev as { killerId?: unknown }).killerId);
      const killerTeam = ti((ev as { killerTeamId?: unknown }).killerTeamId);
      let team: 100 | 200 | null = null;
      if (killerTeam === 100 || killerTeam === 200) team = killerTeam;
      if (team !== teamId) continue;

      let objectiveType: string | null = null;
      if (evType === "CHAMPION_KILL" && killerId > 0) {
        objectiveType = "champion";
      } else if (evType === "ELITE_MONSTER_KILL") {
        objectiveType =
          eliteMonsterObjectiveType(
            String((ev as { monsterType?: unknown }).monsterType ?? ""),
            String((ev as { monsterSubType?: unknown }).monsterSubType ?? ""),
          ) ?? "dragon";
      } else if (evType === "BUILDING_KILL") {
        const buildingType = String((ev as { buildingType?: unknown }).buildingType ?? "").toUpperCase();
        if (buildingType.includes("TOWER")) objectiveType = "tower";
        else if (buildingType.includes("INHIBITOR")) objectiveType = "inhibitor";
      } else if (evType === "DRAGON_SOUL_GIVEN") {
        objectiveType = "soul";
      }

      if (!objectiveType) continue;
      out.push({
        objective_type: objectiveType,
        timestamp_ms_begin: ts,
        timestamp_ms_end: ts,
        champion_id_initiator: participantChampionById.get(killerId) ?? 0,
      });
    }
  }
  return out;
}
