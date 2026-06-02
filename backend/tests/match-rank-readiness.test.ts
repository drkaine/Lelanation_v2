import { describe, expect, test } from "vitest";
import type { ParsedParticipantDto } from "../src/dto/match.dto.js";
import type { RankSnapshot } from "../src/db/query.js";
import {
  applyMatchRankFallbackToParticipants,
  averageMatchRankTierLabel,
  closestSnapshotsFromParticipants,
  effectiveParticipantRankTier,
  getMissingRankParticipants,
  matchReadyForAggregation,
  participantRankKnown,
} from "../src/workers/match-rank-readiness.js";

function participant(puuid: string, overrides: Partial<ParsedParticipantDto> = {}): ParsedParticipantDto {
  return {
    matchId: "EUW1_1",
    puuid,
    patch: "15.10",
    gameDate: "2025-05-19",
    gameEndTimestamp: 0,
    region: "euw1",
    rankTier: "GOLD",
    needsRankFetch: false,
    role: "MID",
    championId: 1,
    teamId: 100,
    win: true,
    firstBloodKill: false,
    firstBloodAssist: false,
    firstTowerKill: false,
    firstTowerAssist: false,
    gameEndedInEarlySurrender: false,
    gameEndedInSurrender: false,
    teamEarlySurrendered: false,
    kills: 0,
    deaths: 0,
    assists: 0,
    goldEarned: 0,
    goldSpent: 0,
    opponentChampionId: 2,
    opponentRole: "MID",
    ...overrides,
  } as ParsedParticipantDto;
}

function snapshot(puuid: string, rankTier: string): [string, RankSnapshot] {
  return [
    puuid,
    {
      rankTier,
      rankDivision: "II",
      rankLp: 50,
      date: new Date("2025-05-20"),
    },
  ];
}

describe("match-rank-readiness", () => {
  test("participantRankKnown uses closestSnapshots only", () => {
    const snapshots = new Map([snapshot("a", "GOLD")]);
    expect(participantRankKnown(participant("a", { rankTier: "PLATINUM" }), snapshots)).toBe(true);
    expect(participantRankKnown(participant("b"), snapshots)).toBe(false);
  });

  test("averageMatchRankTierLabel reads snapshot tiers not match JSON", () => {
    const participants = [
      participant("a", { rankTier: "IRON" }),
      participant("b", { rankTier: "IRON" }),
    ];
    const snapshots = new Map([
      snapshot("a", "GOLD"),
      snapshot("b", "PLATINUM"),
    ]);
    expect(averageMatchRankTierLabel(participants, snapshots)).toBe("PLATINUM");
  });

  test("matchReadyForAggregation requires all snapshots and one ranked tier", () => {
    const participants = [participant("a"), participant("b", { rankTier: "UNRANKED" })];
    const allRanked = new Map([snapshot("a", "GOLD"), snapshot("b", "SILVER")]);
    const withUnranked = new Map([snapshot("a", "GOLD"), snapshot("b", "UNRANKED")]);
    const allUnranked = new Map([snapshot("a", "UNRANKED"), snapshot("b", "UNRANKED")]);
    const missing = new Map([snapshot("a", "GOLD")]);

    expect(matchReadyForAggregation(participants, allRanked)).toBe(true);
    expect(matchReadyForAggregation(participants, withUnranked)).toBe(true);
    expect(matchReadyForAggregation(participants, allUnranked)).toBe(false);
    expect(matchReadyForAggregation(participants, missing)).toBe(false);
  });

  test("matchReadyForAggregation falls back to averageMatchRankTierLabel UNRANKED for materialize", () => {
    const participants = [participant("a"), participant("b")];
    const allUnranked = new Map([snapshot("a", "UNRANKED"), snapshot("b", "UNRANKED")]);
    expect(averageMatchRankTierLabel(participants, allUnranked)).toBe("UNRANKED");
    expect(matchReadyForAggregation(participants, allUnranked)).toBe(false);
  });

  test("getMissingRankParticipants lists unknown puuids", () => {
    const participants = [participant("a"), participant("b")];
    const snapshots = new Map([snapshot("a", "GOLD")]);
    expect(getMissingRankParticipants(participants, snapshots)).toHaveLength(1);
    expect(getMissingRankParticipants(participants, snapshots)[0]?.puuid).toBe("b");
  });

  test("matchReadyForAggregation accepts match-level rank when snapshots are all UNRANKED", () => {
    const participants = [participant("a"), participant("b", { rankTier: "UNRANKED" })];
    const allUnranked = new Map([snapshot("a", "UNRANKED"), snapshot("b", "UNRANKED")]);
    expect(matchReadyForAggregation(participants, allUnranked)).toBe(false);
    expect(matchReadyForAggregation(participants, allUnranked, "GOLD")).toBe(true);
  });

  test("applyMatchRankFallbackToParticipants fills unknown players", () => {
    const participants = [
      participant("a", { rankTier: "PLATINUM", rankTierValue: "PLATINUM" }),
      participant("b", { rankTier: "UNRANKED", rankTierValue: "UNRANKED" }),
    ];
    applyMatchRankFallbackToParticipants(participants, "GOLD");
    expect(effectiveParticipantRankTier(participants[0], "GOLD")).toBe("PLATINUM");
    expect(effectiveParticipantRankTier(participants[1], "GOLD")).toBe("GOLD");
  });

  test("closestSnapshotsFromParticipants skips needsRankFetch", () => {
    const participants = [
      participant("a", { rankTier: "GOLD", rankTierValue: "GOLD" }),
      participant("b", { needsRankFetch: true }),
    ];
    const map = closestSnapshotsFromParticipants(participants);
    expect(map.has("a")).toBe(true);
    expect(map.has("b")).toBe(false);
  });
});
