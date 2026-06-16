import type { ParsedItemDto } from "../dto/match.dto.js";
import { CHAMPION_VS_STATS_LANE_METRIC_COLUMNS } from "../constants/championVsStatsMetricColumns.js";
import { isBootsItemId, isBootsTier2Or3ItemId } from "./bootItemClassification.js";
import { isLegendaryCompleteItem } from "./itemLegendaryClassification.js";
import type { MatchTimelineEventDto, MatchTimelineFrameDto, ParticipantDto } from "../riot/types.js";

const U15_MS = 900_000;
const MINUTE_MARKS = [5, 10, 15] as const;
const CONSUMABLE_IDS = new Set([2003, 2009, 2010, 2031, 2032, 2033, 2055, 2060]);

function ti(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function inc(out: Record<string, number>, key: string, delta = 1): void {
  out[key] = (out[key] ?? 0) + delta;
}

function frameAtOrBeforeMinute(
  frames: MatchTimelineFrameDto[],
  minute: number,
): MatchTimelineFrameDto | null {
  const targetMs = minute * 60_000;
  let best: MatchTimelineFrameDto | null = null;
  for (const frame of frames) {
    if (ti(frame.timestamp) <= targetMs) best = frame;
    else break;
  }
  return best;
}

function participantFrameAtMinute(
  frames: MatchTimelineFrameDto[],
  minute: number,
  participantId: number,
): {
  totalGold: number;
  goldSpent: number;
  cs: number;
  level: number;
  xp: number;
} {
  const frame = frameAtOrBeforeMinute(frames, minute);
  const pf = frame?.participantFrames?.[String(participantId)];
  if (!pf) {
    return { totalGold: 0, goldSpent: 0, cs: 0, level: 0, xp: 0 };
  }
  const totalGold = ti(pf.totalGold);
  const currentGold = ti(pf.currentGold);
  const cs = ti(pf.minionsKilled) + ti(pf.jungleMinionsKilled);
  return {
    totalGold,
    goldSpent: Math.max(0, totalGold - currentGold),
    cs,
    level: ti(pf.level),
    xp: ti(pf.xp),
  };
}

function wardScoreBefore(events: MatchTimelineEventDto[], participantId: number, cutoffMs: number): number {
  let score = 0;
  for (const ev of events) {
    const ts = ti(ev.timestamp);
    if (ts >= cutoffMs) break;
    const type = String(ev.type ?? "").toUpperCase();
    if (type === "WARD_PLACED" && ti((ev as { creatorId?: unknown }).creatorId) === participantId) {
      const wardType = String((ev as { wardType?: unknown }).wardType ?? "").toUpperCase();
      score += wardType.includes("CONTROL") || wardType.includes("SIGHT") ? 0 : 1;
    } else if (type === "WARD_KILL" && ti((ev as { killerId?: unknown }).killerId) === participantId) {
      score += 1;
    }
  }
  return score;
}

function isNearEnemyTurretKill(ev: MatchTimelineEventDto, victimTeamId: 100 | 200): boolean {
  const pos = (ev as { position?: { x?: unknown; y?: unknown } }).position;
  const x = ti(pos?.x);
  const y = ti(pos?.y);
  if (x <= 0 && y <= 0) return false;
  // Summoner's Rift approx: enemy top-side for team 100 is high y, for team 200 low y.
  if (victimTeamId === 100) return y > 10_000;
  return y < 5_000;
}

function firstPurchaseTimestamp(
  items: ParsedItemDto[],
  predicate: (itemId: number) => boolean,
): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (const row of items) {
    if (!predicate(row.itemId)) continue;
    if (row.timestampMs < best) best = row.timestampMs;
  }
  return best === Number.MAX_SAFE_INTEGER ? 0 : best;
}

function countConsumablePurchases(items: ParsedItemDto[]): number {
  let n = 0;
  for (const row of items) {
    if (CONSUMABLE_IDS.has(row.itemId)) n += 1;
  }
  return n;
}

function objectiveFlags(monsterType: string, monsterSubType: string): {
  drake: boolean;
  voidMonster: boolean;
  herald: boolean;
} {
  const mt = monsterType.toUpperCase();
  const sub = monsterSubType.toUpperCase();
  const isDragon = mt === "DRAGON";
  const isElder = isDragon && sub.includes("ELDER");
  const isHerald = mt.includes("RIFTHERALD") || mt.includes("RIFT_HERALD");
  const isHorde =
    mt.includes("HORDE") || mt.includes("ATAKHAN") || mt.includes("GRUB") || mt.includes("VOID");
  return {
    drake: isDragon && !isElder,
    voidMonster: isHorde,
    herald: isHerald,
  };
}

export type ChampionVsLaneMetricsInput = {
  frames: MatchTimelineFrameDto[];
  events: MatchTimelineEventDto[];
  participantId: number;
  opponentParticipantId: number;
  participantTeamId: 100 | 200;
  opponentTeamId: 100 | 200;
  participant: ParticipantDto;
  opponent: ParticipantDto;
  participantItems: ParsedItemDto[];
  opponentItems: ParsedItemDto[];
  finalInventorySet: ReadonlySet<number>;
  opponentFinalInventorySet: ReadonlySet<number>;
};

export function computeChampionVsLaneMetrics(
  input: ChampionVsLaneMetricsInput,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const col of CHAMPION_VS_STATS_LANE_METRIC_COLUMNS) out[col] = 0;

  const pid = ti(input.participantId);
  const oid = ti(input.opponentParticipantId);
  if (pid <= 0 || oid <= 0) return out;

  const { frames, events } = input;

  for (const minute of MINUTE_MARKS) {
    const self = participantFrameAtMinute(frames, minute, pid);
    const opp = participantFrameAtMinute(frames, minute, oid);
    const suffix = `${minute}min`;
    inc(out, `sum_gold_difference_${suffix}`, self.totalGold - opp.totalGold);
    inc(out, `sum_gold_spent_${suffix}`, self.goldSpent);
    inc(out, `sum_gold_spent_by_opponent_${suffix}`, opp.goldSpent);
    inc(out, `sum_gold_possessed_${suffix}`, self.totalGold);
    inc(out, `sum_gold_possessed_by_opponent_${suffix}`, opp.totalGold);
    inc(out, `sum_cs_difference_${suffix}`, self.cs - opp.cs);
    inc(out, `sum_cs_${suffix}`, self.cs);
    inc(out, `sum_cs_opponent_${suffix}`, opp.cs);
    inc(out, `sum_level_${suffix}`, self.level);
    inc(out, `sum_level_opponent_${suffix}`, opp.level);
    inc(out, `sum_xp_${suffix}`, self.xp);
    inc(out, `sum_xp_opponent_${suffix}`, opp.xp);

    const visionSelf = wardScoreBefore(events, pid, minute * 60_000);
    const visionOpp = wardScoreBefore(events, oid, minute * 60_000);
    inc(out, `sum_vision_${suffix}`, visionSelf);
    inc(out, `sum_vision_opponent_${suffix}`, visionOpp);
    inc(out, `sum_vision_score_difference_${suffix}`, visionSelf - visionOpp);
  }

  for (const ev of events) {
    if (String(ev.type ?? "").toUpperCase() !== "CHAMPION_KILL") continue;
    const ts = ti(ev.timestamp);
    const killerId = ti((ev as { killerId?: unknown }).killerId);
    const victimId = ti((ev as { victimId?: unknown }).victimId);
    const assistRaw = (ev as { assistingParticipantIds?: unknown }).assistingParticipantIds;
    const assists = Array.isArray(assistRaw) ? assistRaw.map((x) => ti(x)).filter((x) => x > 0) : [];

    for (const minute of MINUTE_MARKS) {
      if (ts >= minute * 60_000) continue;
      const suffix = `${minute}min`;
      if (killerId === pid && victimId === oid) inc(out, `sum_kill_opponent_${suffix}`);
      if (killerId === oid && victimId === pid) inc(out, `sum_death_by_opponent_${suffix}`);
    }

    if (ts >= U15_MS) continue;

    const selfInvolved = killerId === pid || assists.includes(pid);
    const allyHelp =
      killerId === pid
        ? assists.some((a) => a !== pid && a !== oid)
        : assists.includes(pid) && killerId !== oid;
    const nonLaneKiller = killerId > 0 && killerId !== oid && killerId !== pid;

    if (selfInvolved && isNearEnemyTurretKill(ev, input.opponentTeamId)) {
      inc(out, "sum_kill_by_dive");
    }
    if (victimId === pid && isNearEnemyTurretKill(ev, input.participantTeamId)) {
      inc(out, "sum_death_by_dive");
    }

    if (selfInvolved && (allyHelp || nonLaneKiller)) {
      inc(out, "sum_kill_by_gank");
    }
    if (victimId === pid && killerId !== oid && killerId !== pid) {
      inc(out, "sum_death_by_gank");
    }

    if (killerId === pid && victimId !== oid) {
      inc(out, "sum_kill_by_roaming");
    }
    if (assists.includes(pid) && victimId !== oid && killerId !== pid) {
      inc(out, "sum_kill_by_roaming");
    }
    if (victimId === pid && killerId !== oid) {
      inc(out, "sum_death_by_roaming");
    }
    if (killerId === oid && victimId !== pid) {
      inc(out, "sum_kill_by_roaming_by_opponent");
    }
    if (victimId === oid && killerId !== pid) {
      inc(out, "sum_death_by_roaming_by_opponent");
    }
  }

  const selfLegendaryTs = firstPurchaseTimestamp(input.participantItems, (id) =>
    isLegendaryCompleteItem(id, input.finalInventorySet),
  );
  const oppLegendaryTs = firstPurchaseTimestamp(input.opponentItems, (id) =>
    isLegendaryCompleteItem(id, input.opponentFinalInventorySet),
  );
  if (selfLegendaryTs > 0) inc(out, "sum_buy_legendary_item_timestamp", selfLegendaryTs);
  if (oppLegendaryTs > 0) inc(out, "sum_opponent_buy_legendary_item_timestamp", oppLegendaryTs);
  if (selfLegendaryTs > 0 && (oppLegendaryTs === 0 || selfLegendaryTs < oppLegendaryTs)) {
    inc(out, "sum_have_legendary_item_first");
  }
  if (oppLegendaryTs > 0 && (selfLegendaryTs === 0 || oppLegendaryTs < selfLegendaryTs)) {
    inc(out, "sum_opponent_have_legendary_item_first");
  }

  const selfBootsTs = firstPurchaseTimestamp(input.participantItems, isBootsItemId);
  const oppBootsTs = firstPurchaseTimestamp(input.opponentItems, isBootsItemId);
  if (selfBootsTs > 0) inc(out, "sum_buy_boots_item_timestamp", selfBootsTs);
  if (oppBootsTs > 0) inc(out, "sum_opponent_buy_boots_item_timestamp", oppBootsTs);
  if (selfBootsTs > 0 && (oppBootsTs === 0 || selfBootsTs < oppBootsTs)) {
    inc(out, "sum_have_boots_item_first");
  }
  if (oppBootsTs > 0 && (selfBootsTs === 0 || oppBootsTs < selfBootsTs)) {
    inc(out, "sum_opponent_have_boots_item_first");
  }

  const selfBootsT2Ts = firstPurchaseTimestamp(input.participantItems, isBootsTier2Or3ItemId);
  const oppBootsT2Ts = firstPurchaseTimestamp(input.opponentItems, isBootsTier2Or3ItemId);
  if (selfBootsT2Ts > 0) inc(out, "sum_buy_boots_tier2_item_timestamp", selfBootsT2Ts);
  if (oppBootsT2Ts > 0) inc(out, "sum_opponent_buy_boots_tier2_item_timestamp", oppBootsT2Ts);
  if (selfBootsT2Ts > 0 && (oppBootsT2Ts === 0 || selfBootsT2Ts < oppBootsT2Ts)) {
    inc(out, "sum_have_boots_tier2_item_first");
  }
  if (oppBootsT2Ts > 0 && (selfBootsT2Ts === 0 || oppBootsT2Ts < selfBootsT2Ts)) {
    inc(out, "sum_opponent_have_boots_tier2_item_first");
  }

  inc(out, "sum_consumable_item_bought", countConsumablePurchases(input.participantItems));
  inc(out, "sum_consumable_item_bought_by_opponent", countConsumablePurchases(input.opponentItems));

  if (input.participant.firstTowerKill || input.participant.firstTowerAssist) {
    inc(out, "sum_first_tower");
  }
  if (input.opponent.firstTowerKill || input.opponent.firstTowerAssist) {
    inc(out, "sum_first_tower_by_opponent");
  }

  inc(out, "sum_turret_plate_taken", ti(input.participant.challenges?.turretPlatesTaken));
  inc(out, "sum_turret_plate_taken_by_opponent", ti(input.opponent.challenges?.turretPlatesTaken));

  const applyElite = (
    killerId: number,
    assistingIds: number[],
    flags: { drake: boolean; voidMonster: boolean; herald: boolean },
    stolen: boolean,
  ) => {
    const touch = (id: number, isKill: boolean) => {
      const isSelf = id === pid;
      const isOpp = id === oid;
      if (!isSelf && !isOpp) return;
      if (flags.drake) {
        if (isSelf) inc(out, isKill ? "sum_drake_kill" : "sum_drake_assist");
        if (isOpp) inc(out, isKill ? "sum_drake_kill_by_opponent" : "sum_drake_assist_by_opponent");
      }
      if (flags.voidMonster) {
        if (isSelf) inc(out, isKill ? "sum_void_kill" : "sum_void_assist");
        if (isOpp) inc(out, isKill ? "sum_void_kill_by_opponent" : "sum_void_assist_by_opponent");
      }
      if (flags.herald) {
        if (isSelf) inc(out, isKill ? "sum_herald_kill" : "sum_herald_assist");
        if (isOpp) inc(out, isKill ? "sum_herald_kill_by_opponent" : "sum_herald_assist_by_opponent");
      }
      if (stolen) {
        if (isSelf) inc(out, "sum_objective_stolen");
        if (isOpp) inc(out, "sum_objective_stolen_by_opponent");
      }
    };
    if (killerId > 0) touch(killerId, true);
    for (const aid of assistingIds) {
      if (aid > 0) touch(aid, false);
    }
  };

  for (const ev of events) {
    const evType = String(ev.type ?? "").toUpperCase();
    if (evType === "ELITE_MONSTER_KILL") {
      const killerId = ti((ev as { killerId?: unknown }).killerId);
      const rawAssist = (ev as { assistingParticipantIds?: unknown }).assistingParticipantIds;
      const assistingIds = Array.isArray(rawAssist)
        ? rawAssist.map((x) => ti(x)).filter((x) => x > 0)
        : [];
      const monsterType = String((ev as { monsterType?: unknown }).monsterType ?? "");
      const monsterSubType = String((ev as { monsterSubType?: unknown }).monsterSubType ?? "");
      const flags = objectiveFlags(monsterType, monsterSubType);
      const stolen = Boolean((ev as { stolen?: unknown }).stolen);
      applyElite(killerId, assistingIds, flags, stolen);

      const involved = killerId === pid || assistingIds.includes(pid);
      const oppInvolved = killerId === oid || assistingIds.includes(oid);
      if (involved && killerId === pid) inc(out, "sum_kill_on_objective");
      if (involved && killerId !== pid) inc(out, "sum_kill_on_objective");
      if (oppInvolved && killerId === oid) inc(out, "sum_kill_on_objective_by_opponent");
      if (oppInvolved && killerId !== oid) inc(out, "sum_kill_on_objective_by_opponent");
    }

    if (evType === "CHAMPION_KILL" && ti(ev.timestamp) < U15_MS) {
      const killerId = ti((ev as { killerId?: unknown }).killerId);
      const victimId = ti((ev as { victimId?: unknown }).victimId);
      const nearObjective = Boolean((ev as { afterObjective?: unknown }).afterObjective);
      if (nearObjective && victimId === pid) inc(out, "sum_death_on_objective");
      if (nearObjective && victimId === oid) inc(out, "sum_death_on_objective_by_opponent");
      if (nearObjective && killerId === pid) inc(out, "sum_kill_on_objective");
      if (nearObjective && killerId === oid) inc(out, "sum_kill_on_objective_by_opponent");
    }
  }

  inc(out, "sum_objective_stolen", ti(input.participant.challenges?.epicMonsterSteals));
  inc(out, "sum_objective_stolen_by_opponent", ti(input.opponent.challenges?.epicMonsterSteals));

  return out;
}
