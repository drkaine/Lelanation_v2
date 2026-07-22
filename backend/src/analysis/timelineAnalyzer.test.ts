import assert from "node:assert/strict";
import { test } from "node:test";
import { processTimeline } from "./timelineAnalyzer.js";
import type { ParticipantMeta } from "../types/eventClassifier.js";
import type { RiotTimeline } from "../types/timeline.js";

function meta(
  participantId: number,
  teamId: 100 | 200,
  teamPosition: ParticipantMeta["teamPosition"],
): ParticipantMeta {
  return { participantId, teamId, teamPosition, championId: participantId * 10 };
}

function emptyTimeline(events: RiotTimeline["info"]["frames"][number]["events"]): RiotTimeline {
  return {
    metadata: { matchId: "EUW1_test" },
    info: {
      frameInterval: 60_000,
      frames: [
        {
          timestamp: 0,
          participantFrames: {},
          events,
        },
      ],
    },
  };
}

test("processTimeline counts elite monster involvement as kill_on_objective", () => {
  const participants = [
    meta(1, 100, "JUNGLE"),
    meta(2, 100, "MIDDLE"),
    meta(6, 200, "JUNGLE"),
  ];
  const timeline = emptyTimeline([
    {
      type: "ELITE_MONSTER_KILL",
      timestamp: 600_000,
      killerId: 1,
      assistingParticipantIds: [2],
    },
  ]);

  const counts = processTimeline(timeline, participants);
  const byId = new Map(counts.map((row) => [row.participantId, row]));

  assert.equal(byId.get(1)?.killOnObjective, 1);
  assert.equal(byId.get(2)?.killOnObjective, 1);
  assert.equal(byId.get(6)?.killOnObjective, 0);
});

test("processTimeline counts afterObjective champion kills before 15 min", () => {
  const participants = [
    meta(1, 100, "JUNGLE"),
    meta(6, 200, "BOTTOM"),
  ];
  const timeline = emptyTimeline([
    {
      type: "CHAMPION_KILL",
      timestamp: 600_000,
      killerId: 1,
      victimId: 6,
      assistingParticipantIds: [],
      afterObjective: true,
      position: { x: 5000, y: 5000 },
    },
  ]);

  const counts = processTimeline(timeline, participants);
  const byId = new Map(counts.map((row) => [row.participantId, row]));

  assert.equal(byId.get(1)?.killOnObjective, 1);
  assert.equal(byId.get(6)?.deathOnObjective, 1);
});

test("processTimeline ignores afterObjective kills after 15 min", () => {
  const participants = [meta(1, 100, "JUNGLE"), meta(6, 200, "BOTTOM")];
  const timeline = emptyTimeline([
    {
      type: "CHAMPION_KILL",
      timestamp: 960_000,
      killerId: 1,
      victimId: 6,
      assistingParticipantIds: [],
      afterObjective: true,
      position: { x: 5000, y: 5000 },
    },
  ]);

  const counts = processTimeline(timeline, participants);
  const byId = new Map(counts.map((row) => [row.participantId, row]));

  assert.equal(byId.get(1)?.killOnObjective, 0);
  assert.equal(byId.get(6)?.deathOnObjective, 0);
});
