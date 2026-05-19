/** @deprecated Archive checkpoint removed — single partitioned statistiques DB. */
export async function runLiveAggArchiveCheckpointCronOnce(): Promise<{ ok: boolean; skipped: true }> {
  return { ok: true, skipped: true }
}

export function setupLiveAggArchiveCheckpoint(): void {
  /* no-op */
}
