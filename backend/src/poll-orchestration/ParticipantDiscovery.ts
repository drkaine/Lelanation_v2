import { sql } from '../db/client.js';
import { parsePlatformFromMatchId } from '../poller/utils/parseMatchId.js';
import { normalizePlatformRegion } from '../riot/platform-region.js';
import type { MatchDto } from '../riot-gateway/routes/dto.js';
import { orchestrationLogger } from './logger.js';

function getPlayerKeyVersion(): string {
  return process.env.PLAYER_KEY_VERSION || process.env.ENV || 'dev';
}

export interface ParticipantInfo {
  puuid: string;
  region: string;
  gameName?: string;
  tagName?: string;
}

export class ParticipantDiscovery {
  extractFromMatch(matchId: string, match: MatchDto): ParticipantInfo[] {
    let region: string;
    try {
      region = normalizePlatformRegion(parsePlatformFromMatchId(matchId));
    } catch {
      region = normalizePlatformRegion(String(match.info?.platformId ?? 'euw1'));
    }

    const result: ParticipantInfo[] = [];
    for (const participant of match.info?.participants ?? []) {
      const puuid = String(participant.puuid ?? '').trim();
      if (!puuid) continue;
      const gameName = String(
        (participant as { riotIdGameName?: string; summonerName?: string }).riotIdGameName ??
          (participant as { summonerName?: string }).summonerName ??
          '',
      ).trim();
      const tagName = String(
        (participant as { riotIdTagline?: string; tagLine?: string }).riotIdTagline ??
          (participant as { tagLine?: string }).tagLine ??
          '',
      ).trim();
      result.push({
        puuid,
        region,
        gameName: gameName || undefined,
        tagName: tagName || undefined,
      });
    }
    return result;
  }

  async upsertParticipants(participants: ParticipantInfo[]): Promise<number> {
    const deduped = new Map<string, ParticipantInfo>();
    for (const participant of participants) {
      if (participant.puuid) deduped.set(participant.puuid, participant);
    }
    const rows = [...deduped.values()];
    if (rows.length === 0) return 0;

    const puuids = rows.map((r) => r.puuid);
    const regions = rows.map((r) => normalizePlatformRegion(r.region));

    const inserted = await sql<{ puuid: string }[]>`
      INSERT INTO players (puuid, region, puuid_key_version, last_seen, updated_at)
      SELECT x.puuid, x.region::lol_region, ${getPlayerKeyVersion()}, NOW(), NOW()
      FROM UNNEST(
        ${sql.array(puuids, 25)}::text[],
        ${sql.array(regions, 25)}::text[]
      ) AS x(puuid, region)
      ON CONFLICT (puuid) DO NOTHING
      RETURNING puuid
    `;

    if (inserted.length > 0) {
      orchestrationLogger.info(
        { component: 'ParticipantDiscovery', count: inserted.length },
        'new players discovered',
      );
    }

    return inserted.length;
  }
}
