import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { RegionRouter } from './RegionRouter.js';
import type { Platform, RegionalCluster } from './types.js';

/** Tiers ciblés par le balayage, du plus haut au plus bas. */
export const POLL_TIERS = [
  'CHALLENGER',
  'GRANDMASTER',
  'MASTER',
  'DIAMOND',
  'EMERALD',
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'IRON',
] as const;
export type PollTier = (typeof POLL_TIERS)[number];
export type TierWeights = Record<PollTier, number>;

const ALL_PLATFORMS: readonly Platform[] = [
  'euw1', 'eun1', 'tr1', 'ru', 'me1', 'na1', 'br1', 'la1', 'la2',
  'kr', 'jp1', 'oc1', 'ph2', 'sg2', 'th2', 'tw2', 'vn2',
];

/** Réglages du poller édités depuis la page Gestion (onglet Data). */
export interface PollerSettings {
  platforms: Platform[];
  /** Part des joueurs pollés par tier, en %, total ≤ 100. */
  tierWeights: TierWeights;
}

function isPlatform(value: unknown): value is Platform {
  return ALL_PLATFORMS.some((p) => p === value);
}

function isPollTier(value: string): value is PollTier {
  return POLL_TIERS.some((t) => t === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniformWeights(value: number): TierWeights {
  return {
    CHALLENGER: value,
    GRANDMASTER: value,
    MASTER: value,
    DIAMOND: value,
    EMERALD: value,
    PLATINUM: value,
    GOLD: value,
    SILVER: value,
    BRONZE: value,
    IRON: value,
  };
}

export function defaultTierWeights(): TierWeights {
  return uniformWeights(100 / POLL_TIERS.length);
}

function zeroWeights(): TierWeights {
  return uniformWeights(0);
}

/** Réglages valides, sinon null. */
export function parsePollerSettings(raw: unknown): PollerSettings | null {
  if (!isRecord(raw) || !Array.isArray(raw.platforms) || !isRecord(raw.tierWeights)) return null;
  if (raw.platforms.length === 0 || !raw.platforms.every(isPlatform)) return null;
  const platforms = [...new Set<Platform>(raw.platforms)];
  const tierWeights = zeroWeights();
  for (const [tier, value] of Object.entries(raw.tierWeights)) {
    if (!isPollTier(tier) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    tierWeights[tier] = value;
  }
  const total = Object.values(tierWeights).reduce((a, b) => a + b, 0);
  if (total <= 0 || total > 100 + 1e-9) return null;
  return { platforms, tierWeights };
}

export function pollerSettingsFile(): string {
  return process.env.POLLER_SETTINGS_FILE ?? join(process.cwd(), 'data', 'poller-settings.json');
}

/** Fichier absent ou invalide : plateformes de repli (env), poids égaux. */
export function loadPollerSettings(file: string, fallbackPlatforms: readonly Platform[]): PollerSettings {
  try {
    const parsed = parsePollerSettings(JSON.parse(readFileSync(file, 'utf8')));
    if (parsed) return parsed;
  } catch {
    // absent ou illisible : repli
  }
  return { platforms: [...fallbackPlatforms], tierWeights: defaultTierWeights() };
}

export function savePollerSettings(file: string, settings: PollerSettings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
}

/** Plateformes proposées ; même cluster = même rate limit match-v5. */
export function platformChoices(): Array<{ platform: Platform; cluster: RegionalCluster }> {
  return ALL_PLATFORMS.map((platform) => ({ platform, cluster: RegionRouter.getCluster(platform) }));
}
