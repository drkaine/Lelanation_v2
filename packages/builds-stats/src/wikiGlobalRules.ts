import {
  BASE_CRIT_DAMAGE_PERCENT,
  CHAMPION_GROWTH_FORMULA_A,
  CHAMPION_GROWTH_FORMULA_B,
  CHAMPION_GROWTH_TOTAL_AT_18,
  CHAMPION_LEVEL_GAIN_A,
  CHAMPION_LEVEL_GAIN_B,
} from "./gameConstants.js";

export type WikiGlobalRuleDefinition = {
  id: string;
  label: string;
  wikiPage: string;
  /** Why this value is not available (or reliable) in Data Dragon. */
  ddragonGap: string;
  ourValue: number;
  tolerance: number;
  pattern: RegExp;
  parseWikiValue: (raw: string) => number | null;
};

/**
 * Global game rules hardcoded in Lelanation because Data Dragon does not expose them.
 * Each rule is checked against the official LoL wiki on every new patch sync.
 */
export const WIKI_GLOBAL_RULES: WikiGlobalRuleDefinition[] = [
  {
    id: "baseCritDamagePercent",
    label: "Dégâts de crit de base",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Critical_strike",
    ddragonGap: "champion.stats.crit vaut 0 pour tous les champions",
    ourValue: BASE_CRIT_DAMAGE_PERCENT,
    tolerance: 0,
    pattern:
      /deals\s+(\d+(?:\.\d+)?)\s*%\s+of\s+its\s+normal\s+value\s+by\s+default/i,
    parseWikiValue: (raw) => {
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : null;
    },
  },
  {
    id: "championGrowthFormulaA",
    label: "Formule de croissance — coefficient A",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Champion_statistic",
    ddragonGap: "formule globale, absente de Data Dragon",
    ourValue: CHAMPION_GROWTH_FORMULA_A,
    tolerance: 0.0001,
    pattern: /\(0\.7025\s*\+\s*0\.0175/i,
    parseWikiValue: () => CHAMPION_GROWTH_FORMULA_A,
  },
  {
    id: "championGrowthFormulaB",
    label: "Formule de croissance — coefficient B",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Champion_statistic",
    ddragonGap: "formule globale, absente de Data Dragon",
    ourValue: CHAMPION_GROWTH_FORMULA_B,
    tolerance: 0.0001,
    pattern: /0\.7025\s*\+\s*0\.0175/i,
    parseWikiValue: () => CHAMPION_GROWTH_FORMULA_B,
  },
  {
    id: "championLevelGainA",
    label: "Gain par niveau — coefficient A",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Champion_statistic",
    ddragonGap: "formule globale, absente de Data Dragon",
    ourValue: CHAMPION_LEVEL_GAIN_A,
    tolerance: 0.0001,
    pattern: /0\.65\s*\+\s*0\.035\s*[×x*]?\s*n/i,
    parseWikiValue: () => CHAMPION_LEVEL_GAIN_A,
  },
  {
    id: "championLevelGainB",
    label: "Gain par niveau — coefficient B",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Champion_statistic",
    ddragonGap: "formule globale, absente de Data Dragon",
    ourValue: CHAMPION_LEVEL_GAIN_B,
    tolerance: 0.0001,
    pattern: /0\.65\s*\+\s*0\.035/i,
    parseWikiValue: () => CHAMPION_LEVEL_GAIN_B,
  },
  {
    id: "championGrowthTotalAt18",
    label: "Multiplicateur de croissance total au niveau 18",
    wikiPage: "https://wiki.leagueoflegends.com/en-us/Champion_statistic",
    ddragonGap: "règle dérivée, absente de Data Dragon",
    ourValue: CHAMPION_GROWTH_TOTAL_AT_18,
    tolerance: 0,
    pattern: /gained a total of 1700%.*?17 times/i,
    parseWikiValue: () => CHAMPION_GROWTH_TOTAL_AT_18,
  },
];

export type WikiRuleCheckStatus = "ok" | "drift" | "parse_error";

export type WikiRuleCheckResult = {
  id: string;
  label: string;
  status: WikiRuleCheckStatus;
  ourValue: number;
  wikiValue?: number;
  wikiPage: string;
  ddragonGap: string;
  message?: string;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&times;/gi, "×")
    .replace(/&minus;/gi, "−");
}

export function normalizeWikiText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkWikiGlobalRule(
  pageText: string,
  rule: WikiGlobalRuleDefinition
): WikiRuleCheckResult {
  const normalized = normalizeWikiText(pageText);
  const match = normalized.match(rule.pattern);

  if (!match) {
    return {
      id: rule.id,
      label: rule.label,
      status: "parse_error",
      ourValue: rule.ourValue,
      wikiPage: rule.wikiPage,
      ddragonGap: rule.ddragonGap,
      message: "Valeur wiki introuvable (motif obsolète ?)",
    };
  }

  const raw = match[1] ?? "";
  const wikiValue = rule.parseWikiValue(raw);
  if (wikiValue == null || !Number.isFinite(wikiValue)) {
    return {
      id: rule.id,
      label: rule.label,
      status: "parse_error",
      ourValue: rule.ourValue,
      wikiPage: rule.wikiPage,
      ddragonGap: rule.ddragonGap,
      message: "Valeur wiki non parsable",
    };
  }

  if (Math.abs(wikiValue - rule.ourValue) > rule.tolerance) {
    return {
      id: rule.id,
      label: rule.label,
      status: "drift",
      ourValue: rule.ourValue,
      wikiValue,
      wikiPage: rule.wikiPage,
      ddragonGap: rule.ddragonGap,
      message: `Wiki=${wikiValue}, Lelanation=${rule.ourValue}`,
    };
  }

  return {
    id: rule.id,
    label: rule.label,
    status: "ok",
    ourValue: rule.ourValue,
    wikiValue,
    wikiPage: rule.wikiPage,
    ddragonGap: rule.ddragonGap,
  };
}

export function groupWikiRulesByPage(
  rules: WikiGlobalRuleDefinition[] = WIKI_GLOBAL_RULES
): Map<string, WikiGlobalRuleDefinition[]> {
  const pages = new Map<string, WikiGlobalRuleDefinition[]>();
  for (const rule of rules) {
    const list = pages.get(rule.wikiPage) ?? [];
    list.push(rule);
    pages.set(rule.wikiPage, list);
  }
  return pages;
}
