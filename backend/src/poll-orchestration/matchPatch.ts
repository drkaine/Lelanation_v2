import type { MatchDto } from '../riot-gateway/routes/dto.js';

export function extractPatchFromMatch(match: MatchDto, fallbackPatch: string): string {
  const version = String(match.info?.gameVersion ?? '');
  const parts = version.split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return fallbackPatch;
}

export function gameDateFromMatch(match: MatchDto): string {
  const ts =
    Number(match.info?.gameStartTimestamp ?? 0) ||
    Number(match.info?.gameCreation ?? 0) ||
    Date.now();
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}
