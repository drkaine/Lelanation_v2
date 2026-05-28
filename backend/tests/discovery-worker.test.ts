import { describe, expect, test } from "vitest";
import { isNewlyAddedPlayer } from "../src/workers/discovery.worker.js";

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
