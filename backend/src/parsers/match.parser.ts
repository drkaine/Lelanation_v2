import type { ParsedItemDto, ParsedParticipantDto } from "../dto/match.dto.js";
import type {
  ChallengesDto,
  MatchDto,
  MatchTimelineDto,
  MatchTimelineEventDto,
  MatchTimelineFrameDto,
  ParticipantDto,
} from "../riot/types.js";

const STARTER_WINDOW_MS = 120_000;
const U15_WINDOW_MS = 900_000;
const CONSUMABLE_IDS = new Set([2003, 2009, 2010, 2031, 2032, 2033, 2055, 2060]);
const BOOTS_IDS = new Set([1001, 3005, 3006, 3009, 3010, 3020, 3047, 3111, 3117, 3158]);

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
      const phase: ParsedItemDto["phase"] = timestampMs < STARTER_WINDOW_MS ? "starter" : "core";
      return {
        itemId: Number(event.itemId ?? 0),
        phase,
        timestampMs,
        win,
      };
    })
    .filter((item) => item.itemId > 0);
}

function isConsumableItem(itemId: number): boolean {
  return CONSUMABLE_IDS.has(itemId);
}

function isBootsItem(itemId: number): boolean {
  return BOOTS_IDS.has(itemId);
}

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
    out[`sum_${toSnakeCase(key)}`] = normalized;
  }
  return out;
}

function resolveBanByPickOrder(match: MatchDto, teamId: 100 | 200, pickOrder: number): number {
  const team = (match.info.teams ?? []).find((value) => value.teamId === teamId);
  if (!team) return 0;
  const ban = (team.bans ?? []).find((value) => value.pickTurn === pickOrder);
  return Number(ban?.championId ?? 0);
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
): Array<ParsedParticipantDto | null> {
  const participants = match.info.participants ?? [];
  const events = getEvents(timeline);
  const frames = timeline.info.frames ?? [];
  const resolvedPatch = extractPatchFromVersion(match.info.gameVersion) || patch;
  const matchId = match.metadata.matchId ?? "";
  const gameEndTimestamp =
    Number(match.info.gameEndTimestamp ?? 0) ||
    Number(match.info.gameStartTimestamp ?? 0) + Number(match.info.gameDuration ?? 0) * 1000;
  const gameDate = new Date(gameEndTimestamp).toISOString();
  const region = String(match.info.platformId ?? "unknown").toLowerCase();

  const teamParticipants = new Map<100 | 200, ParticipantDto[]>();
  for (const participant of participants) {
    const teamId = participant.teamId;
    if (teamId !== 100 && teamId !== 200) continue;
    const list = teamParticipants.get(teamId) ?? [];
    list.push(participant);
    teamParticipants.set(teamId, list);
  }
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
      .filter((item) => item.timestampMs < STARTER_WINDOW_MS)
      .map((item) => item.itemId);
    const finalIds = [
      Number(participant.item0 ?? 0),
      Number(participant.item1 ?? 0),
      Number(participant.item2 ?? 0),
      Number(participant.item3 ?? 0),
      Number(participant.item4 ?? 0),
      Number(participant.item5 ?? 0),
    ].filter((id) => id > 0);
    const bootsIds = finalIds.filter((itemId) => isBootsItem(itemId));
    const firstPurchaseTsByItem = new Map<number, number>();
    for (const purchase of purchases) {
      const existing = firstPurchaseTsByItem.get(purchase.itemId);
      if (existing == null || purchase.timestampMs < existing) {
        firstPurchaseTsByItem.set(purchase.itemId, purchase.timestampMs);
      }
    }
    const nonConsumableNonBootFinalIds = Array.from(
      new Set(finalIds.filter((itemId) => !isConsumableItem(itemId) && !isBootsItem(itemId))),
    ).sort((a, b) => {
      const ta = firstPurchaseTsByItem.get(a) ?? Number.MAX_SAFE_INTEGER;
      const tb = firstPurchaseTsByItem.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a - b;
    });
    const legendaryCountRaw = Number((participant.challenges?.legendaryCount ?? 3) as number);
    const legendaryCountSafe = Number.isFinite(legendaryCountRaw) ? Math.trunc(legendaryCountRaw) : 3;
    const legendaryCount = Math.max(0, Math.min(nonConsumableNonBootFinalIds.length, legendaryCountSafe));
    const coreLegendaryIds = nonConsumableNonBootFinalIds.slice(0, legendaryCount);
    const materialIds = nonConsumableNonBootFinalIds.slice(legendaryCount);
    const coreLegendarySet = new Set(coreLegendaryIds);

    const teamList = teamParticipants.get(participant.teamId as 100 | 200) ?? [];
    const pickOrder = Math.max(
      1,
      teamList.findIndex((value) => value.participantId === participant.participantId) + 1,
    );
    const bannedChampionId = resolveBanByPickOrder(match, participant.teamId as 100 | 200, pickOrder);

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
      region,
      rankTier: String((participant as { tier?: string; rankTier?: string }).tier ?? (participant as { rankTier?: string }).rankTier ?? "UNRANKED"),
      role,
      championId: participant.championId,
      teamId: participant.teamId as 100 | 200,
      win: participant.win,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      goldEarned: participant.goldEarned,
      goldSpent: participant.goldSpent,
      opponentChampionId: Number(opponent?.championId ?? 0),
      opponentRole: opponent ? mapRole(opponent.teamPosition) : "UNKNOWN",
      spellOrder: computeSpellOrder(events, participant.participantId),
      starterKey: serializeItemSet(starterIds),
      coreKey: serializeItemSet(coreLegendaryIds),
      materialKey: serializeItemSet(materialIds),
      bootsKey: serializeItemSet(bootsIds),
      finalKey: serializeItemSet(finalIds),
      items: purchases.map((item) => ({
        ...item,
        phase:
          item.timestampMs < STARTER_WINDOW_MS
            ? "starter"
            : coreLegendarySet.has(item.itemId)
              ? "core"
              : "final",
      })),
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
    };

    return dto;
  });
}
