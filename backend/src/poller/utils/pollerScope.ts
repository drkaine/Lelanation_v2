import type { MatchDto, TimelineDto } from '../../riot-gateway/routes/dto.js';
import type { Platform } from '../types.js';
import { parsePlatformFromMatchId, isValidMatchId } from './parseMatchId.js';

const DEFAULT_PLATFORMS: Platform[] = ['euw1', 'kr'];

/** Timeline émise à la place de la vraie pour un early FF : la requête n'est pas faite. */
export const EMPTY_TIMELINE: TimelineDto = { info: { frameInterval: 60_000, frames: [] } };

export function isEarlySurrenderMatch(match: MatchDto): boolean {
  return (match.info?.participants ?? []).some((p) => p.gameEndedInEarlySurrender === true);
}

/** Plateformes pollées (`POLLER_PLATFORMS=euw1,eun1`). Défaut : EUW1 et KR. */
export function allowedPollerPlatforms(raw: string | undefined): Platform[] {
  const platforms = String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .flatMap((s) => (s && isValidMatchId(`${s}_0`) ? [parsePlatformFromMatchId(`${s}_0`)] : []));
  return platforms.length > 0 ? platforms : DEFAULT_PLATFORMS;
}

export function filterAllowedMatchIds(matchIds: string[], platforms: Platform[]): string[] {
  const allowed = new Set(platforms);
  return matchIds.filter((id) => isValidMatchId(id) && allowed.has(parsePlatformFromMatchId(id)));
}

export function isAllowedRegion(region: string | null | undefined, platforms: Platform[]): boolean {
  const normalized = String(region ?? '').trim().toLowerCase();
  return platforms.some((p) => p === normalized);
}

export function toDbRegions(platforms: Platform[]): string[] {
  return platforms.map((p) => p.toUpperCase());
}

export const POLLER_PLATFORMS: Platform[] = allowedPollerPlatforms(process.env.POLLER_PLATFORMS);
