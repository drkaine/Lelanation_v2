import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pollerMetricsLogger } from './logger.js';
import type { FullSnapshot, WindowLabel } from './types.js';

export class SnapshotPersistence {
  private readonly filePath: string;
  private data: Partial<Record<WindowLabel, FullSnapshot>> = {};

  constructor(filePath = process.env.OBSERVABILITY_SNAPSHOT_PATH ?? './poller-observability.json') {
    this.filePath = resolve(filePath);
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
    const tmp = `${this.filePath}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      await rename(tmp, this.filePath);
    } catch (error) {
      pollerMetricsLogger.warn(
        { component: 'SnapshotPersistence', window, error: error instanceof Error ? error.message : String(error) },
        'failed to persist snapshot',
      );
    }
  }

  getLatest(window: WindowLabel): FullSnapshot | null {
    return this.data[window] ?? null;
  }
}
