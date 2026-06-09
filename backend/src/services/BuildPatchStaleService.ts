import { promises as fs } from 'fs';
import { join } from 'path';
import type { PatchStaleInfo, RuneSelection, StoredBuild } from '@lelanation/shared-types';
import type { EntityCategory, EntityChanges, PatchJson } from '../scraper/types.js';
import { FileManager } from '../utils/fileManager.js';
import { createCronLogger } from '../utils/cronLogger.js';
import {
  comparePatchVersions,
  getFrontendPatchNotesDir,
  rebuildPatchNotesIndex,
  type PatchNotesIndex,
} from './PatchNotesPublishService.js';
import { enrichEntityIds } from '../scraper/entityIds.js';
import { loadGameDataIndexes } from '../scraper/gameDataLoader.js';
import { normalizeGamePatchKey } from './VersionService.js';

const PATCH_AFFECTED_CATEGORIES = new Set<EntityCategory>(['champion', 'item', 'rune']);

export type PatchEntityBuckets = {
  champions: Set<string>;
  items: Set<string>;
  runes: Set<string>;
};

export type PatchAffectedByVersion = Map<string, PatchEntityBuckets>;

export type BuildPatchStaleMode = 'all' | 'latest';

export type FlagBuildsPatchStaleOptions = {
  mode: BuildPatchStaleMode;
  patchVersion?: string;
  buildsDir?: string;
  patchNotesDir?: string;
  cronName?: string;
};

export type FlagBuildsPatchStaleResult = {
  scanned: number;
  flagged: number;
  cleared: number;
  unchanged: number;
  patchVersions: string[];
};

type BuildLoadout = {
  championId?: string;
  itemIds: string[];
  runeIds: string[];
};

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function extractRuneIds(runes: RuneSelection | null | undefined): string[] {
  if (!runes) return [];

  const raw = [
    runes.primary?.keystone,
    runes.primary?.slot1,
    runes.primary?.slot2,
    runes.primary?.slot3,
    runes.secondary?.slot1,
    runes.secondary?.slot2,
  ];

  return raw
    .map((id) => normalizeId(id))
    .filter((id) => id.length > 0);
}

function extractBuildLoadout(build: StoredBuild): BuildLoadout {
  const championId = build.champion?.id ? normalizeId(build.champion.id) : undefined;
  const itemIds = (build.items ?? []).map((item) => normalizeId(item.id)).filter(Boolean);
  const runeIds = extractRuneIds(build.runes);

  for (const subBuild of build.subBuilds ?? []) {
    if (subBuild.champion?.id) {
      // Sub-builds inherit parent champion in UI; only merge items/runes.
    }
    itemIds.push(...(subBuild.items ?? []).map((item) => normalizeId(item.id)).filter(Boolean));
    runeIds.push(...extractRuneIds(subBuild.runes));
  }

  return {
    championId,
    itemIds: [...new Set(itemIds)],
    runeIds: [...new Set(runeIds)],
  };
}

function createEmptyBuckets(): PatchEntityBuckets {
  return {
    champions: new Set<string>(),
    items: new Set<string>(),
    runes: new Set<string>(),
  };
}

function addEntityToBuckets(buckets: PatchEntityBuckets, entity: EntityChanges): void {
  const id = normalizeId(entity.id);
  if (!id) return;

  if (entity.category === 'champion') buckets.champions.add(id);
  if (entity.category === 'item') buckets.items.add(id);
  if (entity.category === 'rune') buckets.runes.add(id);
}

export function extractPatchEntityBuckets(entities: EntityChanges[]): PatchEntityBuckets {
  const buckets = createEmptyBuckets();

  for (const entity of entities) {
    if (!PATCH_AFFECTED_CATEGORIES.has(entity.category)) continue;
    addEntityToBuckets(buckets, entity);
  }

  return buckets;
}

export function evaluateBuildAgainstPatchBuckets(
  build: StoredBuild,
  buckets: PatchEntityBuckets
): PatchStaleInfo | null {
  const loadout = extractBuildLoadout(build);
  const categories = new Set<PatchStaleInfo['categories'][number]>();

  if (loadout.championId && buckets.champions.has(loadout.championId)) {
    categories.add('champion');
  }

  if (loadout.itemIds.some((id) => buckets.items.has(id))) {
    categories.add('item');
  }

  if (loadout.runeIds.some((id) => buckets.runes.has(id))) {
    categories.add('rune');
  }

  if (categories.size === 0) return null;

  return {
    patchVersion: '',
    flaggedAt: new Date().toISOString(),
    categories: [...categories],
  };
}

/** Only flag when the build was saved on a patch strictly older than the patch note. */
export function shouldConsiderPatchForBuild(build: StoredBuild, patchVersion: string): boolean {
  const buildPatch = normalizeGamePatchKey(build.gameVersion ?? '');
  if (!buildPatch) return true;
  return comparePatchVersions(buildPatch, patchVersion) > 0;
}

/**
 * Latest-patch mode: add stale flags for newly impacted builds only.
 * Never clears or overwrites builds already marked patchStale.
 */
export function resolveLatestPatchStaleFlag(
  build: StoredBuild,
  previous: PatchStaleInfo | null,
  buckets: PatchEntityBuckets,
  latestPatchVersion: string
): PatchStaleInfo | null {
  if (previous) return previous;

  const latestMatch = evaluateBuildAgainstPatchBuckets(build, buckets);
  if (latestMatch && shouldConsiderPatchForBuild(build, latestPatchVersion)) {
    return { ...latestMatch, patchVersion: latestPatchVersion };
  }

  return null;
}

export function resolveLatestMatchingPatchVersion(
  build: StoredBuild,
  affectedByVersion: PatchAffectedByVersion,
  patchVersionsDesc: string[]
): PatchStaleInfo | null {
  for (const patchVersion of patchVersionsDesc) {
    if (!shouldConsiderPatchForBuild(build, patchVersion)) continue;

    const buckets = affectedByVersion.get(patchVersion);
    if (!buckets) continue;

    const match = evaluateBuildAgainstPatchBuckets(build, buckets);
    if (match) {
      return { ...match, patchVersion };
    }
  }

  return null;
}

export async function loadPatchJson(
  patchNotesDir: string,
  patchVersion: string,
  locale: 'en-GB' | 'fr-FR' = 'en-GB'
): Promise<PatchJson | null> {
  const filePath = join(patchNotesDir, patchVersion, `patch-${patchVersion}-${locale}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as PatchJson;
  } catch {
    return null;
  }
}

export async function loadPatchAffectedByVersion(
  patchVersions: string[],
  patchNotesDir: string = getFrontendPatchNotesDir()
): Promise<PatchAffectedByVersion> {
  const affectedByVersion: PatchAffectedByVersion = new Map();
  const gameIndexes = await loadGameDataIndexes();

  for (const patchVersion of patchVersions) {
    const patch = await loadPatchJson(patchNotesDir, patchVersion);
    if (!patch?.entities) continue;

    const entities = gameIndexes
      ? enrichEntityIds(patch.entities, gameIndexes)
      : patch.entities;

    affectedByVersion.set(patchVersion, extractPatchEntityBuckets(entities));
  }

  return affectedByVersion;
}

function patchVersionsDesc(index: PatchNotesIndex, selected: string[]): string[] {
  const known = new Set(index.patches.map((entry) => entry.version));
  return [...selected]
    .filter((version) => known.has(version))
    .sort((a, b) => comparePatchVersions(b, a));
}

function isSamePatchStale(a: PatchStaleInfo | null | undefined, b: PatchStaleInfo | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.patchVersion === b.patchVersion &&
    a.categories.join(',') === b.categories.join(',')
  );
}

async function listBuildFiles(buildsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(buildsDir);
    return entries.filter(
      (name) =>
        name.endsWith('.json') &&
        name !== 'engagement.json' &&
        /^[0-9a-f-]{36}(?:_priv)?\.json$/i.test(name)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function flagBuildsPatchStale(
  options: FlagBuildsPatchStaleOptions
): Promise<FlagBuildsPatchStaleResult> {
  const log = createCronLogger(options.cronName ?? 'buildPatchStale');
  const buildsDir = options.buildsDir ?? join(process.cwd(), 'data', 'builds');
  const patchNotesDir = options.patchNotesDir ?? getFrontendPatchNotesDir();
  const index = await rebuildPatchNotesIndex(patchNotesDir);

  const allVersions = index.patches.map((entry) => entry.version);
  const targetVersions =
    options.mode === 'all'
      ? allVersions
      : [options.patchVersion ?? index.latest].filter((version): version is string => Boolean(version));

  if (targetVersions.length === 0) {
    await log.warn('No patch versions available for build patch stale flagging');
    return { scanned: 0, flagged: 0, cleared: 0, unchanged: 0, patchVersions: [] };
  }

  const affectedByVersion = await loadPatchAffectedByVersion(targetVersions, patchNotesDir);
  const versionsDesc = patchVersionsDesc(index, targetVersions);
  const latestOnlyVersion = options.mode === 'latest' ? targetVersions[0] : null;
  const latestBuckets =
    latestOnlyVersion && affectedByVersion.has(latestOnlyVersion)
      ? affectedByVersion.get(latestOnlyVersion)!
      : null;

  const buildFiles = await listBuildFiles(buildsDir);
  let scanned = 0;
  let flagged = 0;
  let cleared = 0;
  let unchanged = 0;

  for (const fileName of buildFiles) {
    const filePath = join(buildsDir, fileName);
    const readResult = await FileManager.readJson<StoredBuild & { fileName?: string; savedAt?: string }>(
      filePath
    );
    if (readResult.isErr()) continue;

    scanned++;
    const build = readResult.unwrap();
    const previous = build.patchStale ?? null;

    let next: PatchStaleInfo | null = null;

    if (options.mode === 'all') {
      next = resolveLatestMatchingPatchVersion(build, affectedByVersion, versionsDesc);
    } else if (latestBuckets && latestOnlyVersion) {
      next = resolveLatestPatchStaleFlag(build, previous, latestBuckets, latestOnlyVersion);
    }

    if (isSamePatchStale(previous, next)) {
      unchanged++;
      continue;
    }

    const updated = {
      ...build,
      patchStale: next,
      savedAt: build.savedAt,
      fileName: build.fileName ?? fileName,
    };

    const writeResult = await FileManager.writeJson(filePath, updated);
    if (writeResult.isErr()) {
      await log.warn('Failed to update build patch stale flag', { buildId: build.id, fileName });
      unchanged++;
      continue;
    }

    if (next) flagged++;
    else cleared++;
  }

  await log.info('Build patch stale flagging complete', {
    mode: options.mode,
    patchVersions: targetVersions,
    scanned,
    flagged,
    cleared,
    unchanged,
  });

  return { scanned, flagged, cleared, unchanged, patchVersions: targetVersions };
}
