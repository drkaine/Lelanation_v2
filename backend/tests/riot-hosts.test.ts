import { describe, expect, test } from "vitest";
import { toPlatformHost, toRegionalHost } from "../src/riot/hosts.js";

describe("riot routing hosts", () => {
  describe("toRegionalHost (Match-v5)", () => {
    test.each([
      ["euw1", "https://europe.api.riotgames.com"],
      ["eun1", "https://europe.api.riotgames.com"],
      ["na1", "https://americas.api.riotgames.com"],
      ["kr", "https://asia.api.riotgames.com"],
      ["oc1", "https://sea.api.riotgames.com"],
    ])("platform %s → %s", (platform, expected) => {
      expect(toRegionalHost(platform)).toBe(expected);
    });
  });

  describe("toPlatformHost (League-v4 / Summoner-v4)", () => {
    test.each([
      ["euw1", "https://euw1.api.riotgames.com"],
      ["eun1", "https://eun1.api.riotgames.com"],
      ["na1", "https://na1.api.riotgames.com"],
    ])("platform %s → %s", (platform, expected) => {
      expect(toPlatformHost(platform)).toBe(expected);
    });
  });

  test("Match-v5 and League-v4 use separate rate-limit hosts for EU", () => {
    for (const platform of ["euw1", "eun1"]) {
      expect(toRegionalHost(platform)).not.toBe(toPlatformHost(platform));
      expect(toRegionalHost(platform)).toBe("https://europe.api.riotgames.com");
    }
  });
});
