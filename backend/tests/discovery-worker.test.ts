import { describe, expect, test } from "vitest";
import {
  isNewlyAddedPlayer,
  resolveDiscoveryStartTimeSec,
  shouldPauseDiscoveryForRankGateDrain,
} from "../src/workers/discovery.worker.js";

describe("resolveDiscoveryStartTimeSec", () => {
  const nowSec = Math.floor(new Date("2026-05-28T14:30:00.000Z").getTime() / 1000);
  const windowStartSec = nowSec - 24 * 60 * 60;
  const dayStartSec = Math.floor(new Date("2026-05-28T00:00:00.000Z").getTime() / 1000);

  test("uses window start when last_seen is null", () => {
    expect(resolveDiscoveryStartTimeSec(null, windowStartSec, nowSec)).toBe(windowStartSec);
  });

  test("widens to start of UTC day when last_seen is today (fin de cycle)", () => {
    const lastSeenToday = Math.floor(new Date("2026-05-28T14:29:00.000Z").getTime() / 1000);
    expect(resolveDiscoveryStartTimeSec(lastSeenToday, windowStartSec, nowSec)).toBe(dayStartSec);
  });

  test("uses last_seen when it is on a previous UTC day", () => {
    const lastSeenYesterday = Math.floor(new Date("2026-05-27T22:00:00.000Z").getTime() / 1000);
    expect(resolveDiscoveryStartTimeSec(lastSeenYesterday, windowStartSec, nowSec)).toBe(
      lastSeenYesterday,
    );
  });
});

describe("shouldPauseDiscoveryForRankGateDrain", () => {
  test("pauses when hydration waiting backlog is high", () => {
    expect(shouldPauseDiscoveryForRankGateDrain(25, 0)).toBe(true);
  });

  test("pauses when hydration delayed rank-gate jobs accumulate", () => {
    expect(shouldPauseDiscoveryForRankGateDrain(5, 20)).toBe(true);
  });

  test("does not pause when queues are calm", () => {
    expect(shouldPauseDiscoveryForRankGateDrain(10, 5)).toBe(false);
  });
});

describe("isNewlyAddedPlayer", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  test("returns true when created_at is today (UTC)", () => {
    expect(isNewlyAddedPlayer({ created_at: new Date("2026-05-28T08:30:00.000Z") }, now)).toBe(true);
  });

  test("returns false when created_at is before today", () => {
    expect(isNewlyAddedPlayer({ created_at: new Date("2026-05-27T23:59:59.000Z") }, now)).toBe(false);
  });

  test("returns false for invalid created_at", () => {
    expect(isNewlyAddedPlayer({ created_at: "not-a-date" }, now)).toBe(false);
  });
});
