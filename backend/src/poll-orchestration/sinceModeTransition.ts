import type { ResolvedSince, SinceMode } from './SinceTimestampResolver.js';
import { orchestrationLogger } from './logger.js';

export function applySinceModeTransition(
  previousMode: SinceMode | null,
  resolved: ResolvedSince,
): SinceMode {
  if (resolved.mode !== previousMode) {
    orchestrationLogger.info(
      {
        component: 'discovery-loop',
        event: 'since_mode_changed',
        previousMode,
        newMode: resolved.mode,
        since: new Date(resolved.sinceTimestamp * 1000).toISOString(),
        reason: resolved.reason,
      },
      'since resolution mode changed',
    );
  }
  return resolved.mode;
}
