import type { MatchTimelineEventDto } from "../riot/types.js";

function ti(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function normalizeDragonElement(raw: unknown): "earth" | "water" | "wind" | "fire" | "hextec" | "chem" | null {
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

function inc(out: Record<string, number>, key: string, delta = 1): void {
  out[key] = (out[key] ?? 0) + delta;
}

/**
 * Compteurs objectifs / structures alignés sur `champion_stats` (`count_*`) depuis la timeline,
 * pour compléter les challenges match-v5 (souvent absents ou agrégés équipe).
 */
export function timelineChampionObjectiveMetrics(
  events: MatchTimelineEventDto[],
  participantId: number,
  participantTeamId: 100 | 200,
  teamWon: boolean,
): Record<string, number> {
  const pid = ti(participantId);
  if (pid <= 0) return {};
  const out: Record<string, number> = {};

  const winBump = (involvedKey: string) => {
    if (teamWon) inc(out, involvedKey);
  };

  const applyElite = (
    killerId: number,
    assistingIds: number[],
    flags: { baron: boolean; dragon: boolean; elder: boolean; herald: boolean; horde: boolean },
  ) => {
    const touch = (id: number, isKill: boolean) => {
      if (id !== pid) return;
      if (flags.baron) {
        if (isKill) inc(out, "sum_baron_kills");
        else inc(out, "count_baron_assist");
        winBump("count_baron_involved_win");
      }
      if (flags.dragon) {
        inc(out, isKill ? "count_dragon_kill" : "count_dragon_assist");
        winBump("count_dragon_involved_win");
      }
      if (flags.elder) {
        inc(out, isKill ? "count_elder_kill" : "count_elder_assist");
        winBump("count_elder_involved_win");
      }
      if (flags.herald) {
        inc(out, isKill ? "count_rift_herald_kill" : "count_rift_herald_assist");
        winBump("count_rift_herald_involved_win");
      }
      if (flags.horde) {
        inc(out, isKill ? "count_horde_kill" : "count_horde_assist");
        winBump("count_horde_involved_win");
      }
    };

    if (killerId > 0) touch(killerId, true);
    for (const aid of assistingIds) {
      if (aid > 0) touch(aid, false);
    }
  };

  for (const ev of events) {
    const evType = String(ev.type ?? "")
      .trim()
      .toUpperCase();

    if (evType === "ELITE_MONSTER_KILL") {
      const killerId = ti((ev as { killerId?: unknown }).killerId);
      const rawAssist = (ev as { assistingParticipantIds?: unknown }).assistingParticipantIds;
      const assistingIds = Array.isArray(rawAssist)
        ? rawAssist.map((x) => ti(x)).filter((x) => x > 0)
        : [];
      const monsterType = String((ev as { monsterType?: unknown }).monsterType ?? "")
        .trim()
        .toUpperCase();
      const monsterSubType = String((ev as { monsterSubType?: unknown }).monsterSubType ?? "")
        .trim()
        .toUpperCase();

      const isDragon = monsterType === "DRAGON";
      const isElder = isDragon && monsterSubType.includes("ELDER");
      const isBaron = monsterType.includes("BARON");
      const isHerald = monsterType.includes("RIFTHERALD") || monsterType.includes("RIFT_HERALD");
      const isHorde =
        monsterType.includes("HORDE") || monsterType.includes("ATAKHAN") || monsterType.includes("GRUB");

      applyElite(killerId, assistingIds, {
        baron: isBaron,
        dragon: isDragon,
        elder: isElder,
        herald: isHerald,
        horde: isHorde,
      });

      if (isDragon && !isElder) {
        const element = normalizeDragonElement(monsterSubType);
        if (!element) continue;
        const dk = `count_${element}_drake_kill`;
        const da = `count_${element}_drake_assist`;
        if (killerId === pid) inc(out, dk);
        for (const aid of assistingIds) {
          if (aid === pid) inc(out, da);
        }
      }
      continue;
    }

    if (evType === "BUILDING_KILL") {
      const killerId = ti((ev as { killerId?: unknown }).killerId);
      const rawAssist = (ev as { assistingParticipantIds?: unknown }).assistingParticipantIds;
      const assistingIds = Array.isArray(rawAssist)
        ? rawAssist.map((x) => ti(x)).filter((x) => x > 0)
        : [];
      const buildingType = String((ev as { buildingType?: unknown }).buildingType ?? "")
        .trim()
        .toUpperCase();
      const isTower = buildingType.includes("TOWER");
      const isInhibitor = buildingType.includes("INHIBITOR");
      if (!isTower && !isInhibitor) continue;

      const touch = (id: number, isKill: boolean) => {
        if (id !== pid) return;
        if (isTower) {
          inc(out, isKill ? "count_tower_kill" : "count_tower_assist");
          winBump("count_tower_involved_win");
        } else {
          inc(out, isKill ? "count_inhibitor_kill" : "count_inhibitor_assist");
          winBump("count_inhibitor_involved_win");
        }
      };
      if (killerId > 0) touch(killerId, true);
      for (const aid of assistingIds) {
        if (aid > 0) touch(aid, false);
      }
      continue;
    }

    if (evType === "DRAGON_SOUL_GIVEN") {
      const soulTeam = ti((ev as { teamId?: unknown }).teamId);
      if (soulTeam !== participantTeamId) continue;
      const element = normalizeDragonElement((ev as { name?: unknown }).name);
      if (!element) continue;
      inc(out, `count_${element}_soul`);
    }
  }

  // Prefix yields count_baron_kill_ge{1,2,3p}_game only — not the dropped count_baron_kill column.
  addPerGameKillBuckets(out, "sum_baron_kills", "count_baron_kill");
  addPerGameKillBuckets(out, "count_dragon_kill", "count_dragon_kill");
  addPerGameKillBuckets(out, "count_tower_kill", "count_tower_kill");
  addPerGameKillBuckets(out, "count_inhibitor_kill", "count_inhibitor_kill");
  addHordeKillBuckets(out);
  addRiftHeraldKillBuckets(out);

  return out;
}

function addPerGameKillBuckets(
  out: Record<string, number>,
  killCol: string,
  prefix: string,
): void {
  const k = out[killCol] ?? 0;
  if (k >= 1) inc(out, `${prefix}_ge1_game`);
  if (k >= 2) inc(out, `${prefix}_ge2_game`);
  if (k >= 3) inc(out, `${prefix}_ge3p_game`);
}

function addHordeKillBuckets(out: Record<string, number>): void {
  const k = out.count_horde_kill ?? 0;
  if (k >= 1) inc(out, "count_horde_kill_ge1_game");
  if (k >= 2) inc(out, "count_horde_kill_ge2_game");
  if (k >= 3) inc(out, "count_horde_kill_ge3p_game");
  if (k >= 4) inc(out, "count_horde_kill_ge4_game");
  if (k >= 5) inc(out, "count_horde_kill_ge5p_game");
}

function addRiftHeraldKillBuckets(out: Record<string, number>): void {
  const k = out.count_rift_herald_kill ?? 0;
  if (k >= 1) inc(out, "count_rift_herald_kill_ge1_game");
  if (k >= 2) inc(out, "count_rift_herald_kill_ge2p_game");
}
