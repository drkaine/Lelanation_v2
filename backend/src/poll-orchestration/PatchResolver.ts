import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  comparePatchLabelsAsc,
  getPatchFromVersion,
  loadCurrentGameVersion,
  releaseDateToStartOfDayUtcSeconds,
  type GameVersionRecapEntry,
  type GameVersionsRecap,
} from '../services/RiotConfigService.js';
import { orchestrationLogger } from './logger.js';

export interface PatchInfo {
  patch: string;
  startDate: string;
  endDate: string | null;
  startTimestamp: number;
  endTimestamp: number | null;
}

const VERSIONS_PATH = join(process.cwd(), 'data', 'game', 'versions.json');

function readRecap(): GameVersionsRecap {
  const raw = readFileSync(VERSIONS_PATH, 'utf8');
  const data = JSON.parse(raw) as GameVersionsRecap;
  if (!data?.versions?.length) {
    throw new Error('versions.json: missing or invalid versions');
  }
  return data;
}

function entryToPatchInfo(entry: GameVersionRecapEntry, endDate: string | null): PatchInfo {
  const patch = (entry.patchLabel ?? getPatchFromVersion(entry.version)).trim();
  const startDate = entry.releaseDate.trim();
  const startTimestamp = releaseDateToStartOfDayUtcSeconds(startDate);
  if (!Number.isFinite(startTimestamp)) {
    throw new Error(`versions.json: invalid releaseDate for patch ${patch}`);
  }
  const endTimestamp = endDate ? releaseDateToStartOfDayUtcSeconds(endDate) : null;
  return { patch, startDate, endDate, startTimestamp, endTimestamp };
}

export class PatchResolver {
  static getAllPatches(): PatchInfo[] {
    const recap = readRecap();
    const sorted = [...recap.versions].sort((a, b) =>
      comparePatchLabelsAsc((b.patchLabel ?? '').trim(), (a.patchLabel ?? '').trim()),
    );
    return sorted.map((entry, index) => {
      const newer = sorted[index - 1];
      const endDate = newer?.releaseDate ?? null;
      return entryToPatchInfo(entry, endDate);
    });
  }

  static getCurrentPatch(): PatchInfo {
    const patches = PatchResolver.getAllPatches();
    const current = patches.find((p) => p.endDate === null) ?? patches[0];
    if (!current) {
      throw new Error('versions.json: no current patch found');
    }

    const ageDays = (Date.now() / 1000 - current.startTimestamp) / 86400;
    if (ageDays > 30) {
      orchestrationLogger.warn(
        { component: 'PatchResolver', patch: current.patch, startDate: current.startDate, ageDays: Math.floor(ageDays) },
        'current patch startDate is more than 30 days ago — versions.json may be stale',
      );
    }

    return current;
  }

  static getPatchByName(patch: string): PatchInfo {
    const found = PatchResolver.getAllPatches().find((p) => p.patch === patch.trim());
    if (!found) {
      throw new Error(`versions.json: patch not found: ${patch}`);
    }
    return found;
  }

  static getCurrentPatchStartTimestamp(): number {
    return PatchResolver.getCurrentPatch().startTimestamp;
  }

  /** Async helper: prefer version.json current patch label when available. */
  static async resolveCurrentPatchInfo(): Promise<PatchInfo> {
    const versionRes = await loadCurrentGameVersion();
    if (versionRes.isOk() && versionRes.unwrap()?.currentVersion) {
      const label = getPatchFromVersion(versionRes.unwrap()!.currentVersion);
      try {
        return PatchResolver.getPatchByName(label);
      } catch {
        orchestrationLogger.warn({ component: 'PatchResolver', label }, 'patch not in versions.json, using newest entry');
      }
    }
    return PatchResolver.getCurrentPatch();
  }
}
