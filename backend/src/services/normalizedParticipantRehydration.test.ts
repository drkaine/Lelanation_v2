import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyNormalizedBooleanChallenges,
  applyNormalizedBucketMetrics,
  applyNormalizedLaneMetrics,
  buildU15FromNormalizedRow,
} from "./normalizedParticipantRehydration.js";

test("applyNormalizedBooleanChallenges maps perfect_game to sum_perfect_game", () => {
  const dto: Record<string, unknown> = {};
  applyNormalizedBooleanChallenges(dto, { perfect_game: true });
  assert.equal(dto.sum_perfect_game, 1);
});

test("applyNormalizedLaneMetrics maps stored lane events", () => {
  const dto: Record<string, unknown> = {};
  applyNormalizedLaneMetrics(
    dto,
    { kill_by_dive: 2, death_by_gank: 1, kill_on_objective: 3 },
    { kill_by_dive: 1, death_by_gank: 4, kill_on_objective: 0 },
    6,
  );
  assert.equal(dto.sum_kill_by_dive, 2);
  assert.equal(dto.sum_death_by_gank, 1);
  assert.equal(dto.sum_kill_on_objective, 3);
  assert.equal(dto.sum_kill_by_dive_by_opponent, 1);
  assert.equal(dto.sum_death_by_gank_by_opponent, 4);
});

test("applyNormalizedBucketMetrics derives kd diff from buckets", () => {
  const dto: Record<string, unknown> = {};
  applyNormalizedBucketMetrics(
    dto,
    {
      kill_buckets: [1, 3, 5, 7],
      death_buckets: [0, 1, 2, 4],
      gold_buckets: [1000, 2500, 4000],
    },
    1800,
  );
  assert.equal(dto.sum_kd_diff_10, 2);
  assert.equal(dto.sum_kd_diff_20, 3);
  assert.equal(dto.sum_game_length, 1800);
});

test("buildU15FromNormalizedRow uses buckets and histories", () => {
  const u15 = buildU15FromNormalizedRow(
    {
      gold_buckets: [0, 0, 3200],
      cs_buckets: [0, 0, 88],
      physical_damage_buckets: [0, 0, 1200],
      magic_damage_buckets: [0, 0, 800],
      true_damage_buckets: [0, 0, 50],
      vision_score: 11,
      effective_heal_and_shielding: 400,
      kill_history: [{ kill_who: 6, timestamp_ms: 240_000 }],
      death_history: [{ death_by: 6, timestamp_ms: 360_000 }],
      assist_history: [{ assist_who: 2, timestamp_ms: 300_000 }],
    },
    6,
  );
  assert.equal(u15.goldEarned, 3200);
  assert.equal(u15.cs, 88);
  assert.equal(u15.kills, 1);
  assert.equal(u15.physDmgToChampion, 1200);
});
