/** Default critical strike damage multiplier (patch 26.01+). Not in Data Dragon champion stats. */
export const BASE_CRIT_DAMAGE_MULTIPLIER = 2;
export const BASE_CRIT_DAMAGE_PERCENT = BASE_CRIT_DAMAGE_MULTIPLIER * 100;

/** Coefficients of the Riot growth formula (Champion_statistic wiki). */
export const CHAMPION_GROWTH_FORMULA_A = 0.7025;
export const CHAMPION_GROWTH_FORMULA_B = 0.0175;

/** Coefficients of the per-level stat gain formula (Champion_statistic wiki). */
export const CHAMPION_LEVEL_GAIN_A = 0.65;
export const CHAMPION_LEVEL_GAIN_B = 0.035;

/** Total growth multiplier at level 18 (17 level-ups × 100% average gain). */
export const CHAMPION_GROWTH_TOTAL_AT_18 = 17;
