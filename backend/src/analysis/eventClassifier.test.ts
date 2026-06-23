import assert from "node:assert/strict";
import { test } from "node:test";
import { INITIAL_TOWERS } from "../constants/map.js";
import { isDive, isGank, isRoam } from "./eventClassifier.js";
import type { ParticipantMeta } from "../types/eventClassifier.js";
import type { ChampionKillEvent } from "../types/timeline.js";

const RED_BOT_OUTER = INITIAL_TOWERS.find(
  (t) => t.teamId === 200 && t.lane === "BOTTOM" && t.tier === "OUTER",
)!;
const BLUE_BOT_OUTER = INITIAL_TOWERS.find(
  (t) => t.teamId === 100 && t.lane === "BOTTOM" && t.tier === "OUTER",
)!;

function meta(
  participantId: number,
  teamId: 100 | 200,
  teamPosition: ParticipantMeta["teamPosition"],
): ParticipantMeta {
  return { participantId, teamId, teamPosition, championId: participantId * 10 };
}

function killEvent(
  partial: Partial<ChampionKillEvent> & Pick<ChampionKillEvent, "killerId" | "victimId" | "position">,
): ChampionKillEvent {
  return {
    type: "CHAMPION_KILL",
    timestamp: partial.timestamp ?? 600_000,
    assistingParticipantIds: partial.assistingParticipantIds ?? [],
    ...partial,
  };
}

test("isDive: kill under standing enemy tower", () => {
  const standing = [...INITIAL_TOWERS];
  const result = isDive(
    { x: RED_BOT_OUTER.x, y: RED_BOT_OUTER.y },
    200,
    standing,
  );
  assert.equal(result, true);
});

test("isDive: kill under already-destroyed enemy tower", () => {
  const standing = INITIAL_TOWERS.filter(
    (t) =>
      !(
        t.teamId === RED_BOT_OUTER.teamId &&
        Math.sqrt((t.x - RED_BOT_OUTER.x) ** 2 + (t.y - RED_BOT_OUTER.y) ** 2) < 500
      ),
  );
  const result = isDive(
    { x: RED_BOT_OUTER.x, y: RED_BOT_OUTER.y },
    200,
    standing,
  );
  assert.equal(result, false);
});

test("isDive: kill near allied tower (wrong team)", () => {
  const standing = [...INITIAL_TOWERS];
  const result = isDive(
    { x: BLUE_BOT_OUTER.x, y: BLUE_BOT_OUTER.y },
    200,
    standing,
  );
  assert.equal(result, false);
});

test("isDive: kill in lane with no tower nearby", () => {
  const standing = [...INITIAL_TOWERS];
  const result = isDive({ x: 7000, y: 7000 }, 200, standing);
  assert.equal(result, false);
});

test("isGank: jungler kills laner in lane, was in jungle 60s ago", () => {
  const participantMap = new Map<number, ParticipantMeta>([
    [2, meta(2, 100, "JUNGLE")],
    [3, meta(3, 100, "BOTTOM")],
    [7, meta(7, 200, "BOTTOM")],
  ]);
  const framesBefore = new Map<number, { x: number; y: number }>([[2, { x: 12000, y: 12000 }]]);
  const event = killEvent({
    killerId: 2,
    victimId: 7,
    position: { x: 10000, y: 2000 },
  });
  assert.equal(isGank(event, participantMap, 100, framesBefore), true);
});

test("isGank: jungler kills laner in lane, was already in lane 60s ago", () => {
  const participantMap = new Map<number, ParticipantMeta>([[2, meta(2, 100, "JUNGLE")]]);
  const framesBefore = new Map<number, { x: number; y: number }>([[2, { x: 10000, y: 2000 }]]);
  const event = killEvent({
    killerId: 2,
    victimId: 7,
    position: { x: 10000, y: 2000 },
  });
  assert.equal(isGank(event, participantMap, 100, framesBefore), false);
});

test("isGank: jungler assists laner kill in lane, was in jungle 60s ago", () => {
  const participantMap = new Map<number, ParticipantMeta>([
    [2, meta(2, 100, "JUNGLE")],
    [3, meta(3, 100, "BOTTOM")],
  ]);
  const framesBefore = new Map<number, { x: number; y: number }>([[2, { x: 12000, y: 12000 }]]);
  const event = killEvent({
    killerId: 3,
    victimId: 7,
    assistingParticipantIds: [2],
    position: { x: 10000, y: 2000 },
  });
  assert.equal(isGank(event, participantMap, 100, framesBefore), true);
});

test("isGank: 2v2 fight in lane, no jungler involved", () => {
  const participantMap = new Map<number, ParticipantMeta>([
    [3, meta(3, 100, "BOTTOM")],
    [4, meta(4, 100, "UTILITY")],
  ]);
  const framesBefore = new Map<number, { x: number; y: number }>();
  const event = killEvent({
    killerId: 3,
    victimId: 7,
    assistingParticipantIds: [4],
    position: { x: 10000, y: 2000 },
  });
  assert.equal(isGank(event, participantMap, 100, framesBefore), false);
});

test("isGank: jungler kills laner in jungle zone (invade)", () => {
  const participantMap = new Map<number, ParticipantMeta>([[2, meta(2, 100, "JUNGLE")]]);
  const framesBefore = new Map<number, { x: number; y: number }>([[2, { x: 12000, y: 12000 }]]);
  const event = killEvent({
    killerId: 2,
    victimId: 7,
    position: { x: 12000, y: 12000 },
  });
  assert.equal(isGank(event, participantMap, 100, framesBefore), false);
});

test("isRoam: mid laner kills bot laner in bot zone before 20min", () => {
  const killer = meta(3, 100, "MIDDLE");
  const event = killEvent({
    killerId: 3,
    victimId: 8,
    position: { x: 10000, y: 2000 },
    timestamp: 900_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), true);
});

test("isRoam: mid laner kills top laner in top zone before 20min", () => {
  const killer = meta(3, 100, "MIDDLE");
  const event = killEvent({
    killerId: 3,
    victimId: 6,
    position: { x: 2000, y: 12000 },
    timestamp: 900_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), true);
});

test("isRoam: mid laner kills in their own mid zone", () => {
  const killer = meta(3, 100, "MIDDLE");
  const event = killEvent({
    killerId: 3,
    victimId: 8,
    position: { x: 7500, y: 7500 },
    timestamp: 900_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), false);
});

test("isRoam: jungler kills anyone", () => {
  const killer = meta(2, 100, "JUNGLE");
  const event = killEvent({
    killerId: 2,
    victimId: 8,
    position: { x: 10000, y: 2000 },
    timestamp: 900_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), false);
});

test("isRoam: kill after 20 minutes", () => {
  const killer = meta(3, 100, "MIDDLE");
  const event = killEvent({
    killerId: 3,
    victimId: 8,
    position: { x: 10000, y: 2000 },
    timestamp: 1_300_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), false);
});

test("isRoam: kill in jungle zone", () => {
  const killer = meta(3, 100, "MIDDLE");
  const event = killEvent({
    killerId: 3,
    victimId: 8,
    position: { x: 2000, y: 2000 },
    timestamp: 900_000,
  });
  assert.equal(isRoam(event, killer, event.timestamp), false);
});
