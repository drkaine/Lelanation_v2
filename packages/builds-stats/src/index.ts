export {
  BASE_CRIT_DAMAGE_MULTIPLIER,
  BASE_CRIT_DAMAGE_PERCENT,
  CHAMPION_GROWTH_FORMULA_A,
  CHAMPION_GROWTH_FORMULA_B,
  CHAMPION_LEVEL_GAIN_A,
  CHAMPION_LEVEL_GAIN_B,
  CHAMPION_GROWTH_TOTAL_AT_18,
} from "./gameConstants";
export {
  calculateStats,
  filterItemsForStats,
  filterItemsForStatsWithStarters,
  sumStarterDrainStats,
  getGoldPer10FromItem,
  type CalculateStatsOptions,
} from "./statsCalculator";
export {
  WIKI_GLOBAL_RULES,
  checkWikiGlobalRule,
  groupWikiRulesByPage,
  type WikiGlobalRuleDefinition,
  type WikiRuleCheckResult,
  type WikiRuleCheckStatus,
} from "./wikiGlobalRules";
export {
  WIKI_STAT_CALCULATION_CHECKS,
  growingStatAtLevel,
  statIncreaseOnLevelUp,
  levelGainCoefficient,
  attackSpeedAtLevelWiki,
  checkWikiStatCalculation,
  groupWikiStatCalculationsByPage,
  type WikiStatCalculationCheck,
} from "./wikiStatCalculations";
export { championGrowthMultiplier } from "./championGrowth";
export {
  calculateGoldValue,
  calculateGoldEfficiency,
  calculateItemGoldValue,
  calculateItemGoldValueFromItem,
  calculateItemGoldEfficiency,
  calculateBuildGoldEfficiency,
  itemStatsToGoldValueStats,
  type GoldValueStats,
  type ItemForGoldValueStats,
} from "./goldEfficiency";
export {
  parseStatsFromItemDescription,
  resolveItemStatsForGoldValue,
} from "./itemStatsEnrichment";
