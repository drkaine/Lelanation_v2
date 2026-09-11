import { describe, expect, it } from "vitest";
import { wikiPageTitleFromUrl } from "../../src/scraper/wikiFetcher.js";

describe("wikiFetcher", () => {
  it("extracts page title from wiki URL", () => {
    expect(
      wikiPageTitleFromUrl("https://wiki.leagueoflegends.com/en-us/Critical_strike")
    ).toBe("Critical_strike");
    expect(
      wikiPageTitleFromUrl("https://wiki.leagueoflegends.com/en-us/Champion_statistic")
    ).toBe("Champion_statistic");
  });
});
