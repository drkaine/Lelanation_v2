/**
 * Rafraîchit les fixtures de référence `data/api-riot/*.json` une fois par patch
 * (match récent du patch courant + league-exp + liste de matchs).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { riotConfig } from '../riot-gateway/config/riotConfig.js';
import { riotFetch } from '../riot-gateway/http/undiciClient.js';
import type { LeagueEntryDto, MatchDto, TimelineDto } from '../riot-gateway/routes/dto.js';
import { PatchResolver } from '../poll-orchestration/PatchResolver.js';
import { normalizeGamePatchKey } from './VersionService.js';

const FIXTURES_DIR = join(process.cwd(), 'data', 'api-riot');
const STATE_PATH = join(FIXTURES_DIR, '.fixtures-refresh-state.json');
const PLATFORM = 'euw1';
const REGIONAL_URL = 'https://europe.api.riotgames.com';
const PLATFORM_URL = `https://${PLATFORM}.api.riotgames.com`;
const RANKED_SOLO_QUEUE = 420;

type FixturesRefreshState = {
  lastRefreshedPatch: string;
  refreshedAt: string;
  matchId?: string;
};

export type RefreshApiRiotFixturesResult = {
  refreshed: boolean;
  reason?: string;
  patch?: string;
  matchId?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function gameVersionMatchesPatch(gameVersion: string, patchLabel: string): boolean {
  const gv = String(gameVersion ?? '').trim();
  const patch = normalizeGamePatchKey(patchLabel);
  if (!gv || !patch) return false;
  return gv === patch || gv.startsWith(`${patch}.`);
}

async function readRefreshState(): Promise<FixturesRefreshState | null> {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as FixturesRefreshState;
    if (!parsed?.lastRefreshedPatch) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeRefreshState(state: FixturesRefreshState): Promise<void> {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function writeJsonFixture(fileName: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload, null, 4);
  await writeFile(join(FIXTURES_DIR, fileName), `${body}\n`, 'utf8');
}

async function fetchLeagueExpPage(): Promise<LeagueEntryDto[]> {
  const { body, statusCode } = await riotFetch(PLATFORM_URL, '/lol/league-exp/v4/entries/RANKED_SOLO_5x5/CHALLENGER/I', {
    page: 1,
  });
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`league_exp_http_${statusCode}`);
  }
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('league_exp_empty');
  }
  return body as LeagueEntryDto[];
}

async function fetchMatchIdsForPuuid(
  puuid: string,
  startTime: number,
  endTime: number,
): Promise<string[]> {
  const { body, statusCode } = await riotFetch(
    REGIONAL_URL,
    `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
    {
      queue: RANKED_SOLO_QUEUE,
      type: 'ranked',
      start: 0,
      count: 20,
      startTime,
      endTime,
    },
  );
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`match_ids_http_${statusCode}`);
  }
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('match_ids_empty');
  }
  return body.map((id) => String(id));
}

async function fetchMatch(matchId: string): Promise<MatchDto> {
  const { body, statusCode } = await riotFetch(
    REGIONAL_URL,
    `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
  );
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`match_http_${statusCode}`);
  }
  return body as MatchDto;
}

async function fetchTimeline(matchId: string): Promise<TimelineDto> {
  const { body, statusCode } = await riotFetch(
    REGIONAL_URL,
    `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
  );
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`timeline_http_${statusCode}`);
  }
  return body as TimelineDto;
}

async function resolveMatchIdForPatch(matchIds: string[], patchLabel: string): Promise<string> {
  for (const matchId of matchIds) {
    const match = await fetchMatch(matchId);
    const gameVersion = String(match.info?.gameVersion ?? '');
    if (gameVersionMatchesPatch(gameVersion, patchLabel)) {
      return matchId;
    }
    await sleep(120);
  }
  return matchIds[0]!;
}

function resolvePatchStartTimestamp(patchLabel: string): number {
  try {
    return PatchResolver.getPatchByName(patchLabel).startTimestamp;
  } catch {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() - 14);
    fallback.setUTCHours(0, 0, 0, 0);
    return Math.floor(fallback.getTime() / 1000);
  }
}

/**
 * Télécharge et remplace les 4 fixtures si le patch (major.minor) n'a pas encore été traité.
 */
export async function refreshApiRiotFixturesOnPatchChange(
  patchLabel: string,
): Promise<RefreshApiRiotFixturesResult> {
  const patch = normalizeGamePatchKey(patchLabel);
  if (!patch) {
    return { refreshed: false, reason: 'invalid_patch' };
  }

  if (!riotConfig.apiKey?.startsWith('RGAPI-')) {
    return { refreshed: false, reason: 'missing_api_key', patch };
  }

  const previous = await readRefreshState();
  if (previous?.lastRefreshedPatch === patch) {
    return { refreshed: false, reason: 'already_refreshed_for_patch', patch };
  }

  const leagueEntries = await fetchLeagueExpPage();
  await sleep(120);

  const puuid = String(leagueEntries[0]?.puuid ?? '').trim();
  if (!puuid) {
    throw new Error('league_exp_missing_puuid');
  }

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = resolvePatchStartTimestamp(patch);
  const matchIds = await fetchMatchIdsForPuuid(puuid, startTime, endTime);
  await sleep(120);

  const matchId = await resolveMatchIdForPatch(matchIds, patch);
  const match = await fetchMatch(matchId);
  await sleep(120);
  const timeline = await fetchTimeline(matchId);

  await writeJsonFixture('league-exp.json', {
    route: '/lol/league-exp/v4/entries/{queue}/{tier}/{division}',
    args: {
      queue: 'RANKED_SOLO_5x5',
      tier: 'CHALLENGER',
      division: 'I',
      page: '1',
      riotRegion: PLATFORM,
    },
    response: leagueEntries,
  });

  await writeJsonFixture('matchs-list.json', {
    route: '/lol/match/v5/matches/by-puuid/{puuid}/ids',
    args: {
      puuid,
      queue: String(RANKED_SOLO_QUEUE),
      count: String(matchIds.length),
      start: '0',
      startTime: String(startTime),
      endTime: String(endTime),
      type: String(RANKED_SOLO_QUEUE),
      riotRegion: PLATFORM,
    },
    response: matchIds,
  });

  await writeJsonFixture('match-id.json', {
    route: '/lol/match/v5/matches/{matchId}',
    args: {
      matchId,
      riotRegion: PLATFORM,
    },
    metadata: match.metadata ?? {},
    info: match.info ?? {},
  });

  await writeJsonFixture('timeline.json', {
    route: '/lol/match/v5/matches/{matchId}/timeline',
    args: {
      matchId,
      riotRegion: PLATFORM,
    },
    metadata: timeline.metadata ?? {},
    info: timeline.info ?? {},
  });

  await writeRefreshState({
    lastRefreshedPatch: patch,
    refreshedAt: new Date().toISOString(),
    matchId,
  });

  return { refreshed: true, patch, matchId };
}
