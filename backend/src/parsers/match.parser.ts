import { CHAMPION_STATS_METRIC_COLUMN_SET } from "../constants/championStatsMetricColumns.js";
import type { ParsedItemDto, ParsedParticipantDto } from "../dto/match.dto.js";
import { mapChampionStatsRiotMetrics } from "./champion-stats-riot-metrics.js";
import { timelineChampionObjectiveMetrics } from "./champion-stats-timeline-objectives.js";
import type {
  ChallengesDto,
  MatchDto,
  MatchTimelineDto,
  MatchTimelineEventDto,
  MatchTimelineFrameDto,
  MatchTimelineParticipantFrameDto,
  ParticipantDto,
} from "../riot/types.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { isBootsTier2Or3ItemId } from "./bootItemClassification.js";
import { isLegendaryCompleteItem } from "./itemLegendaryClassification.js";
import { isStarterPurchase } from "./starterItemClassification.js";
const U15_WINDOW_MS = 900_000;

function extractPatchFromVersion(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) {
    return "";
  }
  return `${major}.${minor}`;
}

function mapRole(teamPosition: string | undefined): "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | "UNKNOWN" {
  const position = (teamPosition ?? "").trim().toUpperCase();
  if (position === "TOP") return "TOP";
  if (position.startsWith("JUNGLE")) return "JUNGLE";
  if (position === "MIDDLE" || position === "MID") return "MID";
  if (position === "BOTTOM" || position === "ADC") return "ADC";
  if (position === "UTILITY" || position === "SUPPORT") return "SUPPORT";
  return "UNKNOWN";
}

function serializeItemSet(items: number[]): string {
  const unique = new Set<number>();
  for (const id of items) {
    if (!Number.isFinite(id) || id <= 0) continue;
    unique.add(id);
  }
  return Array.from(unique)
    .sort((a, b) => a - b)
    .join("_");
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();
}

function computeSpellOrder(events: MatchTimelineEventDto[], participantId: number): string {
  const sequence = events
    .filter((event) => event.type === "SKILL_LEVEL_UP" && event.participantId === participantId)
    .map((event) => {
      const skill = event.skillSlot;
      if (skill === 1 || skill === 2 || skill === 3 || skill === 4) {
        return String(skill);
      }
      return "";
    })
    .filter((value) => value.length > 0);
  return sequence.join("-");
}

/** Somme des timestamps (ms) des montées de niveau Q/W/E/R — aligné sur le filtre de `computeSpellOrder`. */
function computeSpellLevelUpTimestampSumMs(events: MatchTimelineEventDto[], participantId: number): number {
  const pid = truncateMetric(participantId);
  if (pid <= 0) return 0;
  let sum = 0;
  for (const event of events) {
    if (event.type !== "SKILL_LEVEL_UP" || truncateMetric(event.participantId) !== pid) continue;
    const skill = event.skillSlot;
    if (skill !== 1 && skill !== 2 && skill !== 3 && skill !== 4) continue;
    const ts = truncateMetric((event as { timestamp?: unknown }).timestamp);
    if (ts > 0) sum += ts;
  }
  return sum;
}

function computeU15(
  frames: MatchTimelineFrameDto[],
  events: MatchTimelineEventDto[],
  participant: ParticipantDto,
): ParsedParticipantDto["u15"] {
  const participantFrameSnapshots = frames
    .filter((frame) => frame.timestamp < U15_WINDOW_MS)
    .map((frame) => frame.participantFrames[String(participant.participantId)])
    .filter((frame) => Boolean(frame));

  const latestFrame = participantFrameSnapshots.at(-1);
  const damageStats = latestFrame?.damageStats ?? {};

  let kills = 0;
  let deaths = 0;
  let assists = 0;
  for (const event of events) {
    if (event.type !== "CHAMPION_KILL" || event.timestamp >= U15_WINDOW_MS) {
      continue;
    }
    if (event.killerId === participant.participantId) kills += 1;
    if (event.victimId === participant.participantId) deaths += 1;
    if ((event.assistingParticipantIds ?? []).includes(participant.participantId)) assists += 1;
  }

  const physical = Number(damageStats.physicalDamageDoneToChampions ?? damageStats.physicalDamageDealtToChampions ?? 0);
  const magic = Number(damageStats.magicDamageDoneToChampions ?? damageStats.magicDamageDealtToChampions ?? 0);
  const trueDamage = Number(damageStats.trueDamageDoneToChampions ?? damageStats.trueDamageDealtToChampions ?? 0);
  const cs = Number(latestFrame?.minionsKilled ?? 0) + Number(latestFrame?.jungleMinionsKilled ?? 0);

  return {
    goldEarned: Number(latestFrame?.totalGold ?? 0),
    cs,
    kills,
    deaths,
    assists,
    visionScore: Number(participant.visionScore ?? 0),
    physDmgToChampion: Number.isFinite(physical) ? physical : 0,
    magicDmgToChampion: Number.isFinite(magic) ? magic : 0,
    trueDmgToChampion: Number.isFinite(trueDamage) ? trueDamage : 0,
    shieldAndHeal: Number((participant.challenges?.effectiveHealAndShielding ?? 0) as number),
  };
}

function getEvents(timeline: MatchTimelineDto): MatchTimelineEventDto[] {
  const events: MatchTimelineEventDto[] = [];
  for (const frame of timeline.info.frames ?? []) {
    for (const event of frame.events ?? []) {
      events.push(event);
    }
  }
  return events;
}

function getPurchaseItems(events: MatchTimelineEventDto[], participantId: number, win: boolean): ParsedItemDto[] {
  return events
    .filter((event) => event.type === "ITEM_PURCHASED" && event.participantId === participantId)
    .map((event) => {
      const timestampMs = Number(event.timestamp ?? 0);
      const phase: ParsedItemDto["phase"] = isStarterPurchase(timestampMs, Number(event.itemId ?? 0))
        ? "starter"
        : "core";
      return {
        itemId: Number(event.itemId ?? 0),
        phase,
        timestampMs,
        win,
      };
    })
    .filter((item) => item.itemId > 0);
}

function classifyPurchasePhases(items: ParsedItemDto[], finalInventorySet: ReadonlySet<number>): ParsedItemDto[] {
  const sorted = [...items].sort((a, b) => {
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    return a.itemId - b.itemId;
  });
  let legendaryCompletedCount = 0;
  const seenLegendary = new Set<number>();
  return sorted.map((item) => {
    const starter = isStarterPurchase(item.timestampMs, item.itemId);
    let phase: ParsedItemDto["phase"];
    if (starter) phase = "starter";
    else phase = legendaryCompletedCount < 3 ? "core" : "final";

    if (!starter && isLegendaryCompleteItem(item.itemId, finalInventorySet) && !seenLegendary.has(item.itemId)) {
      seenLegendary.add(item.itemId);
      legendaryCompletedCount += 1;
    }
    return { ...item, phase };
  });
}

/** Bottes T2/T3 en fin de partie sans événement ITEM_PURCHASED (upgrade sur place). */
function mergeFinalBootItemsIntoPurchases(
  phasedPurchases: ParsedItemDto[],
  finalIds: number[],
  firstPurchaseTsByItem: Map<number, number>,
  win: boolean,
): ParsedItemDto[] {
  const purchasedIds = new Set(phasedPurchases.map((p) => p.itemId));
  const extras: ParsedItemDto[] = [];
  for (const itemId of finalIds) {
    if (!isBootsTier2Or3ItemId(itemId)) continue;
    if (purchasedIds.has(itemId)) continue;
    extras.push({
      itemId,
      phase: "final",
      timestampMs: firstPurchaseTsByItem.get(itemId) ?? 0,
      win,
    });
  }
  if (extras.length === 0) return phasedPurchases;
  return [...phasedPurchases, ...extras];
}

/**
 * Clés challenges dont `toSnakeCase` ne reproduit pas le nom SQL (`*_10_*`, `*_x_*`, `*_20_*`).
 * Valeur = suffixe après `sum_` (aligné `champion_stats`).
 */
const CHALLENGE_SUM_SUFFIX_OVERRIDE: Record<string, string> = {
  jungleCsBefore10Minutes: "jungle_cs_before_10_minutes",
  outerTurretExecutesBefore10Minutes: "outer_turret_executes_before_10_minutes",
  takedownsFirstXMinutes: "takedowns_first_x_minutes",
  wardTakedownsBefore20M: "ward_takedowns_before_20_m",
};

function mapChallengeSums(challenges: ChallengesDto | undefined): Record<string, number> {
  if (!challenges) {
    return {};
  }

  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(challenges)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const isPercentLike =
      key.toLowerCase().includes("percentage") ||
      key === "killParticipation" ||
      key === "visionScoreAdvantageLaneOpponent";
    const normalized = isPercentLike ? Math.round(raw * 100) : raw;
    const suffix = CHALLENGE_SUM_SUFFIX_OVERRIDE[key] ?? toSnakeCase(key);
    const col = `sum_${suffix}`;
    if (!CHAMPION_STATS_METRIC_COLUMN_SET.has(col)) continue;
    out[col] = normalized;
  }
  return out;
}

function truncateMetric(value: unknown): number {
  const x = typeof value === "number" ? value : Number(value);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function getLastParticipantFrame(
  frames: MatchTimelineFrameDto[],
  participantId: number,
): MatchTimelineParticipantFrameDto | null {
  if (frames.length === 0) return null;
  const last = frames[frames.length - 1];
  const key = String(participantId);
  return last?.participantFrames?.[key] ?? null;
}

/**
 * K−D du participant à la clôture de la fenêtre [0, minute] (événements CHAMPION_KILL de la timeline),
 * aligné sur `extractParticipantKillDeathDiffAtMinutes` dans rawAggregateProcessor.
 */
function killDeathDiffAtMinutesForParticipant(
  frames: MatchTimelineFrameDto[],
  participant: ParticipantDto,
  minuteMarks: number[],
): Record<number, number> {
  const normalizedMarks = Array.from(new Set(minuteMarks.map((m) => Math.max(1, Math.trunc(m))))).sort(
    (a, b) => a - b,
  );
  const row: Record<number, number> = {};
  const participantId = truncateMetric(participant.participantId);
  if (normalizedMarks.length === 0) return row;

  if (!frames.length || participantId <= 0) {
    const kd = truncateMetric(participant.kills) - truncateMetric(participant.deaths);
    for (const minute of normalizedMarks) row[minute] = kd;
    return row;
  }

  let kills = 0;
  let deaths = 0;
  const pendingMarks = [...normalizedMarks];

  const pushSnapshot = (minute: number) => {
    row[minute] = kills - deaths;
  };

  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      const timestamp = truncateMetric((ev as { timestamp?: unknown }).timestamp);
      const evType = String((ev as { type?: unknown }).type ?? "")
        .trim()
        .toUpperCase();
      while (pendingMarks.length > 0 && timestamp > pendingMarks[0]! * 60_000) {
        const minute = pendingMarks.shift()!;
        pushSnapshot(minute);
      }
      if (evType !== "CHAMPION_KILL") continue;
      const killerId = truncateMetric((ev as { killerId?: unknown }).killerId);
      const victimId = truncateMetric((ev as { victimId?: unknown }).victimId);
      if (killerId > 0 && killerId === participantId) kills++;
      if (victimId > 0 && victimId === participantId) deaths++;
    }
  }
  while (pendingMarks.length > 0) {
    const minute = pendingMarks.shift()!;
    pushSnapshot(minute);
  }
  return row;
}

/**
 * Stats lues par `numericMetric` dans upsertChampionBucket : elles viennent du participant match-v5
 * et de la dernière frame timeline (or, mapChallengeSums ne fournit pas ces clés).
 */
function mapParticipantBucketIngestMetrics(
  participant: ParticipantDto,
  frames: MatchTimelineFrameDto[],
): Record<string, number> {
  const n = truncateMetric;
  const pid = n(participant.participantId);
  const last = getLastParticipantFrame(frames, pid);
  const kd = killDeathDiffAtMinutesForParticipant(frames, participant, [10, 20]);
  const timeEnemy =
    last != null && last.timeEnemySpentControlled != null
      ? n(last.timeEnemySpentControlled)
      : Math.max(n(participant.totalTimeCCDealt), n(participant.timeCCingOthers));

  return {
    sum_magic_damage_done: n(participant.magicDamageDealt),
    sum_magic_damage_done_to_champion: n(participant.magicDamageDealtToChampions),
    sum_magic_damage_taken: n(participant.magicDamageTaken),
    sum_physical_damage_done: n(participant.physicalDamageDealt),
    sum_physical_damage_done_to_champion: n(participant.physicalDamageDealtToChampions),
    sum_physical_damage_taken: n(participant.physicalDamageTaken),
    sum_true_damage_done: n(participant.trueDamageDealt),
    sum_true_damage_done_to_champion: n(participant.trueDamageDealtToChampions),
    sum_true_damage_taken: n(participant.trueDamageTaken),
    sum_jungle_minions_killed: last != null ? n(last.jungleMinionsKilled) : n(participant.neutralMinionsKilled),
    sum_level: n(participant.champLevel),
    sum_minions_killed: n(participant.totalMinionsKilled),
    sum_current_gold: last != null ? n(last.currentGold) : 0,
    sum_time_enemy_spent_controlled: timeEnemy,
    sum_kd_diff_10: kd[10] ?? 0,
    sum_kd_diff_20: kd[20] ?? 0,
  };
}

function getTeamParticipantsSortedById(match: MatchDto, teamId: 100 | 200): ParticipantDto[] {
  return (match.info.participants ?? [])
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => a.participantId - b.participantId);
}

/** IDs des champions bannis par cette équipe, dans l’ordre du draft (`pickTurn`). */
function getTeamBanChampionIdsSorted(match: MatchDto, teamId: 100 | 200): number[] {
  const team = (match.info.teams ?? []).find((value) => value.teamId === teamId);
  if (!team?.bans?.length) return [];
  return [...team.bans]
    .filter((b) => Number(b.championId) > 0)
    .sort((a, b) => a.pickTurn - b.pickTurn || Number(a.championId) - Number(b.championId))
    .map((b) => Number(b.championId));
}

function validateParticipantRequired(participant: ParticipantDto, matchId: string): boolean {
  if (!participant.puuid) return false;
  if (!participant.participantId) return false;
  if (!participant.championId) return false;
  if (participant.teamId !== 100 && participant.teamId !== 200) return false;
  if (!matchId) return false;
  return true;
}

export function parseMatch(
  match: MatchDto,
  timeline: MatchTimelineDto,
  patch: string,
  queueRegion?: string,
): Array<ParsedParticipantDto | null> {
  const participants = match.info.participants ?? [];
  const events = getEvents(timeline);
  const frames = timeline.info.frames ?? [];
  const resolvedPatch = extractPatchFromVersion(match.info.gameVersion) || patch;
  const matchId = match.metadata.matchId ?? "";
  const gameEndTimestamp =
    Number(match.info.gameEndTimestamp ?? 0) ||
    Number(match.info.gameStartTimestamp ?? 0) + Number(match.info.gameDuration ?? 0) * 1000;
  const gameStartTimestamp =
    Number(match.info.gameStartTimestamp ?? 0) || Number(match.info.gameCreation ?? 0);
  const gameDurationSec = Math.max(0, Math.trunc(Number(match.info.gameDuration ?? 0)));
  // Rank gate + agrégats : jour UTC de début de partie (pas gameEnd qui peut basculer J+1).
  const gameDate = new Date(
    gameStartTimestamp > 0 ? gameStartTimestamp : gameEndTimestamp,
  ).toISOString();
  const region = normalizePlatformRegion(String(match.info.platformId ?? queueRegion ?? "euw1"));

  const team100Sorted = getTeamParticipantsSortedById(match, 100);
  const team200Sorted = getTeamParticipantsSortedById(match, 200);
  const bans100 = getTeamBanChampionIdsSorted(match, 100);
  const bans200 = getTeamBanChampionIdsSorted(match, 200);

  return participants.map((participant) => {
    if (!validateParticipantRequired(participant, matchId)) {
      console.warn(`[match.parser] participant dropped for missing required fields in match ${matchId}`);
      return null;
    }

    const role = mapRole(participant.teamPosition);
    const opponent =
      participants.find((candidate) => candidate.teamId !== participant.teamId && mapRole(candidate.teamPosition) === role) ??
      null;

    const purchases = getPurchaseItems(events, participant.participantId, participant.win);
    const starterIds = purchases
      .filter((item) => isStarterPurchase(item.timestampMs, item.itemId))
      .map((item) => item.itemId);
    const finalIds = [
      Number(participant.item0 ?? 0),
      Number(participant.item1 ?? 0),
      Number(participant.item2 ?? 0),
      Number(participant.item3 ?? 0),
      Number(participant.item4 ?? 0),
      Number(participant.item5 ?? 0),
    ].filter((id) => id > 0);
    const finalInventorySet = new Set(finalIds);
    const firstPurchaseTsByItem = new Map<number, number>();
    for (const purchase of purchases) {
      const existing = firstPurchaseTsByItem.get(purchase.itemId);
      if (existing == null || purchase.timestampMs < existing) {
        firstPurchaseTsByItem.set(purchase.itemId, purchase.timestampMs);
      }
    }
    const phasedPurchases = mergeFinalBootItemsIntoPurchases(
      classifyPurchasePhases(purchases, finalInventorySet),
      finalIds,
      firstPurchaseTsByItem,
      participant.win,
    );
    const bootsIds = finalIds.filter((itemId) => isBootsTier2Or3ItemId(itemId));
    const uniqueFinalIdsByFirstPurchase = Array.from(new Set(finalIds)).sort((a, b) => {
      const ta = firstPurchaseTsByItem.get(a) ?? Number.MAX_SAFE_INTEGER;
      const tb = firstPurchaseTsByItem.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a - b;
    });
    const coreLegendaryIds = uniqueFinalIdsByFirstPurchase
      .filter((itemId) => isLegendaryCompleteItem(itemId, finalInventorySet))
      .slice(0, 3);
    const coreLegendarySet = new Set(coreLegendaryIds);
    const materialIds = uniqueFinalIdsByFirstPurchase.filter((itemId) => !coreLegendarySet.has(itemId));

    const tid = participant.teamId as 100 | 200;
    const sortedTeam = tid === 100 ? team100Sorted : team200Sorted;
    const teamBans = tid === 100 ? bans100 : bans200;
    const slotIdx = sortedTeam.findIndex((value) => value.participantId === participant.participantId);
    const pickOrder = Math.max(1, slotIdx + 1);
    const bannedChampionId = slotIdx >= 0 && slotIdx < teamBans.length ? teamBans[slotIdx]! : 0;

    const perkStyleIds = (participant.perks?.styles ?? []).flatMap((style) =>
      (style.selections ?? []).map((selection) => Number(selection.perk)),
    );
    const shardIds = [
      Number(participant.perks?.statPerks?.offense ?? 0),
      Number(participant.perks?.statPerks?.flex ?? 0),
      Number(participant.perks?.statPerks?.defense ?? 0),
    ].filter((value) => value > 0);
    const runeList = perkStyleIds.filter((value) => value > 0).join("_");
    const shardList = shardIds.join("_");
    const perks = [...perkStyleIds, ...shardIds].filter((value) => value > 0);

    const dto: ParsedParticipantDto = {
      matchId,
      puuid: participant.puuid,
      patch: resolvedPatch,
      gameDate,
      gameEndTimestamp,
      gameDurationSec,
      region,
      rankTier: String((participant as { tier?: string; rankTier?: string }).tier ?? (participant as { rankTier?: string }).rankTier ?? "UNRANKED"),
      needsRankFetch: false,
      role,
      championId: participant.championId,
      teamId: participant.teamId as 100 | 200,
      win: participant.win,
      firstBloodKill: participant.firstBloodKill === true,
      firstBloodAssist: participant.firstBloodAssist === true,
      firstTowerKill: participant.firstTowerKill === true,
      firstTowerAssist: participant.firstTowerAssist === true,
      gameEndedInEarlySurrender: participant.gameEndedInEarlySurrender === true,
      gameEndedInSurrender: participant.gameEndedInSurrender === true,
      teamEarlySurrendered: participant.teamEarlySurrendered === true,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      goldEarned: participant.goldEarned,
      goldSpent: participant.goldSpent,
      opponentChampionId: Number(opponent?.championId ?? 0),
      opponentRole: opponent ? mapRole(opponent.teamPosition) : "UNKNOWN",
      spellOrder: computeSpellOrder(events, participant.participantId),
      spellLevelUpTimestampSumMs: computeSpellLevelUpTimestampSumMs(events, participant.participantId),
      spell1Casts: Math.max(0, Math.trunc(Number(participant.spell1Casts ?? 0))),
      spell2Casts: Math.max(0, Math.trunc(Number(participant.spell2Casts ?? 0))),
      spell3Casts: Math.max(0, Math.trunc(Number(participant.spell3Casts ?? 0))),
      spell4Casts: Math.max(0, Math.trunc(Number(participant.spell4Casts ?? 0))),
      starterKey: serializeItemSet(starterIds),
      coreKey: serializeItemSet(coreLegendaryIds),
      materialKey: serializeItemSet(materialIds),
      bootsKey: serializeItemSet(bootsIds),
      finalKey: serializeItemSet(finalIds),
      items: phasedPurchases,
      runeList,
      shardList,
      perks,
      spellD: participant.summoner1Id,
      spellF: participant.summoner2Id,
      spellDCasts: participant.summoner1Casts,
      spellFCasts: participant.summoner2Casts,
      rankTierValue: String((participant as { tier?: string; rankTier?: string }).tier ?? (participant as { rankTier?: string }).rankTier ?? "UNRANKED"),
      rankDivision: String((participant as { rank?: string; rankDivision?: string }).rank ?? (participant as { rankDivision?: string }).rankDivision ?? ""),
      lp: Number((participant as { leaguePoints?: number; rankLp?: number }).leaguePoints ?? (participant as { rankLp?: number }).rankLp ?? 0),
      bannedChampionId,
      pickOrder,
      u15: computeU15(frames, events, participant),
      ...mapChallengeSums(participant.challenges),
      ...timelineChampionObjectiveMetrics(
        events,
        participant.participantId,
        participant.teamId as 100 | 200,
        participant.win === true,
      ),
      ...mapParticipantBucketIngestMetrics(participant, frames),
      ...mapChampionStatsRiotMetrics(participant),
    };

    return dto;
  });
}
