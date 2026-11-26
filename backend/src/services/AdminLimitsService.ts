/**
 * Réglages réservés à l'admin (hors Gestion) : votes communauté, rythme du poller, rétentions.
 * Fichier `data/admin-limits.json` (env ADMIN_LIMITS_FILE) ; absent → valeurs historiques / env.
 * Relu par le poller (autre process) à chaque changement du fichier.
 */
import { join } from 'path';
import { createLimitsStore, type LimitSpec } from './limitsStore.js';

export type AdminLimitKey =
  | 'voteMinTotal'
  | 'voteMinUpvotePct'
  | 'pollTargetNewGames'
  | 'pollMinDelayDays'
  | 'pollMaxDelayDays'
  | 'pollWindowHours'
  | 'rankHistoryRetentionDays'
  | 'patchRetentionDays';

export type AdminLimits = Record<AdminLimitKey, number>;

const DEFAULT_RANK_HISTORY_RETENTION_DAYS = 15;
const DEFAULT_PATCH_RETENTION_DAYS = 5;
const MAX_PATCH_RETENTION_DAYS = 90;

function envRankHistoryRetentionDays(): number {
  const raw = process.env.DATA_RETENTION_DAYS ?? process.env.RANK_HISTORY_RETENTION_DAYS;
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RANK_HISTORY_RETENTION_DAYS;
}

/** POLLER_PATCH_RETENTION_DAYS : vide / false / 0 → 0 (désactivé) ; true → 5 ; n → min(n, 90). */
export function envPatchRetentionDays(): number {
  const raw = process.env.POLLER_PATCH_RETENTION_DAYS?.trim() ?? '';
  if (!raw || raw.toLowerCase() === 'false') return 0;
  if (raw.toLowerCase() === 'true') return DEFAULT_PATCH_RETENTION_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_PATCH_RETENTION_DAYS) : 0;
}

export function defaultAdminLimits(): AdminLimits {
  return {
    voteMinTotal: 10,
    voteMinUpvotePct: 30,
    pollTargetNewGames: 5,
    pollMinDelayDays: 0.25,
    pollMaxDelayDays: 30,
    pollWindowHours: 48,
    rankHistoryRetentionDays: envRankHistoryRetentionDays(),
    patchRetentionDays: envPatchRetentionDays(),
  };
}

export const ADMIN_LIMIT_SPECS: ReadonlyArray<LimitSpec<AdminLimits>> = [
  { key: 'voteMinTotal', min: 1, integer: true },
  { key: 'voteMinUpvotePct', min: 0, max: 100 },
  { key: 'pollTargetNewGames', min: 1, integer: true },
  { key: 'pollMinDelayDays', min: 0.01, max: 365 },
  { key: 'pollMaxDelayDays', min: 0.01, max: 365 },
  { key: 'pollWindowHours', min: 1, max: 168, integer: true },
  { key: 'rankHistoryRetentionDays', min: 1, max: 365, integer: true },
  { key: 'patchRetentionDays', min: 0, max: MAX_PATCH_RETENTION_DAYS, integer: true },
];

export const adminLimitsStore = createLimitsStore<AdminLimitKey>({
  file: () => process.env.ADMIN_LIMITS_FILE ?? join(process.cwd(), 'data', 'admin-limits.json'),
  specs: ADMIN_LIMIT_SPECS,
  defaults: defaultAdminLimits,
  check: (l) => l.pollMaxDelayDays >= l.pollMinDelayDays,
});

export const getAdminLimits = (): AdminLimits => adminLimitsStore.get();
export const updateAdminLimits = (body: unknown) => adminLimitsStore.update(body);
