import { riotConfig } from '../riot-gateway/config/riotConfig.js';
import { PatchResolver } from './PatchResolver.js';
import type { PlayerDiscovery } from './PlayerDiscovery.js';
import type { LastSeenStats } from './types.js';
import { orchestrationLogger } from './logger.js';

export type SinceMode = 'personal_24h' | 'prod_patch' | 'prod_full_history';

export interface ResolvedSince {
  sinceTimestamp: number;
  mode: SinceMode;
  reason: string;
  oldestLastSeen: Date | null;
  neverSeenCount: number;
  fullHistoryStartDate: string | null;
}

function parseFullHistoryStart(raw: string): { ts: number; date: string } {
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid FULL_HISTORY_SINCE_DATE: "${raw}". Expected format: YYYY-MM-DD`);
  }
  return { ts: Math.floor(parsed.getTime() / 1000), date: raw };
}

export class SinceTimestampResolver {
  private readonly twentyFourHoursMs = 24 * 60 * 60 * 1000;
  private readonly fullHistoryStartTs: number;
  private readonly fullHistoryStartDate: string;

  constructor(private readonly playerDiscovery: PlayerDiscovery) {
    const raw = process.env.FULL_HISTORY_SINCE_DATE ?? '2026-01-08';
    const parsed = parseFullHistoryStart(raw);
    this.fullHistoryStartTs = parsed.ts;
    this.fullHistoryStartDate = parsed.date;
  }

  static parseFullHistoryStartDate(raw: string): number {
    return parseFullHistoryStart(raw).ts;
  }

  async resolve(): Promise<ResolvedSince> {
    if (riotConfig.apiKeyType === 'personal') {
      const sinceTs = Math.floor((Date.now() - this.twentyFourHoursMs) / 1000);
      const result: ResolvedSince = {
        sinceTimestamp: sinceTs,
        mode: 'personal_24h',
        reason: 'personal key — last 24h only',
        oldestLastSeen: null,
        neverSeenCount: 0,
        fullHistoryStartDate: null,
      };
      this.log(result);
      return result;
    }

    const stats = await this.playerDiscovery.getOldestLastSeenStats();
    return this.resolveProduction(stats);
  }

  resolveProduction(stats: LastSeenStats): ResolvedSince {
    const now = Date.now();
    const cutoff = now - this.twentyFourHoursMs;
    const { oldestLastSeen, neverSeenCount } = stats;

    const allCaughtUp =
      neverSeenCount === 0 &&
      oldestLastSeen !== null &&
      oldestLastSeen.getTime() > cutoff;

    if (allCaughtUp) {
      const result: ResolvedSince = {
        sinceTimestamp: this.fullHistoryStartTs,
        mode: 'prod_full_history',
        reason: `all players polled within 24h — fetching since ${this.fullHistoryStartDate}`,
        oldestLastSeen,
        neverSeenCount: 0,
        fullHistoryStartDate: this.fullHistoryStartDate,
      };
      this.log(result);
      return result;
    }

    const patchStart = PatchResolver.getCurrentPatchStartTimestamp();
    const result: ResolvedSince = {
      sinceTimestamp: patchStart,
      mode: 'prod_patch',
      reason:
        neverSeenCount > 0
          ? `${neverSeenCount} players never polled — current patch only`
          : `oldest last_seen ${this.formatAge(oldestLastSeen)} ago — still catching up`,
      oldestLastSeen,
      neverSeenCount,
      fullHistoryStartDate: null,
    };
    this.log(result);
    return result;
  }

  private log(result: ResolvedSince): void {
    const payload = {
      component: 'SinceTimestampResolver',
      mode: result.mode,
      since: new Date(result.sinceTimestamp * 1000).toISOString(),
      reason: result.reason,
      oldestLastSeen: result.oldestLastSeen?.toISOString() ?? null,
      neverSeenCount: result.neverSeenCount,
    };
    if (result.mode === 'prod_full_history') {
      orchestrationLogger.info(payload, 'since timestamp resolved');
    } else {
      orchestrationLogger.debug(payload, 'since timestamp resolved');
    }
  }

  private formatAge(date: Date | null): string {
    if (!date) return 'unknown';
    const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000);
    if (diffH < 24) return `${diffH}h`;
    return `${Math.floor(diffH / 24)}d`;
  }
}
