import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getMatchAggregationPendingOrder } from "./matchAggregationPendingOrder.js";

const ENV_KEY = "MATCH_AGGREGATION_PENDING_ORDER";

afterEach(() => {
  delete process.env[ENV_KEY];
});

test("getMatchAggregationPendingOrder: newest_first by default", () => {
  delete process.env[ENV_KEY];
  assert.equal(getMatchAggregationPendingOrder(), "newest_first");
});

test("getMatchAggregationPendingOrder: oldest_first when explicitly set", () => {
  process.env[ENV_KEY] = "oldest_first";
  assert.equal(getMatchAggregationPendingOrder(), "oldest_first");
});

test("getMatchAggregationPendingOrder: unknown values fall back to newest_first", () => {
  process.env[ENV_KEY] = "fifo";
  assert.equal(getMatchAggregationPendingOrder(), "newest_first");
});
