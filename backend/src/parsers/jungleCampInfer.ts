import type { MatchTimelineEventDto, MatchTimelineFrameDto } from "../riot/types.js";
import { nearestNeutralCamp, nearestNeutralCampKey } from "../constants/mapSpatial.js";
import type { JungleCampEntry } from "./junglePathExtract.js";

function ti(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

/** Délai min entre deux clears du même camp (respawn ~2:15 early). */
const SAME_CAMP_COOLDOWN_MS = 75_000;

export function campTypeFromMonsterEvent(monsterType: string, monsterSubType: string): string | null {
  const mt = monsterType.trim().toUpperCase();
  const sub = monsterSubType.trim().toUpperCase();
  if (mt.includes("DRAGON")) return "dragon";
  if (mt.includes("BARON")) return "baron";
  if (mt.includes("RIFTHERALD") || mt.includes("RIFT_HERALD")) return "herald";
  if (sub.includes("BLUE")) return "blue";
  if (sub.includes("RED")) return "red";
  if (sub.includes("GROMP")) return "gromp";
  if (sub.includes("WOLF")) return "wolves";
  if (sub.includes("RAPTOR")) return "raptors";
  if (sub.includes("KRUG")) return "krugs";
  if (sub.includes("SCUTTLE") || mt.includes("HORDE") || mt.includes("GRUB")) return "scuttler";
  return null;
}

/**
 * La timeline v5 ne publie pas d'événements pour les camps neutres (gromp, wolves, …).
 * On infère les clears via les hausses de `jungleMinionsKilled` + position du joueur.
 */
export function inferNeutralJungleCampClears(
  frames: MatchTimelineFrameDto[],
  participantId: number,
): JungleCampEntry[] {
  const pid = String(ti(participantId));
  const out: JungleCampEntry[] = [];
  const lastByKey = new Map<string, number>();
  let prevJungle = 0;

  for (const frame of frames) {
    const pf = frame.participantFrames?.[pid];
    if (!pf) continue;

    const ts = ti(frame.timestamp);
    const jungle = ti(pf.jungleMinionsKilled);
    if (jungle <= prevJungle) {
      prevJungle = jungle;
      continue;
    }

    const pos = pf.position;
    const campKey =
      pos && typeof pos.x === "number" && typeof pos.y === "number"
        ? nearestNeutralCampKey(pos.x, pos.y)
        : null;
    const campType = campKey ? nearestNeutralCamp(pos!.x, pos!.y) : null;

    if (campType && campKey) {
      const last = lastByKey.get(campKey) ?? -Infinity;
      if (ts - last >= SAME_CAMP_COOLDOWN_MS) {
        out.push({ camp_type: campType, timestamp_ms: ts, camp_key: campKey });
        lastByKey.set(campKey, ts);
      }
    }

    prevJungle = jungle;
  }

  return out;
}

export function eliteMonsterCampClears(
  events: MatchTimelineEventDto[],
  participantId: number,
): JungleCampEntry[] {
  const pid = ti(participantId);
  const out: JungleCampEntry[] = [];

  for (const ev of events) {
    if (String(ev.type ?? "").toUpperCase() !== "ELITE_MONSTER_KILL") continue;
    if (ti((ev as { killerId?: unknown }).killerId) !== pid) continue;
    const camp = campTypeFromMonsterEvent(
      String((ev as { monsterType?: unknown }).monsterType ?? ""),
      String((ev as { monsterSubType?: unknown }).monsterSubType ?? ""),
    );
    if (camp) {
      out.push({ camp_type: camp, timestamp_ms: ti(ev.timestamp) });
    }
  }

  return out;
}

export function mergeJungleCampHistory(
  neutral: JungleCampEntry[],
  elite: JungleCampEntry[],
): JungleCampEntry[] {
  return [...neutral, ...elite].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}
