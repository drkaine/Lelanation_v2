/**
 * Publish scraped patch notes to frontend/public/data/patch-notes.
 * Moves files from backend → frontend (copy + delete backend), like Community Dragon.
 * Frontend keeps all published patch versions; backend only holds data until transfer.
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { createCronLogger } from '../utils/cronLogger.js';

export type PatchNotesIndexEntry = {
  version: string;
  scrapedAt: string;
  locales: Array<'en-GB' | 'fr-FR'>;
  files: {
    'en-GB'?: string;
    'fr-FR'?: string;
    summary: {
      'en-GB'?: string;
      'fr-FR'?: string;
    };
  };
};

export type PatchNotesIndex = {
  updatedAt: string;
  latest: string | null;
  patches: PatchNotesIndexEntry[];
};

const PATCH_FILE_RE = /^patch-(\d+\.\d+)-(en-GB|fr-FR)(?:-summary)?\.(json|png|jpe?g|webp)$/i;

function getBackendPatchesDir(): string {
  const fromEnv = process.env.PATCH_OUTPUT_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), 'data', 'patches');
}

function getFrontendPatchNotesDir(): string {
  const fromEnv = process.env.PATCH_FRONTEND_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), '..', 'frontend', 'public', 'data', 'patch-notes');
}

function comparePatchVersions(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  if (aMajor !== bMajor) return bMajor - aMajor;
  return bMinor - aMinor;
}

function parsePatchFilename(filename: string): {
  version: string;
  locale: 'en-GB' | 'fr-FR';
  kind: 'json' | 'summary';
} | null {
  const match = filename.match(PATCH_FILE_RE);
  if (!match) return null;

  const ext = match[3].toLowerCase();
  return {
    version: match[1],
    locale: match[2] as 'en-GB' | 'fr-FR',
    kind: ext === 'json' ? 'json' : 'summary',
  };
}

async function listPatchFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function buildIndexFromFiles(files: string[], scrapedAtByVersion: Map<string, string>): PatchNotesIndex {
  const byVersion = new Map<string, PatchNotesIndexEntry>();

  for (const filename of files) {
    const parsed = parsePatchFilename(filename);
    if (!parsed) continue;

    if (!byVersion.has(parsed.version)) {
      byVersion.set(parsed.version, {
        version: parsed.version,
        scrapedAt: scrapedAtByVersion.get(parsed.version) ?? new Date().toISOString(),
        locales: [],
        files: { summary: {} },
      });
    }

    const entry = byVersion.get(parsed.version)!;

    if (parsed.kind === 'json') {
      entry.files[parsed.locale] = filename;
      if (!entry.locales.includes(parsed.locale)) {
        entry.locales.push(parsed.locale);
      }
    } else {
      entry.files.summary[parsed.locale] = filename;
    }
  }

  const patches = [...byVersion.values()]
    .filter((p) => p.files['en-GB'] || p.files['fr-FR'])
    .sort((a, b) => comparePatchVersions(a.version, b.version));

  return {
    updatedAt: new Date().toISOString(),
    latest: patches[0]?.version ?? null,
    patches,
  };
}

async function readScrapedAtFromJson(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as { scrapedAt?: string };
    return typeof data.scrapedAt === 'string' ? data.scrapedAt : null;
  } catch {
    return null;
  }
}

/**
 * Move patch files for a version from backend to frontend (copy + delete backend).
 */
export async function movePatchVersionToFrontend(
  patchVersion: string,
  cronName: string = 'patchNotesPublish'
): Promise<{ moved: number; deleted: number; frontendDir: string }> {
  const log = createCronLogger(cronName);
  const backendDir = getBackendPatchesDir();
  const frontendDir = getFrontendPatchNotesDir();
  const prefix = `patch-${patchVersion}-`;

  await fs.mkdir(frontendDir, { recursive: true });

  const backendFiles = await listPatchFiles(backendDir);
  const toMove = backendFiles.filter((f) => f.startsWith(prefix));

  let moved = 0;
  let deleted = 0;

  for (const filename of toMove) {
    const source = join(backendDir, filename);
    const target = join(frontendDir, filename);
    await fs.copyFile(source, target);
    moved++;
    await fs.unlink(source);
    deleted++;
  }

  await log.info('Patch notes moved to frontend', { patchVersion, moved, deleted, frontendDir });
  return { moved, deleted, frontendDir };
}

/** @deprecated Use movePatchVersionToFrontend */
export async function copyPatchVersionToFrontend(
  patchVersion: string,
  cronName: string = 'patchNotesPublish'
): Promise<{ copied: number; frontendDir: string }> {
  const result = await movePatchVersionToFrontend(patchVersion, cronName);
  return { copied: result.moved, frontendDir: result.frontendDir };
}

/**
 * Delete all backend patch files for a version (after successful move).
 */
export async function deleteBackendPatchVersion(patchVersion: string): Promise<number> {
  const backendDir = getBackendPatchesDir();
  const prefix = `patch-${patchVersion}-`;
  const backendFiles = await listPatchFiles(backendDir);
  let deleted = 0;

  for (const filename of backendFiles.filter((f) => f.startsWith(prefix))) {
    await fs.unlink(join(backendDir, filename));
    deleted++;
  }

  return deleted;
}

/**
 * Rebuild index.json from all patch files present in frontend directory.
 */
export async function rebuildPatchNotesIndex(
  frontendDir: string = getFrontendPatchNotesDir()
): Promise<PatchNotesIndex> {
  await fs.mkdir(frontendDir, { recursive: true });

  const files = await listPatchFiles(frontendDir);
  const scrapedAtByVersion = new Map<string, string>();

  for (const filename of files) {
    const parsed = parsePatchFilename(filename);
    if (!parsed || parsed.kind !== 'json') continue;

    const scrapedAt = await readScrapedAtFromJson(join(frontendDir, filename));
    if (scrapedAt) {
      scrapedAtByVersion.set(parsed.version, scrapedAt);
    }
  }

  const index = buildIndexFromFiles(files, scrapedAtByVersion);
  await fs.writeFile(join(frontendDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  return index;
}

/**
 * Move a patch version to frontend and refresh index.json.
 */
export async function publishPatchNotesToFrontend(
  patchVersion: string,
  cronName: string = 'patchNotesPublish'
): Promise<{ moved: number; deleted: number; index: PatchNotesIndex }> {
  const { moved, deleted, frontendDir } = await movePatchVersionToFrontend(patchVersion, cronName);
  const index = await rebuildPatchNotesIndex(frontendDir);
  return { moved, deleted, index };
}

/**
 * Move all backend patch files to frontend (e.g. manual recovery).
 */
export async function publishAllPatchNotesToFrontend(
  cronName: string = 'patchNotesPublish'
): Promise<{ moved: number; deleted: number; index: PatchNotesIndex }> {
  const log = createCronLogger(cronName);
  const backendDir = getBackendPatchesDir();
  const frontendDir = getFrontendPatchNotesDir();

  await fs.mkdir(frontendDir, { recursive: true });

  const backendFiles = await listPatchFiles(backendDir);
  let moved = 0;
  let deleted = 0;

  for (const filename of backendFiles) {
    if (!parsePatchFilename(filename)) continue;
    await fs.copyFile(join(backendDir, filename), join(frontendDir, filename));
    moved++;
    await fs.unlink(join(backendDir, filename));
    deleted++;
  }

  const index = await rebuildPatchNotesIndex(frontendDir);
  await log.info('All patch notes moved to frontend', { moved, deleted, latest: index.latest, frontendDir });
  return { moved, deleted, index };
}

export { getBackendPatchesDir, getFrontendPatchNotesDir, basename };
