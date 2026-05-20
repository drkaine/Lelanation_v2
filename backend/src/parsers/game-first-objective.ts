import type { MatchDto, MatchTimelineDto, MatchTimelineEventDto } from "../riot/types.js";
import type { ParsedParticipantDto } from "../dto/match.dto.js";

/** `objective_outcome_histogram.obj_count` for `objective_type = 'gameFirst'`. */
export const GAME_FIRST_OBJECTIVE_BUCKET: Record<string, number> = {
  firstBlood: 1,
  tower: 2,
  dragon: 3,
  baron: 4,
  horde: 5,
  riftHerald: 6,
  inhibitor: 7,
};

export const GAME_FIRST_OBJECTIVE_BUCKET_LABEL: Record<number, string> = {
  1: "firstBlood",
  2: "tower",
  3: "dragon",
  4: "baron",
  5: "horde",
  6: "riftHerald",
  7: "inhibitor",
};

function participantTeamId(
  participants: MatchDto["info"]["participants"],
  participantId: number,
): 100 | 200 | null {
  const p = (participants ?? []).find((x) => x.participantId === participantId);
  const tid = Number(p?.teamId);
  if (tid === 100 || tid === 200) return tid as 100 | 200;
  return null;
}

function killerTeamFromEvent(
  ev: MatchTimelineEventDto,
  participants: MatchDto["info"]["participants"],
): 100 | 200 | null {
  const kt = Number((ev as { killerTeamId?: unknown }).killerTeamId);
  if (kt === 100 || kt === 200) return kt as 100 | 200;
  const killerId = Number((ev as { killerId?: unknown }).killerId);
  if (killerId > 0) return participantTeamId(participants, killerId);
  return null;
}

function eliteMonsterBucket(monsterType: string, monsterSubType: string): number | null {
  const mt = monsterType.trim().toUpperCase();
  const sub = monsterSubType.trim().toUpperCase();
  if (mt !== "DRAGON") {
    if (mt.includes("BARON")) return GAME_FIRST_OBJECTIVE_BUCKET.baron;
    if (mt.includes("RIFTHERALD") || mt.includes("RIFT_HERALD"))
      return GAME_FIRST_OBJECTIVE_BUCKET.riftHerald;
    if (
      mt.includes("HORDE") ||
      mt.includes("ATAKHAN") ||
      mt.includes("GRUB") ||
      mt.includes("VOIDGRUB")
    ) {
      return GAME_FIRST_OBJECTIVE_BUCKET.horde;
    }
    return null;
  }
  if (sub.includes("ELDER")) return null;
  return GAME_FIRST_OBJECTIVE_BUCKET.dragon;
}

type Candidate = { ts: number; bucket: number; team: 100 | 200 };

/**
 * Premier objectif chronologique de la partie (pour histogramme `gameFirst`).
 */
export function resolveGameFirstObjective(
  match: MatchDto,
  timeline: MatchTimelineDto,
  participants: ParsedParticipantDto[],
): { bucket: number; team: 100 | 200; outcome: "win" | "loss" } | null {
  const team100Win = (match.info.teams ?? []).find((t) => t.teamId === 100)?.win === true;
  const outcomeFor = (team: 100 | 200): "win" | "loss" =>
    (team === 100 ? team100Win : !team100Win) ? "win" : "loss";

  const riotParticipants = match.info.participants ?? [];
  const candidates: Candidate[] = [];

  const fb = participants.find((p) => p.firstBloodKill || p.firstBloodAssist);
  const fbTeam = fb?.teamId;
  if (fbTeam === 100 || fbTeam === 200) {
    candidates.push({
      ts: 0,
      bucket: GAME_FIRST_OBJECTIVE_BUCKET.firstBlood,
      team: fbTeam,
    });
  }

  for (const frame of timeline.info?.frames ?? []) {
    for (const ev of frame.events ?? []) {
      const ts = Number((ev as MatchTimelineEventDto).timestamp ?? 0);
      if (!Number.isFinite(ts) || ts < 0) continue;
      const evType = String(ev.type ?? "")
        .trim()
        .toUpperCase();

      if (evType === "ELITE_MONSTER_KILL") {
        const teamId = killerTeamFromEvent(ev as MatchTimelineEventDto, riotParticipants);
        if (!teamId) continue;
        const monsterType = String((ev as { monsterType?: unknown }).monsterType ?? "");
        const monsterSubType = String((ev as { monsterSubType?: unknown }).monsterSubType ?? "");
        const bucket = eliteMonsterBucket(monsterType, monsterSubType);
        if (bucket != null) candidates.push({ ts, bucket, team: teamId });
        continue;
      }

      if (evType === "BUILDING_KILL") {
        const teamId = killerTeamFromEvent(ev as MatchTimelineEventDto, riotParticipants);
        if (!teamId) continue;
        const buildingType = String((ev as { buildingType?: unknown }).buildingType ?? "")
          .trim()
          .toUpperCase();
        if (buildingType.includes("TOWER")) {
          candidates.push({ ts, bucket: GAME_FIRST_OBJECTIVE_BUCKET.tower, team: teamId });
        } else if (buildingType.includes("INHIBITOR")) {
          candidates.push({ ts, bucket: GAME_FIRST_OBJECTIVE_BUCKET.inhibitor, team: teamId });
        }
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.ts - b.ts || a.bucket - b.bucket);
  const first = candidates[0]!;
  return { bucket: first.bucket, team: first.team, outcome: outcomeFor(first.team) };
}
