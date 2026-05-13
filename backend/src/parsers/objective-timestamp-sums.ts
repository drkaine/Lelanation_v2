import type { MatchDto, MatchTimelineDto, MatchTimelineEventDto, ParticipantDto } from "../riot/types.js";

/** Keys of `team.objectives` from match-v5 (same strings as `Object.entries(team.objectives)`). */
type TeamObjectiveKey =
  | "baron"
  | "champion"
  | "dragon"
  | "horde"
  | "inhibitor"
  | "riftHerald"
  | "tower";

function participantTeamId(participants: ParticipantDto[], participantId: number): 100 | 200 | null {
  const p = participants.find((x) => x.participantId === participantId);
  const tid = Number(p?.teamId);
  if (tid === 100 || tid === 200) return tid as 100 | 200;
  return null;
}

function killerTeamFromEvent(
  ev: MatchTimelineEventDto,
  participants: ParticipantDto[],
): 100 | 200 | null {
  const kt = Number((ev as { killerTeamId?: unknown }).killerTeamId);
  if (kt === 100 || kt === 200) return kt as 100 | 200;
  const killerId = Number((ev as { killerId?: unknown }).killerId);
  if (killerId > 0) return participantTeamId(participants, killerId);
  return null;
}

function eliteMonsterToTeamObjectiveKey(monsterType: string): TeamObjectiveKey | null {
  const mt = monsterType.trim().toUpperCase();
  const isDragon = mt === "DRAGON";
  const isBaron = mt.includes("BARON");
  const isHerald = mt.includes("RIFTHERALD") || mt.includes("RIFT_HERALD");
  const isHorde =
    mt.includes("HORDE") ||
    mt.includes("ATAKHAN") ||
    mt.includes("GRUB") ||
    mt.includes("VOIDGRUB");

  if (isBaron) return "baron";
  if (isDragon) return "dragon";
  if (isHerald) return "riftHerald";
  if (isHorde) return "horde";
  return null;
}

/**
 * Sums timeline event timestamps (ms from game start, Riot `event.timestamp`) per team and
 * per `team.objectives` key, for BUILDING_KILL (tower / inhibitor) and ELITE_MONSTER_KILL.
 */
export function sumObjectiveTimestampMsByTeamAndKey(
  match: MatchDto,
  timeline: MatchTimelineDto,
): Map<string, number> {
  const out = new Map<string, number>();
  const participants = match.info.participants ?? [];
  const frames = timeline.info?.frames ?? [];

  const add = (teamId: 100 | 200, objKey: string, tsMs: number) => {
    if (!Number.isFinite(tsMs) || tsMs < 0) return;
    const k = `${teamId}|${objKey}`;
    out.set(k, (out.get(k) ?? 0) + Math.trunc(tsMs));
  };

  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      const ts = Number((ev as MatchTimelineEventDto).timestamp ?? 0);
      const evType = String(ev.type ?? "").trim().toUpperCase();

      if (evType === "ELITE_MONSTER_KILL") {
        const teamId = killerTeamFromEvent(ev as MatchTimelineEventDto, participants);
        if (!teamId) continue;
        const monsterType = String((ev as { monsterType?: unknown }).monsterType ?? "");
        const key = eliteMonsterToTeamObjectiveKey(monsterType);
        if (key) add(teamId, key, ts);
        continue;
      }

      if (evType === "BUILDING_KILL") {
        const teamId = killerTeamFromEvent(ev as MatchTimelineEventDto, participants);
        if (!teamId) continue;
        const buildingType = String((ev as { buildingType?: unknown }).buildingType ?? "")
          .trim()
          .toUpperCase();
        if (buildingType.includes("TOWER")) add(teamId, "tower", ts);
        else if (buildingType.includes("INHIBITOR")) add(teamId, "inhibitor", ts);
      }
    }
  }

  return out;
}
