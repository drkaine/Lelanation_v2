/**
 * Reconstruit teamStats.objectives depuis les lignes `teams` (schéma normalisé post 2026-06-22).
 */
import type { TeamStatsDto } from "../dto/match.dto.js";

type TeamRow = Record<string, unknown>;

const DRAKE_KILL_COLUMNS: Array<{ column: string; type: string }> = [
  { column: "earth_drake_kills", type: "earth_drake" },
  { column: "water_drake_kills", type: "water_drake" },
  { column: "wind_drake_kills", type: "wind_drake" },
  { column: "fire_drake_kills", type: "fire_drake" },
  { column: "hextec_drake_kills", type: "hextec_drake" },
  { column: "chem_drake_kills", type: "chem_drake" },
];

const FIRST_FLAG_COLUMNS: Array<{ column: string; type: string }> = [
  { column: "baron_first", type: "baronFirst" },
  { column: "dragon_first", type: "dragonFirst" },
  { column: "tower_first", type: "towerFirst" },
  { column: "horde_first", type: "hordeFirst" },
  { column: "rift_herald_first", type: "riftHeraldFirst" },
  { column: "inhibitor_first", type: "inhibitorFirst" },
];

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function tb(v: unknown): boolean {
  return v === true;
}

function normalizeSoulElement(raw: unknown): string | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (v.includes("mountain") || v.includes("earth")) return "earth";
  if (v.includes("ocean") || v.includes("water")) return "water";
  if (v.includes("cloud") || v.includes("wind") || v.includes("air")) return "wind";
  if (v.includes("infernal") || v.includes("fire")) return "fire";
  if (v.includes("hextech") || v.includes("hextec")) return "hextec";
  if (v.includes("chemtech") || v.includes("chem")) return "chem";
  return v.replace(/_soul$/, "");
}

export function buildTeamStatsFromNormalized(
  match: { riot_match_id: string; patch: string; region: string; early_surrender: boolean; surrender: boolean },
  teams: TeamRow[],
  rankTier: string,
): TeamStatsDto {
  const team100 = teams.find((t) => Number(t.team_id) === 100);
  const team200 = teams.find((t) => Number(t.team_id) === 200);
  const team100Win = team100?.win === true;
  const objectives: TeamStatsDto["objectives"] = [];

  for (const team of teams) {
    const tid = Number(team.team_id) as 100 | 200;
    if (tid !== 100 && tid !== 200) continue;
    const outcome = (tid === 100 ? team100Win : !team100Win) ? "win" : "loss";

    const pushObjective = (type: string, count: number) => {
      if (count > 0) objectives.push({ type, count, team: tid, outcome, sumTimestampMs: 0 });
    };

    pushObjective("baron", n(team.baron_kills));
    pushObjective("dragon", n(team.dragon_kills));
    pushObjective("tower", n(team.tower_kills));
    pushObjective("horde", n(team.horde_kills));
    pushObjective("riftHerald", n(team.rift_herald_kills));
    pushObjective("inhibitor", n(team.inhibitor_kills));

    for (const { column, type } of FIRST_FLAG_COLUMNS) {
      if (tb(team[column])) pushObjective(type, 1);
    }

    if (tb(team.first_blood)) {
      pushObjective("firstBlood", 1);
    }

    for (const { column, type } of DRAKE_KILL_COLUMNS) {
      pushObjective(type, n(team[column]));
    }

    const elderKills = n(team.elder_drake_kills);
    if (elderKills > 0) pushObjective("elder", elderKills);

    if (tb(team.have_soul)) {
      const element = normalizeSoulElement(team.soul_type);
      if (element) pushObjective(`${element}_soul`, 1);
    }
  }

  const surrendered = match.surrender === true;
  const earlySurrendered = match.early_surrender === true;

  return {
    matchId: match.riot_match_id,
    patch: match.patch,
    region: match.region,
    rankTier,
    team100Win,
    objectives,
    surrendered,
    earlySurrendered,
    surrenderedTeam100: surrendered && !team100Win,
    surrenderedTeam200: surrendered && team100Win,
    earlySurrenderedTeam100: earlySurrendered && !team100Win,
    earlySurrenderedTeam200: earlySurrendered && team100Win,
    team100ChampionKills: n(team100?.champion_kills),
    team200ChampionKills: n(team200?.champion_kills),
    team100ElderDrakeFirst: tb(team100?.elder_drake_first),
    team200ElderDrakeFirst: tb(team200?.elder_drake_first),
  };
}
