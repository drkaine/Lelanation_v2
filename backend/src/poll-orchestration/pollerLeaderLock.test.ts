import { test } from "node:test";
import assert from "node:assert/strict";
import { isLeaderProcessAlive } from "./pollerLeaderLock.js";

test("isLeaderProcessAlive: false for empty or invalid pid", () => {
  assert.equal(isLeaderProcessAlive(null), false);
  assert.equal(isLeaderProcessAlive(""), false);
  assert.equal(isLeaderProcessAlive("abc"), false);
  assert.equal(isLeaderProcessAlive("-1"), false);
});

test("isLeaderProcessAlive: true for current process", () => {
  assert.equal(isLeaderProcessAlive(String(process.pid)), true);
});

test("isLeaderProcessAlive: false for dead pid", () => {
  assert.equal(isLeaderProcessAlive("999999999"), false);
});
