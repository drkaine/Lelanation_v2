/**
 * Load local game data indexes for entity id enrichment.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { buildGameDataIndexes, type GameDataIndexes } from './entityIds.js';

export type { GameDataIndexes };

const PRIMARY_LANG = 'en_US';
const SECONDARY_LANGS = ['fr_FR'] as const;

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

function resolveLangDir(root: string, version: string, lang: string = PRIMARY_LANG): string | null {
  const langDir = join(root, version, lang);
  return existsSync(langDir) ? langDir : null;
}

async function buildIndexesFromRoot(langDir: string): Promise<GameDataIndexes | null> {
  const championsIndexPath = join(langDir, 'champions', 'index.json');
  const itemPath = join(langDir, 'item.json');
  const runesPath = join(langDir, 'runesReforged.json');

  type RunesReforgedData = Array<{
    slots: Array<{ runes: Array<{ id: number; key: string; name?: string }> }>;
  }>;

  const [championsData, itemData, runesData] = await Promise.all([
    readJson<{ champions?: Array<{ id: string; name?: string }> }>(championsIndexPath),
    readJson<{ data?: Record<string, { name?: string }> }>(itemPath),
    readJson<RunesReforgedData>(runesPath),
  ]);

  if (!championsData?.champions || !itemData?.data || !runesData) {
    return null;
  }

  return buildGameDataIndexes(championsData.champions, itemData.data, runesData);
}

function mergeGameDataIndexes(target: GameDataIndexes, source: GameDataIndexes): void {
  for (const id of source.championIds) {
    target.championIds.add(id);
  }
  for (const [key, value] of source.championSlugToId) {
    target.championSlugToId.set(key, value);
  }
  for (const [key, value] of source.itemNameToId) {
    target.itemNameToId.set(key, value);
  }
  for (const [key, value] of source.itemPatchSlugToId) {
    target.itemPatchSlugToId.set(key, value);
  }
  for (const [key, value] of source.runeKeyToId) {
    target.runeKeyToId.set(key, value);
  }
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

    const indexes = await buildIndexesFromRoot(langDir);
    if (!indexes) continue;

    for (const secondaryLang of SECONDARY_LANGS) {
      const secondaryDir = join(root, version, secondaryLang);
      if (!existsSync(secondaryDir)) continue;
      const secondaryIndexes = await buildIndexesFromRoot(secondaryDir);
      if (secondaryIndexes) {
        mergeGameDataIndexes(indexes, secondaryIndexes);
      }
    }

    logger.debug({ version, root }, 'Loaded game data indexes for entity id enrichment');
    return indexes;
  }

  logger.debug({ version }, 'Game data indexes not available for entity id enrichment');
  return null;
}
