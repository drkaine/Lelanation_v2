import { describe, expect, test, vi } from "vitest";

process.env.ENV ||= "dev";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
process.env.RIOT_API_KEY ||= "RGAPI-test";

const { RiotClient } = await import("../src/riot/client.js");

describe("RiotClient.getMatchIds URL", () => {
  test("uses regional host and fixed ranked solo query params", async () => {
    const client = new RiotClient("RGAPI-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", fetchMock);

    await client.getMatchIds("puuid-1", "euw1", { startTime: 1_700_000_000, start: 0 });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://europe.api.riotgames.com");
    expect(url.pathname).toContain("/lol/match/v5/matches/by-puuid/puuid-1/ids");
    expect(url.searchParams.get("queue")).toBe("420");
    expect(url.searchParams.get("type")).toBe("ranked");
    expect(url.searchParams.get("count")).toBe("20");
    expect(url.searchParams.get("startTime")).toBe("1700000000");
    expect(url.searchParams.get("start")).toBe("0");
    expect(url.searchParams.has("endTime")).toBe(false);

    vi.unstubAllGlobals();
  });
});
