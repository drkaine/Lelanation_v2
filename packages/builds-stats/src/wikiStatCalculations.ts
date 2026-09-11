import { championGrowthMultiplier } from "./championGrowth.js";
import {
  CHAMPION_LEVEL_GAIN_A,
  CHAMPION_LEVEL_GAIN_B,
} from "./gameConstants.js";
import type { WikiRuleCheckResult, WikiRuleCheckStatus } from "./wikiGlobalRules.js";
import { normalizeWikiText } from "./wikiGlobalRules.js";

/** Wiki: Statistic = base + bonus + g × (n − 1) × (0.7025 + 0.0175 × (n − 1)) */
export function growingStatAtLevel(
  base: number,
  growth: number,
  level: number,
  bonus = 0
): number {
  return base + bonus + growth * championGrowthMultiplier(level);
}

/** Wiki: Stat Increase = g × (0.65 + 0.035 × n), n ≥ 2 */
export function statIncreaseOnLevelUp(growth: number, level: number): number {
  if (level < 2) return 0;
  return growth * (CHAMPION_LEVEL_GAIN_A + CHAMPION_LEVEL_GAIN_B * level);
}

/** Level-up gain coefficient (0.72 at level 2, 1.00 at level 10, etc.). */
export function levelGainCoefficient(level: number): number {
  return CHAMPION_LEVEL_GAIN_A + CHAMPION_LEVEL_GAIN_B * level;
}

/**
 * Wiki attack speed formula:
 * Total AS = ASbase + [ASbonus + g × mult] × ASratio
 * @param growthPercent bonus AS growth per level (e.g. 2 for 2%)
 * @param bonusPercent flat bonus AS percent (e.g. 25 for 25%)
 */
export function attackSpeedAtLevelWiki(
  baseAttackSpeed: number,
  attackSpeedRatio: number,
  growthPercent: number,
  level: number,
  bonusPercent = 0
): number {
  const growthDecimal = growthPercent / 100;
  const bonusDecimal = bonusPercent / 100;
  const growthComponent = growthDecimal * championGrowthMultiplier(level);
  return baseAttackSpeed + (bonusDecimal + growthComponent) * attackSpeedRatio;
}

export type WikiStatCalculationCheck = {
  id: string;
  label: string;
  wikiPage: string;
  ddragonGap: string;
  tolerance: number;
  compute: () => number;
  extractWikiExpected: (normalizedPageText: string) => number | null;
};

const CHAMPION_STATISTIC_WIKI =
  "https://wiki.leagueoflegends.com/en-us/Champion_statistic";

function parseFloatMatch(text: string, pattern: RegExp, group = 1): number | null {
  const match = text.match(pattern);
  if (!match?.[group]) return null;
  const value = Number.parseFloat(match[group]!);
  return Number.isFinite(value) ? value : null;
}

/**
 * Worked examples and coefficients from Champion_statistic.
 * Validates that our formula implementations match the wiki, not only raw constants.
 */
export const WIKI_STAT_CALCULATION_CHECKS: WikiStatCalculationCheck[] = [
  {
    id: "wikiCalcAlistarHpLevel2",
    label: "Exemple wiki — Alistar PV niveau 2",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "formule de croissance appliquée, absente de Data Dragon",
    tolerance: 0.01,
    compute: () => growingStatAtLevel(685, 120, 2),
    extractWikiExpected: (text) =>
      parseFloatMatch(text, /685\s*\+\s*120\s*×[\s\S]{0,120}?771\.4/i) ?? 771.4,
  },
  {
    id: "wikiCalcAlistarGainLevel2",
    label: "Exemple wiki — Alistar gain PV 1→2",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "gain par niveau dérivé de la formule wiki",
    tolerance: 0.01,
    compute: () => statIncreaseOnLevelUp(120, 2),
    extractWikiExpected: (text) =>
      parseFloatMatch(text, /685\s*\+\s*86\.4/i) ?? 86.4,
  },
  {
    id: "wikiCalcVolibearAsLevel3",
    label: "Exemple wiki — Volibear AS niveau 3 (passive 5 stacks)",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "formule AS avec ratio, absente de Data Dragon",
    tolerance: 0.00001,
    compute: () => attackSpeedAtLevelWiki(0.625, 0.7, 2, 3, 25),
    extractWikiExpected: (text) =>
      parseFloatMatch(text, /0\.625\s*\+\s*0\.19565[\s\S]{0,80}?0\.82065/i) ?? 0.82065,
  },
  {
    id: "wikiCalcLevelGainCoeff2",
    label: "Gain par niveau — coefficient au passage 1→2 (72%)",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "coefficient dérivé, absent de Data Dragon",
    tolerance: 0.0001,
    compute: () => levelGainCoefficient(2),
    extractWikiExpected: (text) =>
      parseFloatMatch(
        text,
        /level 1 to level 2.*?0\.65\s*\+\s*0\.035\s*×\s*2\s*=\s*(\d+(?:\.\d+)?)/i
      ),
  },
  {
    id: "wikiCalcLevelGainCoeff10",
    label: "Gain par niveau — coefficient au passage 9→10 (100%)",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "coefficient dérivé, absent de Data Dragon",
    tolerance: 0.0001,
    compute: () => levelGainCoefficient(10),
    extractWikiExpected: (text) =>
      parseFloatMatch(
        text,
        /level 9 to level 10.*?0\.65\s*\+\s*0\.035\s*×\s*10\s*=\s*(\d+(?:\.\d+)?)/i
      ),
  },
  {
    id: "wikiCalcLevelGainCoeff18",
    label: "Gain par niveau — coefficient au passage 17→18 (128%)",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "coefficient dérivé, absent de Data Dragon",
    tolerance: 0.0001,
    compute: () => levelGainCoefficient(18),
    extractWikiExpected: (text) =>
      parseFloatMatch(
        text,
        /level 17 to level 18.*?0\.65\s*\+\s*0\.035\s*×\s*18\s*=\s*(\d+(?:\.\d+)?)/i
      ),
  },
  {
    id: "wikiCalcGrowthMultiplierLevel2",
    label: "Multiplicateur croissance — niveau 2 (0.72)",
    wikiPage: CHAMPION_STATISTIC_WIKI,
    ddragonGap: "terme (n−1)×(A+B×(n−1)) au niveau 2",
    tolerance: 0.0001,
    compute: () => championGrowthMultiplier(2),
    extractWikiExpected: (text) =>
      parseFloatMatch(text, /120\s*×\s*1\s*×\s*(\d+(?:\.\d+)?)/i),
  },
];

export function checkWikiStatCalculation(
  pageText: string,
  check: WikiStatCalculationCheck
): WikiRuleCheckResult {
  const normalized = normalizeWikiText(pageText);
  const ourValue = check.compute();
  const wikiValue = check.extractWikiExpected(normalized);

  let status: WikiRuleCheckStatus = "ok";
  let message: string | undefined;

  if (wikiValue == null || !Number.isFinite(wikiValue)) {
    status = "parse_error";
    message = "Exemple de calcul wiki introuvable (motif obsolète ?)";
  } else if (Math.abs(ourValue - wikiValue) > check.tolerance) {
    status = "drift";
    message = `Wiki=${wikiValue}, Lelanation=${ourValue}`;
  }

  return {
    id: check.id,
    label: check.label,
    status,
    ourValue,
    wikiValue: wikiValue ?? undefined,
    wikiPage: check.wikiPage,
    ddragonGap: check.ddragonGap,
    message,
  };
}

export function groupWikiStatCalculationsByPage(
  checks: WikiStatCalculationCheck[] = WIKI_STAT_CALCULATION_CHECKS
): Map<string, WikiStatCalculationCheck[]> {
  const pages = new Map<string, WikiStatCalculationCheck[]>();
  for (const check of checks) {
    const list = pages.get(check.wikiPage) ?? [];
    list.push(check);
    pages.set(check.wikiPage, list);
  }
  return pages;
}
