import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { nearestNeutralCamp } from "../constants/mapSpatial.js";
import {
  eliteMonsterCampClears,
  inferNeutralJungleCampClears,
  mergeJungleCampHistory,
} from "./jungleCampInfer.js";
import { extractParticipantTimelineData } from "./matchTimelineExtract.js";
import { extractJunglePath } from "./junglePathExtract.js";
import type { MatchTimelineDto } from "../riot/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleTimeline = JSON.parse(
  readFileSync(join(__dirname, "../../data/api-riot/timeline.json"), "utf8"),
) as { info: MatchTimelineDto["info"] };

test("nearestNeutralCamp maps jungle positions to camp types", () => {
  assert.equal(nearestNeutralCamp(2485, 8359), "gromp");
  assert.equal(nearestNeutralCamp(6700, 2900), "raptors");
});

test("inferNeutralJungleCampClears detects neutral camps from frame deltas", () => {
  const camps = inferNeutralJungleCampClears(sampleTimeline.info.frames, 2);
  const types = new Set(camps.map((c) => c.camp_type));
  assert.ok(types.has("gromp"), `expected gromp, got ${[...types].join(",")}`);
  assert.ok(types.has("raptors") || types.has("krugs") || types.has("wolves"));
  assert.equal(camps.filter((c) => c.camp_type === "dragon").length, 0);
});

test("mergeJungleCampHistory combines neutral clears and elite monsters", () => {
  const events = sampleTimeline.info.frames.flatMap((f) => f.events ?? []);
  const merged = mergeJungleCampHistory(
    inferNeutralJungleCampClears(sampleTimeline.info.frames, 2),
    eliteMonsterCampClears(events, 2),
  );
  const types = new Set(merged.map((c) => c.camp_type));
  assert.ok(types.has("gromp"));
  assert.ok(types.has("dragon"));
});

test("extractParticipantTimelineData includes neutral jungle camps for jungler", () => {
  const data = extractParticipantTimelineData({ info: sampleTimeline.info }, 2, 1800);
  const types = new Set(data.jungleCampHistory.map((c) => c.camp_type));
  assert.ok(types.has("gromp"));
  assert.ok(types.has("dragon"));
});

test("extractJunglePath builds early neutral path from timeline-derived camp history", () => {
  const data = extractParticipantTimelineData({ info: sampleTimeline.info }, 2, 1800);
  const path = extractJunglePath(data.jungleCampHistory);
  assert.ok(path, "expected non-null jungle path");
  assert.ok(path!.pathSequence.includes("gromp"));
  assert.ok(!path!.pathSequence.includes("dragon"));
  assert.ok((path!.clearTimeMs ?? 0) < 360_000);
});
