import type { MatchDto, MatchTimelineDto, MatchTimelineEventDto } from "../riot/types.js";
import type { ParsedParticipantDto, TeamObjectiveDto } from "../dto/match.dto.js";

function normalizeDragonElement(
  raw: unknown,
): "earth" | "water" | "wind" | "fire" | "hextec" | "chem" | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return null;
  if (v.includes("MOUNTAIN") || v.includes("EARTH")) return "earth";
  if (v.includes("OCEAN") || v.includes("WATER")) return "water";
  if (v.includes("CLOUD") || v.includes("WIND") || v.includes("AIR")) return "wind";
  if (v.includes("INFERNAL") || v.includes("FIRE")) return "fire";
  if (v.includes("HEXTECH") || v.includes("HEXTEC")) return "hextec";
  if (v.includes("CHEMTECH") || v.includes("CHEM")) return "chem";
  return null;
}

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

/** Compteurs par équipe : drakes élémentaires, elder, souls (0 ou 1 par type). */
export function countTeamDrakeAndSoulMetrics(
  timeline: MatchTimelineDto,
  participants: MatchDto["info"]["participants"],
): {
  drakes: Map<100 | 200, Record<string, number>>;
  elders: Map<100 | 200, number>;
  souls: Map<100 | 200, Record<string, number>>;
} {
  const drakes = new Map<100 | 200, Record<string, number>>();
  const elders = new Map<100 | 200, number>();
  const souls = new Map<100 | 200, Record<string, number>>();

  const bumpDrake = (team: 100 | 200, element: string) => {
    const row = drakes.get(team) ?? {};
    row[element] = (row[element] ?? 0) + 1;
    drakes.set(team, row);
  };
  const bumpSoul = (team: 100 | 200, element: string) => {
    const row = souls.get(team) ?? {};
    row[element] = 1;
    souls.set(team, row);
  };

  for (const frame of timeline.info?.frames ?? []) {
    for (const ev of frame.events ?? []) {
      const evType = String(ev.type ?? "")
        .trim()
        .toUpperCase();

      if (evType === "ELITE_MONSTER_KILL") {
        const teamId = killerTeamFromEvent(ev as MatchTimelineEventDto, participants);
        if (!teamId) continue;
        const monsterType = String((ev as { monsterType?: unknown }).monsterType ?? "")
          .trim()
          .toUpperCase();
        const monsterSubType = String((ev as { monsterSubType?: unknown }).monsterSubType ?? "")
          .trim()
          .toUpperCase();
        const isDragon = monsterType === "DRAGON";
        const isElder = isDragon && monsterSubType.includes("ELDER");
        if (isElder) {
          elders.set(teamId, (elders.get(teamId) ?? 0) + 1);
          continue;
        }
        if (isDragon) {
          const element = normalizeDragonElement(monsterSubType);
          if (element) bumpDrake(teamId, element);
        }
        continue;
      }

      if (evType === "DRAGON_SOUL_GIVEN") {
        const soulTeam = Number((ev as { teamId?: unknown }).teamId);
        if (soulTeam !== 100 && soulTeam !== 200) continue;
        const element = normalizeDragonElement((ev as { name?: unknown }).name);
        if (element) bumpSoul(soulTeam as 100 | 200, element);
      }
    }
  }

  return { drakes, elders, souls };
}

/**
 * Entrées histogramme équipe : first blood, types de drakes, souls, elder.
 * `count` = nombre dans la partie (souvent 0–4 drakes ; 1 pour first blood / soul).
 */
export function buildTeamObjectiveHistogramEntries(
  match: MatchDto,
  timeline: MatchTimelineDto,
  participants: ParsedParticipantDto[],
): TeamObjectiveDto[] {
  const out: TeamObjectiveDto[] = [];
  const team100Win = (match.info.teams ?? []).find((t) => t.teamId === 100)?.win === true;
  const outcomeFor = (team: 100 | 200): "win" | "loss" =>
    (team === 100 ? team100Win : !team100Win) ? "win" : "loss";

  const fb = participants.find((p) => p.firstBloodKill || p.firstBloodAssist);
  if (fb) {
    const team = fb.teamId as 100 | 200;
    out.push({
      type: "firstBlood",
      count: 1,
      team,
      outcome: outcomeFor(team),
      sumTimestampMs: 0,
    });
  }

  const { drakes, elders, souls } = countTeamDrakeAndSoulMetrics(
    timeline,
    match.info.participants ?? [],
  );

  for (const team of [100, 200] as const) {
    const outcome = outcomeFor(team);
    for (const [element, count] of Object.entries(drakes.get(team) ?? {})) {
      if (count > 0) {
        out.push({
          type: `${element}_drake`,
          count,
          team,
          outcome,
          sumTimestampMs: 0,
        });
      }
    }
    const elderKills = elders.get(team) ?? 0;
    if (elderKills > 0) {
      out.push({
        type: "elder",
        count: elderKills,
        team,
        outcome,
        sumTimestampMs: 0,
      });
    }
    for (const [element, gotSoul] of Object.entries(souls.get(team) ?? {})) {
      if (gotSoul > 0) {
        out.push({
          type: `${element}_soul`,
          count: 1,
          team,
          outcome,
          sumTimestampMs: 0,
        });
      }
    }
  }

  return out;
}
