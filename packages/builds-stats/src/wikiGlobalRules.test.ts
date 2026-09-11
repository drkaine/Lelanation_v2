import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WIKI_GLOBAL_RULES,
  checkWikiGlobalRule,
} from "./wikiGlobalRules.js";

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

describe("wikiGlobalRules", () => {
  it("detects base crit damage at 200% from Critical strike page", () => {
    const rule = WIKI_GLOBAL_RULES.find((entry) => entry.id === "baseCritDamagePercent");
    expect(rule).toBeDefined();
    const result = checkWikiGlobalRule(loadFixture("critical-strike.snippet.html"), rule!);
    expect(result.status).toBe("ok");
    expect(result.wikiValue).toBe(200);
    expect(result.ourValue).toBe(200);
  });

  it("flags drift when wiki crit damage differs", () => {
    const rule = WIKI_GLOBAL_RULES.find((entry) => entry.id === "baseCritDamagePercent");
    expect(rule).toBeDefined();
    const driftHtml =
      "<p>A critical strike deals 175% of its normal value by default.</p>";
    const result = checkWikiGlobalRule(driftHtml, rule!);
    expect(result.status).toBe("drift");
    expect(result.wikiValue).toBe(175);
  });

  it("validates growth formula coefficients from Champion statistic page", () => {
    const html = loadFixture("champion-statistic.snippet.html");
    for (const id of [
      "championGrowthFormulaA",
      "championGrowthFormulaB",
      "championLevelGainA",
      "championLevelGainB",
      "championGrowthTotalAt18",
    ]) {
      const rule = WIKI_GLOBAL_RULES.find((entry) => entry.id === id);
      expect(rule).toBeDefined();
      const result = checkWikiGlobalRule(html, rule!);
      expect(result.status).toBe("ok");
    }
  });
});
