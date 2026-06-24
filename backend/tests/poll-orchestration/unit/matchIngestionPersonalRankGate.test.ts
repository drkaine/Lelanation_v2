import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ParsedParticipantDto } from "../../../src/dto/match.dto.js";
import type { RankSnapshot } from "../../../src/db/query.js";
import {
  shouldEnqueueParticipantRankFetch,
} from "../../../src/services/matchIngestionPayload.js";
import {
  getMissingRankParticipants,
  matchReadyForAggregation,
} from "../../../src/workers/match-rank-readiness.js";

vi.mock("../../../src/riot-gateway/config/riotConfig.js", () => ({
  riotConfig: { apiKeyType: "personal" },
}));

function participant(puuid: string): ParsedParticipantDto {
  return {
    matchId: "EUW1_1",
    puuid,
    patch: "16.12",
    gameDate: "2026-06-24",
    gameEndTimestamp: 0,
    gameDurationSec: 1200,
    region: "euw1",
    rankTier: "UNRANKED",
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
  } as ParsedParticipantDto;
}

function snapshot(puuid: string, rankTier: string): [string, RankSnapshot] {
  return [
    puuid,
    {
      rankTier,
      rankDivision: "II",
      rankLp: 50,
      date: new Date("2026-06-24"),
    },
  ];
}

describe("personal rank gate policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shouldEnqueueParticipantRankFetch is false on personal key", () => {
    expect(shouldEnqueueParticipantRankFetch(true)).toBe(false);
    expect(shouldEnqueueParticipantRankFetch(false)).toBe(false);
  });

  test("materialized UNRANKED + match GOLD tier passes readiness", () => {
    const participants = [participant("a"), participant("b")];
    const closest = new Map([snapshot("a", "GOLD")]);
    expect(getMissingRankParticipants(participants, closest)).toHaveLength(1);

    closest.set("b", {
      rankTier: "UNRANKED",
      rankDivision: "UNRANKED",
      rankLp: 0,
      date: new Date("2026-06-24"),
    });
    expect(matchReadyForAggregation(participants, closest, "GOLD")).toBe(true);
  });
});
