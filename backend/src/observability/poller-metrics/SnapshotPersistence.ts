import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { pollerMetricsLogger } from './logger.js';
import type { FullSnapshot, WindowLabel } from './types.js';

function resolvePrimarySnapshotPath(filePath: string): string {
  const trimmed = filePath.trim();
  if (isAbsolute(trimmed)) return trimmed;
  return resolve(trimmed);
}

/** Mirror path for admin API (`logs/poller-observability.json` at project root). */
function resolveMirrorSnapshotPath(primaryPath: string): string | null {
  if (process.env.OBSERVABILITY_SNAPSHOT_MIRROR === '0') return null;
  const mirrorEnv = process.env.OBSERVABILITY_SNAPSHOT_MIRROR_PATH?.trim();
  if (mirrorEnv) return resolve(mirrorEnv);
  const parts = primaryPath.split(/[/\\]/);
  const backendIdx = parts.lastIndexOf('backend');
  if (backendIdx === -1) return null;
  const projectRoot = parts.slice(0, backendIdx).join('/') || join(...parts.slice(0, backendIdx));
  return join(projectRoot, 'logs', 'poller-observability.json');
}

export class SnapshotPersistence {
  private readonly filePath: string;
  private readonly mirrorPath: string | null;
  private data: Partial<Record<WindowLabel, FullSnapshot>> = {};

  constructor(filePath = process.env.OBSERVABILITY_SNAPSHOT_PATH ?? './poller-observability.json') {
    this.filePath = resolvePrimarySnapshotPath(filePath);
    this.mirrorPath = resolveMirrorSnapshotPath(this.filePath);
  }

  async load(): Promise<void> {
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw) as Partial<Record<WindowLabel, FullSnapshot>>;
      for (const [window, snapshot] of Object.entries(this.data)) {
        pollerMetricsLogger.info(
          { component: 'SnapshotPersistence', window, snapshot_ts: snapshot?.ts },
          'loaded previous observability snapshot',
        );
      }
      if (this.mirrorPath) {
        await this.writeSnapshotTarget(this.mirrorPath, JSON.stringify(this.data, null, 2), 'startup-mirror-sync');
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        pollerMetricsLogger.info({ component: 'SnapshotPersistence' }, 'no previous snapshot found, starting fresh');
        return;
      }
      pollerMetricsLogger.warn(
        { component: 'SnapshotPersistence', error: error instanceof Error ? error.message : String(error) },
        'failed to load snapshot file',
      );
    }
  }

  async save(window: WindowLabel, snapshot: FullSnapshot): Promise<void> {
    this.data[window] = snapshot;
    const payload = JSON.stringify(this.data, null, 2);
    const targets = [this.filePath, ...(this.mirrorPath ? [this.mirrorPath] : [])];
    for (const target of targets) {
      await this.writeSnapshotTarget(target, payload, window);
    }
  }

  getLatest(window: WindowLabel): FullSnapshot | null {
    return this.data[window] ?? null;
  }

  private async writeSnapshotTarget(target: string, payload: string, window: WindowLabel | 'startup-mirror-sync'): Promise<void> {
    const tmp = `${target}.tmp`;
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(tmp, payload, 'utf8');
      await rename(tmp, target);
    } catch (error) {
      pollerMetricsLogger.warn(
        {
          component: 'SnapshotPersistence',
          window,
          target,
          error: error instanceof Error ? error.message : String(error),
        },
        'failed to persist snapshot',
      );
    }
  }
}
