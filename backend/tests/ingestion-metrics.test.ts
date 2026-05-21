import { describe, expect, test, vi } from "vitest";

process.env.ENV ||= "dev";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
process.env.RIOT_API_KEY ||= "RGAPI-test";

const { fetchIngestionThroughputMetrics } = await import("../src/redis/ingestion-metrics.js");

describe("ingestion throughput metrics", () => {
  test("computes projected rate and api efficiency", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(
      (await import("../src/redis/client.js")).redis,
      "zcount",
    ).mockImplementation(async (_key: string, min: number, max: number) => {
      if (max - min >= 3_500_000) return 12;
      if (max - min >= 500_000) return 3;
      return 0;
    });

    const metrics = await fetchIngestionThroughputMetrics(now);
    expect(metrics.matchesLastHour).toBe(12);
    expect(metrics.matchesLast10Min).toBe(3);
    expect(metrics.projectedMatchesPerHour).toBe(18);
    expect(metrics.apiEfficiencyPct).toBe(Math.round((12 / (95 * 30)) * 100));

    vi.restoreAllMocks();
  });
});
