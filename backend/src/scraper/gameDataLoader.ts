/**
 * Load local game data indexes for entity id enrichment.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { buildGameDataIndexes, type GameDataIndexes } from './entityIds.js';

const LANG = 'en_US';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveGameDataRoots(): string[] {
  const roots: string[] = [];
  const cwd = process.cwd();

  roots.push(join(cwd, 'data', 'game'));
  roots.push(join(cwd, '..', 'frontend', 'public', 'data', 'game'));

  return roots;
}

async function resolveGameVersion(): Promise<string | null> {
  for (const root of resolveGameDataRoots()) {
    const versionFile = join(root, 'version.json');
    if (!existsSync(versionFile)) continue;

    const versionData = await readJson<{ currentVersion?: string }>(versionFile);
    if (versionData?.currentVersion) {
      return versionData.currentVersion;
    }
  }
  return null;
}

function resolveLangDir(root: string, version: string): string | null {
  const langDir = join(root, version, LANG);
  return existsSync(langDir) ? langDir : null;
}

/**
 * Load champion/item/rune indexes from synced game data on disk.
 */
export async function loadGameDataIndexes(gameVersion?: string): Promise<GameDataIndexes | null> {
  const version = gameVersion ?? (await resolveGameVersion());
  if (!version) {
    logger.debug('No game version found for entity id enrichment');
    return null;
  }

  for (const root of resolveGameDataRoots()) {
    const langDir = resolveLangDir(root, version);
    if (!langDir) continue;

    const championsIndexPath = join(langDir, 'champions', 'index.json');
    const itemPath = join(langDir, 'item.json');
    const runesPath = join(langDir, 'runesReforged.json');

    const [championsData, itemData, runesData] = await Promise.all([
      readJson<{ champions?: Array<{ id: string; name?: string }> }>(championsIndexPath),
      readJson<{ data?: Record<string, { name?: string }> }>(itemPath),
      readJson<Array<{ slots: Array<{ runes: Array<{ id: number; key: string; name?: string }> }> }>>(runesPath),
    ]);

    if (!championsData?.champions || !itemData?.data || !runesData) {
      continue;
    }

    const indexes = buildGameDataIndexes(
      championsData.champions,
      itemData.data,
      runesData
    );

    logger.debug({ version, root }, 'Loaded game data indexes for entity id enrichment');
    return indexes;
  }

  logger.debug({ version }, 'Game data indexes not available for entity id enrichment');
  return null;
}
