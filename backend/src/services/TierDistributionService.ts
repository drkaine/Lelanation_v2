/**
 * Répartition des tiers de la tier list (page Gestion > Stats). Scores affichés (note × 100, B ≈ 0) :
 * |score| < bHalf → B ; bHalf..sMin → A ; ≥ sMin → S ; S+ ≥ max(sPlusMin, plus bas S + extremeGap),
 * au plus extremeMax champions par cohorte. Symétrique pour C / D.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export interface TierDistribution {
  bHalf: number;
  sMin: number;
  sPlusMin: number;
  extremeGap: number;
  extremeMax: number;
}

export const DEFAULT_TIER_DISTRIBUTION: TierDistribution = {
  bHalf: 35,
  sMin: 70,
  sPlusMin: 105,
  extremeGap: 30,
  extremeMax: 5,
};

export function tierDistributionFile(): string {
  return process.env.TIER_DISTRIBUTION_FILE ?? join(process.cwd(), 'data', 'tier-distribution.json');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseTierDistribution(raw: unknown): TierDistribution | null {
  if (!isRecord(raw)) return null;
  const { bHalf, sMin, sPlusMin, extremeGap, extremeMax } = raw;
  if (!finite(bHalf) || !finite(sMin) || !finite(sPlusMin) || !finite(extremeGap)) return null;
  if (typeof extremeMax !== 'number' || !Number.isInteger(extremeMax) || extremeMax < 0) return null;
  if (bHalf <= 0 || sMin <= bHalf || sPlusMin < sMin || extremeGap < 0) return null;
  return { bHalf, sMin, sPlusMin, extremeGap, extremeMax };
}

/** Fichier absent ou invalide : répartition par défaut. */
export function loadTierDistribution(file: string = tierDistributionFile()): TierDistribution {
  try {
    return parseTierDistribution(JSON.parse(readFileSync(file, 'utf8'))) ?? { ...DEFAULT_TIER_DISTRIBUTION };
  } catch {
    return { ...DEFAULT_TIER_DISTRIBUTION };
  }
}

let cached: TierDistribution | null = null;

/** Répartition courante (lue une fois, puis gardée en mémoire jusqu'au prochain update). */
export function getTierDistribution(): TierDistribution {
  cached ??= loadTierDistribution();
  return cached;
}

export function resetTierDistributionCache(): void {
  cached = null;
}

/** PUT /api/admin/tier-distribution : écrit si valide et l'applique tout de suite. */
export function updateTierDistribution(
  file: string,
  body: unknown,
): { ok: true; settings: TierDistribution } | { ok: false } {
  const settings = parseTierDistribution(body);
  if (!settings) return { ok: false };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2));
  cached = { ...settings };
  return { ok: true, settings };
}
