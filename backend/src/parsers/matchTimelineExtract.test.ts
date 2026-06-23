import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { extractParticipantTimelineData } from "./matchTimelineExtract.js";
import type { MatchTimelineDto } from "../riot/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleTimeline = JSON.parse(
  readFileSync(join(__dirname, "../../data/api-riot/timeline.json"), "utf8"),
) as { info: MatchTimelineDto["info"] };

function timelineWithWards(): MatchTimelineDto {
  return {
    info: {
      frameInterval: 60_000,
      frames: [
        {
          timestamp: 0,
          events: [
            { type: "WARD_PLACED", timestamp: 30_000, creatorId: 1, wardType: "YELLOW_TRINKET" },
            { type: "WARD_KILL", timestamp: 120_000, killerId: 1, wardType: "YELLOW_TRINKET" },
          ],
          participantFrames: {
            "1": {
              participantId: 1,
              totalGold: 500,
              currentGold: 100,
              minionsKilled: 0,
              jungleMinionsKilled: 0,
              level: 1,
              xp: 0,
              timeEnemySpentControlled: 0,
              damageStats: { totalDamageDone: 0, totalDamageDoneToChampions: 0 },
            },
          },
        },
        {
          timestamp: 300_000,
          events: [
            { type: "WARD_PLACED", timestamp: 240_000, creatorId: 1, wardType: "CONTROL_WARD" },
          ],
          participantFrames: {
            "1": {
              participantId: 1,
              totalGold: 2500,
              currentGold: 500,
              minionsKilled: 30,
              jungleMinionsKilled: 0,
              level: 5,
              xp: 2000,
              timeEnemySpentControlled: 45_000,
              damageStats: {
                totalDamageDone: 5000,
                totalDamageDoneToChampions: 1000,
                physicalDamageDoneToChampions: 1000,
              },
            },
          },
        },
        {
          timestamp: 600_000,
          events: [],
          participantFrames: {
            "1": {
              participantId: 1,
              totalGold: 5000,
              currentGold: 800,
              minionsKilled: 60,
              jungleMinionsKilled: 0,
              level: 8,
              xp: 4000,
              timeEnemySpentControlled: 90_000,
              damageStats: {
                totalDamageDone: 9000,
                totalDamageDoneToChampions: 2000,
                physicalDamageDoneToChampions: 2000,
              },
            },
          },
        },
      ],
    },
  };
}

test("extractParticipantTimelineData fills ward buckets and histories per window", () => {
  const data = extractParticipantTimelineData(timelineWithWards(), 1, 600);
  assert.deepEqual(data.buckets.goldBuckets, [2500, 5000]);
  assert.deepEqual(data.buckets.physicalDamageBuckets, [1000, 2000]);
  assert.deepEqual(data.buckets.wardPlacedBuckets, [2, 0]);
  assert.deepEqual(data.buckets.wardKilledBuckets, [1, 0]);
  assert.deepEqual(data.buckets.ccTimeBuckets, [45, 45]);
  assert.deepEqual(data.buckets.goldSpentBuckets, [2000, 2200]);
  assert.deepEqual(data.buckets.objectiveDamageBuckets, [4000, 3000]);
  assert.equal(data.wardHistory.length, 2);
  assert.equal(data.wardHistory[0]?.ward_type, "YELLOW_TRINKET");
  assert.equal(data.wardKilledHistory.length, 1);
  assert.equal(data.wardKilledHistory[0]?.ward_type, "YELLOW_TRINKET");
});

test("extractParticipantTimelineData on real timeline sample has non-zero analytics buckets", () => {
  const timeline: MatchTimelineDto = { info: sampleTimeline.info };
  const data = extractParticipantTimelineData(timeline, 3, 1800);
  assert.ok(data.buckets.ccTimeBuckets.some((v) => v > 0), "cc_time_buckets");
  assert.ok(data.buckets.wardPlacedBuckets.some((v) => v > 0), "ward_placed_buckets");
  assert.ok(data.buckets.goldSpentBuckets.some((v) => v > 0), "gold_spent_buckets");
  assert.ok(data.buckets.objectiveDamageBuckets.some((v) => v > 0), "objective_damage_buckets");
});
