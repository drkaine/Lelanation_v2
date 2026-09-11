import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WIKI_STAT_CALCULATION_CHECKS,
  attackSpeedAtLevelWiki,
  checkWikiStatCalculation,
  growingStatAtLevel,
  levelGainCoefficient,
  statIncreaseOnLevelUp,
} from "./wikiStatCalculations.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests",
  "fixtures",
  "wiki"
);

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("wikiStatCalculations", () => {
  it("matches Alistar HP example from Champion statistic wiki", () => {
    expect(growingStatAtLevel(685, 120, 2)).toBeCloseTo(771.4, 5);
    expect(statIncreaseOnLevelUp(120, 2)).toBeCloseTo(86.4, 5);
  });

  it("matches Volibear attack speed example from Champion statistic wiki", () => {
    expect(attackSpeedAtLevelWiki(0.625, 0.7, 2, 3, 25)).toBeCloseTo(0.82065, 5);
  });

  it("matches level gain coefficients documented on the wiki", () => {
    expect(levelGainCoefficient(2)).toBeCloseTo(0.72, 5);
    expect(levelGainCoefficient(10)).toBeCloseTo(1, 5);
    expect(levelGainCoefficient(18)).toBeCloseTo(1.28, 5);
  });

  it("validates all wiki calculation checks against fixture page", () => {
    const html = loadFixture("champion-statistic.snippet.html");
    for (const check of WIKI_STAT_CALCULATION_CHECKS) {
      const result = checkWikiStatCalculation(html, check);
      expect(result.status, check.id).toBe("ok");
    }
  });
});
