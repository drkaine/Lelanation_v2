/**
 * Seuils des statistiques modifiables depuis Gestion > Stats (admin et lelariva).
 * Fichier `data/stats-limits.json` (env STATS_LIMITS_FILE) ; absent → valeurs historiques.
 */
import { join } from 'path';
import { createLimitsStore, type LimitSpec } from './limitsStore.js';

export type StatsLimitKey =
  | 'tierListMinGames'
  | 'tierListMinPickPct'
  | 'botlaneMinGames'
  | 'regionWinrateMinGames'
  | 'otpWinrateMinGames'
  | 'compareTopLimit'
  | 'regionSpreadLimit'
  | 'dashboardPopulationMinGames'
  | 'synergyMinPeerGames'
  | 'matchupScoreMax';

export type StatsLimits = Record<StatsLimitKey, number>;

export const DEFAULT_STATS_LIMITS: StatsLimits = {
  tierListMinGames: 10,
  tierListMinPickPct: 0.5,
  botlaneMinGames: 10,
  regionWinrateMinGames: 20,
  otpWinrateMinGames: 10,
  compareTopLimit: 10,
  regionSpreadLimit: 15,
  dashboardPopulationMinGames: 30,
  synergyMinPeerGames: 3,
  matchupScoreMax: 10,
};

export const STATS_LIMIT_SPECS: ReadonlyArray<LimitSpec<StatsLimits>> = [
  { key: 'tierListMinGames', min: 1, integer: true },
  { key: 'tierListMinPickPct', min: 0, max: 100 },
  { key: 'botlaneMinGames', min: 1, integer: true },
  { key: 'regionWinrateMinGames', min: 1, integer: true },
  { key: 'otpWinrateMinGames', min: 1, integer: true },
  { key: 'compareTopLimit', min: 1, max: 100, integer: true },
  { key: 'regionSpreadLimit', min: 1, max: 100, integer: true },
  { key: 'dashboardPopulationMinGames', min: 1, integer: true },
  { key: 'synergyMinPeerGames', min: 1, integer: true },
  { key: 'matchupScoreMax', min: 0.1, max: 100 },
];

export const statsLimitsStore = createLimitsStore<StatsLimitKey>({
  file: () => process.env.STATS_LIMITS_FILE ?? join(process.cwd(), 'data', 'stats-limits.json'),
  specs: STATS_LIMIT_SPECS,
  defaults: () => ({ ...DEFAULT_STATS_LIMITS }),
});

export const getStatsLimits = (): StatsLimits => statsLimitsStore.get();
export const updateStatsLimits = (body: unknown) => statsLimitsStore.update(body);
