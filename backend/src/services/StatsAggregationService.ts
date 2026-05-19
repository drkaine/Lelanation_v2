/**
 * Legacy patch cleanup / objective refresh removed — poller-v2 writes aggregates directly.
 */
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'

type LoggerType = ReturnType<typeof createRiotPollerLogger>

/** @deprecated No-op — no `close_patch` / ingest pipeline on statistiques DB. */
export async function runPatchCleanupFromConfig(_logger?: LoggerType): Promise<void> {
  return
}

/** @deprecated No-op — `objective_outcome_histogram` filled by ingestion.worker. */
export async function refreshObjectiveOutcomeStats(_logger?: LoggerType): Promise<number> {
  return 0
}
