/**
 * Multiplicateur de croissance Riot : g × (n−1) × (0.7025 + 0.0175 × (n−1)).
 * Identique au linéaire aux niveaux 1 et 18, inférieur entre les deux.
 * https://wiki.leagueoflegends.com/en-us/Champion_statistic
 */
export function championGrowthMultiplier(level: number): number {
  const n = Math.max(1, level) - 1;
  return n * (0.7025 + 0.0175 * n);
}
