/**
 * Riot poller: runs inside the backend process.
 * - Init: resolves API key (any subsequent 401/403 stops the poller automatically).
 * - Loop: take players, fetch match lists, fetch full match + timeline (fill DB). Sync PUUID / key is optional via `runPhase2` (script puuid-migration only).
 * Logs to backend output (minimal mode); exposes status for admin API.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { readFile, rename, statfs, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import {
  loadMatchFilters,
  loadCurrentGameVersion,
  loadGameVersionsRecap,
  computeMatchIdsTimeWindow,
  getPollerPatchRolloutGraceDays,
  resolveLatestPatchPriorityWindow,
} from '../services/RiotConfigService.js'
import type { MatchFiltersConfig } from '../services/RiotConfigService.js'
import { getRiotAppTargetPer120s, RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { DiscordService } from '../services/DiscordService.js'
import {
  RiotHttpClient,
  resolveRiotApiKey,
  RIOT_INGEST_ABORTED_MESSAGE,
  type RiotMatchDto,
  type RiotParticipantDto,
  type RiotMatchTimelineDto,
} from '../services/RiotHttpClient.js'
import {
  isMatchIngestFileQueueEnabled,
  tryEnqueueMatchIngestPayload,
  countMatchIngestQueueFiles,
  claimOldestMatchIngestQueueFilePaths,
  type MatchIngestQueuePayloadV1,
} from './matchIngestQueue.js'
import {
  isRawIngestQueueEnabled,
  tryInsertRawIngestPayload,
  claimRawIngestRows,
  markRawIngestDone,
  markRawIngestError,
  countRawIngestByStatus,
  requeueRawIngestErrors,
  requeueRawIngestStaleProcessing,
  deleteDoneRawIngestRows,
} from './matchIngestRawQueue.js'
import { unwrapMatchIngestSkipped } from './matchIngestErrors.js'
import { resolveRiotMatchIdForIngest } from './matchIngestIds.js'
import {
  upsertIngestMatchAndParticipants,
  extractIngestTimelineExtras,
  preloadIngestLeanMatchDbData,
} from './ingestMatchLean.js'
import type { MatchIngestRankCache, MatchIngestOptions } from './matchIngestTypes.js'
import { cleanupGlobalRankCache, dequeuePriorityPuuids } from './matchIngestRankCache.js'

export type { MatchIngestDbPreload, MatchIngestRankCache, MatchIngestOptions } from './matchIngestTypes.js'


/** Mutable windows for poller_30m / poller_hourly (updated by emitPollerSummariesIfDue). */
type PollerSummaryWindows = {
  summary30mWindowStartedAtMs: number
  summary30mPlayersPolled: number
  summary30mPlayersFetched: number
  summary30mMatchesFetched: number
  summary30mMatchesApiIngestComplete: number
  summary30mPlayersRankUpdatedLeague: number
  summary30mRequestCount: number
  summary30mError429Count: number
  summary30mParticipantsFetched: number
  summary30mNearLimitPauseCount: number
  summary30mHttp429PauseCount: number
  summary30mMatchIdsFromApi: number
  summary30mExistingMatchesSkipped: number
  summary30mTimeoutCount: number
  hourlyWindowStartedAtMs: number
  hourlyPlayersPolled: number
  hourlyPlayersFetched: number
  hourlyMatchesFetched: number
  hourlyMatchesApiIngestComplete: number
  hourlyPlayersRankUpdatedLeague: number
  hourlyRequestCount: number
  hourlyError429Count: number
  hourlyParticipantsFetched: number
  hourlyNearLimitPauseCount: number
  hourlyHttp429PauseCount: number
  hourlyMatchIdsFromApi: number
  hourlyExistingMatchesSkipped: number
  hourlyTimeoutCount: number
}

/** Emit 30m/hourly lines to unified log when windows elapse (runs on a timer so long MV refresh does not block summaries). */
async function emitPollerSummariesIfDue(
  client: RiotHttpClient,
  hourlySummaryIntervalMs: number,
  sw: PollerSummaryWindows
): Promise<void> {
  const now = Date.now()
  if (now - sw.summary30mWindowStartedAtMs >= POLLER_SUMMARY_30M_MS) {
    const elapsedMs = Math.max(1, now - sw.summary30mWindowStartedAtMs)
    const playersPolledDelta = state.playersPolled - sw.summary30mPlayersPolled
    const playersFetchedDelta = state.playersFetched - sw.summary30mPlayersFetched
    const matchesDbDelta = state.matchesFetched - sw.summary30mMatchesFetched
    const matchesApiDelta =
      state.matchesApiIngestComplete - sw.summary30mMatchesApiIngestComplete
    const playersRankDelta =
      state.playersRankUpdatedLeague - sw.summary30mPlayersRankUpdatedLeague
    const httpRequestsDelta = state.requestCount - sw.summary30mRequestCount
    const error429Delta = state.error429Count - sw.summary30mError429Count
    const participantsDelta = state.participantsFetched - sw.summary30mParticipantsFetched
    const matchIdsFromApiDelta = state.matchIdsFromApi - sw.summary30mMatchIdsFromApi
    const existingMatchesSkippedDelta =
      state.existingMatchesSkipped - sw.summary30mExistingMatchesSkipped
    const timeoutDelta = state.timeoutCount - sw.summary30mTimeoutCount
    const limiterStats = client.getRateLimiterStats()
    const nearLimitPauseDelta =
      limiterStats.nearLimitPauseCount - sw.summary30mNearLimitPauseCount
    const http429PauseDelta = limiterStats.http429PauseCount - sw.summary30mHttp429PauseCount
    const windowHours = elapsedMs / (60 * 60 * 1000)
    const httpRequestsProjectedPerHour = Math.round((httpRequestsDelta * (60 * 60 * 1000)) / elapsedMs)
    const lastRlHeaders30m = client.getLastRiotRateLimitHeaders()
    await appendUnifiedLog({
      section: 'back',
      type: 'info',
      script: 'poller_30m',
      message: `Resume 30 min — polled:+${playersPolledDelta} matchsApi:+${matchesApiDelta} matchsDb:+${matchesDbDelta} newPlayers:+${playersFetchedDelta} rankLeague:+${playersRankDelta} participants:+${participantsDelta} http:+${httpRequestsDelta} (~${httpRequestsProjectedPerHour}/h si régulier) 429:+${error429Delta} pauses:${nearLimitPauseDelta}`,
      json: {
        windowStartIso: new Date(sw.summary30mWindowStartedAtMs).toISOString(),
        windowEndIso: new Date(now).toISOString(),
        elapsedMs,
        windowHoursApprox: Math.round(windowHours * 1000) / 1000,
        note:
          'http = chaque réponse HTTP Riot (dont chaque retry 429). ~…/h = extrapolation si le débit restait constant sur 1 h (la fenêtre réelle est elapsedMs).',
        delta: {
          playersPolled: playersPolledDelta,
          newPlayers: playersFetchedDelta,
          matchIdsFromApi: matchIdsFromApiDelta,
          existingMatchesSkipped: existingMatchesSkippedDelta,
          matchesInsertedDb: matchesDbDelta,
          matchesApiIngestComplete: matchesApiDelta,
          playersRankLeagueUpdated: playersRankDelta,
          participants: participantsDelta,
          httpRequests: httpRequestsDelta,
          requests: httpRequestsDelta,
          error429: error429Delta,
          timeout: timeoutDelta,
          matches: matchesDbDelta,
        },
        httpRequestsProjectedPerHour,
        requestsPerHour: httpRequestsProjectedPerHour,
        rateLimitRefreshPauses: nearLimitPauseDelta,
        rateLimit429Pauses: http429PauseDelta,
        totals: {
          playersPolled: state.playersPolled,
          newPlayers: state.playersFetched,
          matchesInsertedDb: state.matchesFetched,
          matchesApiIngestComplete: state.matchesApiIngestComplete,
          playersRankLeagueUpdated: state.playersRankUpdatedLeague,
          participants: state.participantsFetched,
          matchIdsFromApi: state.matchIdsFromApi,
          existingMatchesSkipped: state.existingMatchesSkipped,
          httpRequests: state.requestCount,
          requests: state.requestCount,
          matches: state.matchesFetched,
          error429: state.error429Count,
          error400: state.error400Count,
          timeout: state.timeoutCount,
        },
        riotRateLimitBuckets: {
          app: limiterStats.appBuckets,
          method: limiterStats.methodBuckets,
        },
        lastRiotRateLimitHeaders: lastRlHeaders30m,
      },
    })
    sw.summary30mWindowStartedAtMs = now
    sw.summary30mPlayersPolled = state.playersPolled
    sw.summary30mPlayersFetched = state.playersFetched
    sw.summary30mMatchesFetched = state.matchesFetched
    sw.summary30mMatchesApiIngestComplete = state.matchesApiIngestComplete
    sw.summary30mPlayersRankUpdatedLeague = state.playersRankUpdatedLeague
    sw.summary30mRequestCount = state.requestCount
    sw.summary30mError429Count = state.error429Count
    sw.summary30mParticipantsFetched = state.participantsFetched
    sw.summary30mNearLimitPauseCount = limiterStats.nearLimitPauseCount
    sw.summary30mHttp429PauseCount = limiterStats.http429PauseCount
    sw.summary30mMatchIdsFromApi = state.matchIdsFromApi
    sw.summary30mExistingMatchesSkipped = state.existingMatchesSkipped
    sw.summary30mTimeoutCount = state.timeoutCount
  }
  if (now - sw.hourlyWindowStartedAtMs >= hourlySummaryIntervalMs) {
    const elapsedMs = Math.max(1, now - sw.hourlyWindowStartedAtMs)
    const playersPolledDelta = state.playersPolled - sw.hourlyPlayersPolled
    const playersFetchedDelta = state.playersFetched - sw.hourlyPlayersFetched
    const matchesDbDelta = state.matchesFetched - sw.hourlyMatchesFetched
    const matchesApiDelta =
      state.matchesApiIngestComplete - sw.hourlyMatchesApiIngestComplete
    const playersRankDelta =
      state.playersRankUpdatedLeague - sw.hourlyPlayersRankUpdatedLeague
    const httpRequestsDelta = state.requestCount - sw.hourlyRequestCount
    const error429Delta = state.error429Count - sw.hourlyError429Count
    const participantsDelta = state.participantsFetched - sw.hourlyParticipantsFetched
    const matchIdsFromApiDelta = state.matchIdsFromApi - sw.hourlyMatchIdsFromApi
    const existingMatchesSkippedDelta =
      state.existingMatchesSkipped - sw.hourlyExistingMatchesSkipped
    const timeoutDelta = state.timeoutCount - sw.hourlyTimeoutCount
    const limiterStats = client.getRateLimiterStats()
    const nearLimitPauseDelta = limiterStats.nearLimitPauseCount - sw.hourlyNearLimitPauseCount
    const http429PauseDelta = limiterStats.http429PauseCount - sw.hourlyHttp429PauseCount
    const windowHours = elapsedMs / (60 * 60 * 1000)
    const httpRequestsProjectedPerHour = Math.round((httpRequestsDelta * (60 * 60 * 1000)) / elapsedMs)
    const discoveryRate = playersPolledDelta > 0 ? matchIdsFromApiDelta / playersPolledDelta : 0
    const efficiency = matchIdsFromApiDelta > 0 ? (matchesDbDelta / matchIdsFromApiDelta) * 100 : 0
    const appTarget120 = getRiotAppTargetPer120s()
    const requestBudget = Math.max(
      appTarget120,
      Math.floor(elapsedMs / 120_000) * appTarget120
    )
    const requestUsagePct = requestBudget > 0 ? (httpRequestsDelta / requestBudget) * 100 : 0
    const peakOk = limiterStats.maxApp120CountObserved <= appTarget120
    const tsLabel = formatSummaryTimestamp(new Date(now))
    const lastRlHeadersH = client.getLastRiotRateLimitHeaders()
    const formattedMessage = [
      `[${tsLabel}] RESUME HORAIRE`,
      `- Joueurs polles: ${playersPolledDelta} (Discovery rate: ${discoveryRate.toFixed(2)} matches/player)`,
      `- Matches: ${matchIdsFromApiDelta} trouves | ${matchesDbDelta} nouveaux en DB | ${existingMatchesSkippedDelta} deja connus (Efficiency: ${efficiency.toFixed(1)}%)`,
      `- API Requests: ${httpRequestsDelta}/${requestBudget} (Usage: ${requestUsagePct.toFixed(1)}%)`,
      `- Max Token Peak: ${limiterStats.maxApp120CountObserved}/${appTarget120} (Safety Margin: ${peakOk ? 'OK' : 'HIGH'})`,
      `- Participants indexes: ${playersFetchedDelta} nouveaux PUUIDs`,
      `- Erreurs: ${error429Delta + timeoutDelta} (429: ${error429Delta}, Timeout: ${timeoutDelta})`,
    ].join('\n')
    await appendUnifiedLog({
      section: 'back',
      type: 'info',
      script: 'poller_hourly',
      message: formattedMessage,
      json: {
        windowStartIso: new Date(sw.hourlyWindowStartedAtMs).toISOString(),
        windowEndIso: new Date(now).toISOString(),
        elapsedMs,
        windowHoursApprox: Math.round(windowHours * 1000) / 1000,
        hourlySummaryIntervalMsConfigured: hourlySummaryIntervalMs,
        note:
          'requêtes HTTP = une unité par réponse Riot reçue (match ids, détail, timeline, league…), y compris chaque réponse 429 avant retry. La limite Riot est surtout 100 appels / 120 s et 20 / 1 s, pas un plafond fixe 3000/h. ~…/h = extrapolation linéaire sur 1 h à partir de la fenêtre elapsedMs (si la fenêtre < 1 h, la projection peut dépasser la moyenne réelle sur 60 min).',
        delta: {
          playersPolled: playersPolledDelta,
          newPlayers: playersFetchedDelta,
          matchIdsFromApi: matchIdsFromApiDelta,
          existingMatchesSkipped: existingMatchesSkippedDelta,
          matchesInsertedDb: matchesDbDelta,
          matchesApiIngestComplete: matchesApiDelta,
          playersRankLeagueUpdated: playersRankDelta,
          participants: participantsDelta,
          httpRequests: httpRequestsDelta,
          requests: httpRequestsDelta,
          error429: error429Delta,
          timeout: timeoutDelta,
          matches: matchesDbDelta,
        },
        httpRequestsProjectedPerHour,
        requestsPerHour: httpRequestsProjectedPerHour,
        requestBudget,
        requestUsagePct,
        maxTokenPeak: limiterStats.maxApp120CountObserved,
        rateLimitRefreshPauses: nearLimitPauseDelta,
        rateLimit429Pauses: http429PauseDelta,
        totals: {
          playersPolled: state.playersPolled,
          newPlayers: state.playersFetched,
          matchIdsFromApi: state.matchIdsFromApi,
          existingMatchesSkipped: state.existingMatchesSkipped,
          matchesInsertedDb: state.matchesFetched,
          matchesApiIngestComplete: state.matchesApiIngestComplete,
          playersRankLeagueUpdated: state.playersRankUpdatedLeague,
          participants: state.participantsFetched,
          httpRequests: state.requestCount,
          requests: state.requestCount,
          matches: state.matchesFetched,
          error429: state.error429Count,
          error400: state.error400Count,
          timeout: state.timeoutCount,
        },
        riotRateLimitBuckets: {
          app: limiterStats.appBuckets,
          method: limiterStats.methodBuckets,
        },
        lastRiotRateLimitHeaders: lastRlHeadersH,
      },
    })
    const matchLoss = matchIdsFromApiDelta - matchesDbDelta
    const backlogLikely =
      matchIdsFromApiDelta > 500 && matchesApiDelta === 0 && matchesDbDelta === 0
    if (
      !backlogLikely &&
      matchLoss >= POLLER_MATCH_LOSS_ALERT_ABSOLUTE &&
      matchIdsFromApiDelta > 0 &&
      matchLoss / matchIdsFromApiDelta >= POLLER_MATCH_LOSS_ALERT_RATIO
    ) {
      await appendUnifiedLog({
        section: 'back',
        type: 'warning',
        script: 'poller_hourly',
        message: `Alerte perte matchs: trouves=${matchIdsFromApiDelta} inseresDb=${matchesDbDelta} perte=${matchLoss}`,
        json: {
          matchIdsFromApiDelta,
          matchesInsertedDbDelta: matchesDbDelta,
          existingMatchesSkippedDelta,
          matchesApiIngestCompleteDelta: matchesApiDelta,
          timeoutDelta,
          error429Delta,
          lossRatio: matchLoss / matchIdsFromApiDelta,
        },
      })
    }
    sw.hourlyWindowStartedAtMs = now
    sw.hourlyPlayersPolled = state.playersPolled
    sw.hourlyPlayersFetched = state.playersFetched
    sw.hourlyMatchesFetched = state.matchesFetched
    sw.hourlyMatchesApiIngestComplete = state.matchesApiIngestComplete
    sw.hourlyPlayersRankUpdatedLeague = state.playersRankUpdatedLeague
    sw.hourlyRequestCount = state.requestCount
    sw.hourlyError429Count = state.error429Count
    sw.hourlyParticipantsFetched = state.participantsFetched
    sw.hourlyNearLimitPauseCount = limiterStats.nearLimitPauseCount
    sw.hourlyHttp429PauseCount = limiterStats.http429PauseCount
    sw.hourlyMatchIdsFromApi = state.matchIdsFromApi
    sw.hourlyExistingMatchesSkipped = state.existingMatchesSkipped
    sw.hourlyTimeoutCount = state.timeoutCount
  }
}
import { Prisma } from '../generated/prisma/index.js'
import { gameVersionFromMatchInfo, normalizeGameVersionToMajorMinor } from '../utils/gameVersion.js'
import { tryRunChampionTierDailySnapshot } from '../services/ChampionTierDailySnapshotService.js'
import { runPatchCleanupFromConfig } from '../services/StatsAggregationService.js'
import { syncActivePatches } from '../services/MaterializedViewService.js'
const PLAYERS_PER_LOOP = 150

const TIMELINE_RETRY_BASE_DELAY_MS = 60_000
const TIMELINE_RETRY_MAX_DELAY_MS = 15 * 60_000
const TIMELINE_RETRY_MAX_ATTEMPTS = 8
const MATCH_FETCH_RETRY_DELAY_MS = 2_000
const MATCH_FETCH_MAX_ATTEMPTS = 3
const SYNC_ACTIVE_PATCHES_EVERY_MS = 4 * 60 * 60 * 1000
const POLLER_SUMMARY_30M_MS = 30 * 60 * 1000
const POLLER_MATCH_LOSS_ALERT_ABSOLUTE = 20
const POLLER_MATCH_LOSS_ALERT_RATIO = 0.2

/** Max match work items per Phase2 pipeline chunk (avoids one multi-hour step: HTTP done, DB still draining). */
function getPipelineChunkWorkItems(): number {
  const raw = parseInt(process.env.POLLER_PIPELINE_CHUNK_WORK_ITEMS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 25) return 250
  return Math.min(5_000, raw)
}

/** Ragrégateur `poller_hourly` : défaut 1h ; ex. `POLLER_HOURLY_SUMMARY_MS=60000` pour tester (min 60s, max 24h). */
function getPollerHourlySummaryIntervalMs(): number {
  const raw = parseInt(process.env.POLLER_HOURLY_SUMMARY_MS ?? '', 10)
  const fallback = 60 * 60 * 1000
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  const minMs = 60_000
  const maxMs = 24 * 60 * 60 * 1000
  return Math.min(maxMs, Math.max(minMs, raw))
}

function formatSummaryTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
/** Dernière sync `active_patches` depuis `ingest_matchs` (process). Même logique anti-burst qu’avant pour le refresh MV. */
let lastSyncActivePatchesAt = Date.now()

const timelineRetryState = new Map<string, { attempts: number; nextRetryAtMs: number }>()

const MIN_ALLOWED_MAJOR = 16
const MIN_ALLOWED_MINOR = 1
const DISK_ALERT_THRESHOLDS = [85, 90, 95] as const
const DISK_STOP_THRESHOLD = 98
const diskAlertedThresholds = new Set<number>()
let diskStopAlertSent = false

export interface RiotPollerStatus {
  isRunning: boolean
  shouldStop: boolean
  lastLoopStartedAt: string | null
  lastLoopFinishedAt: string | null
  lastError: string | null
  requestCount: number
  error429Count: number
  error400Count: number
  /** New rows in `ingest_matchs` (ingest). */
  matchesFetched: number
  /** Match + timeline API pair completed successfully for ingest. */
  matchesApiIngestComplete: number
  playersFetched: number
  playersPolled: number
  participantsFetched: number
  /** Successful League-v4-by-puuid responses that fed rank data during ingest. */
  playersRankUpdatedLeague: number
  /** Match IDs returned by Riot `by-puuid` API. */
  matchIdsFromApi: number
  /** Match IDs skipped because already in DB. */
  existingMatchesSkipped: number
  /** Riot HTTP failures with status 0 (timeout/network). */
  timeoutCount: number
  matchesRankFixed: number
  participantsRankFixed: number
  participantsRoleFixed: number
}

const defaultStatus: RiotPollerStatus = {
  isRunning: false,
  shouldStop: false,
  lastLoopStartedAt: null,
  lastLoopFinishedAt: null,
  lastError: null,
  requestCount: 0,
  error429Count: 0,
  error400Count: 0,
  matchesFetched: 0,
  matchesApiIngestComplete: 0,
  playersFetched: 0,
  playersPolled: 0,
  participantsFetched: 0,
  playersRankUpdatedLeague: 0,
  matchIdsFromApi: 0,
  existingMatchesSkipped: 0,
  timeoutCount: 0,
  matchesRankFixed: 0,
  participantsRankFixed: 0,
  participantsRoleFixed: 0,
}

let state: RiotPollerStatus = { ...defaultStatus }
let loopPromise: Promise<void> | null = null

/** When true, orchestrator will start puuid-migration script after poller loop exits (e.g. on 400_decrypt). */
let triggerPuuidMigrationOnPollerExit = false

export function setTriggerPuuidMigrationOnPollerExit(value: boolean): void {
  triggerPuuidMigrationOnPollerExit = value
}

/** Returns and clears the flag. Called by orchestrator when poller loop has finished. */
export function getAndClearTriggerPuuidMigrationOnPollerExit(): boolean {
  const v = triggerPuuidMigrationOnPollerExit
  triggerPuuidMigrationOnPollerExit = false
  return v
}

function setState(partial: Partial<RiotPollerStatus>): void {
  state = { ...state, ...partial }
}

function is400Decrypt(body: unknown): boolean {
  if (body && typeof body === 'object' && 'status' in body) {
    const msg = String((body as { status?: { message?: string } }).status?.message ?? '')
    return msg.includes('decrypt') || msg.includes('Bad Request')
  }
  return false
}

function isLikelyRiotPuuid(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  // Guard against synthetic placeholders like "12345".
  if (/^\d+$/.test(v)) return false
  return v.length >= 30
}

/** Riot calls for match ingest: retry every 429 until success; bail with RIOT_INGEST_ABORTED_MESSAGE if poller stops. */
function riotIngestRequestOptions(): {
  infinite429Retry: true
  shouldAbort: () => boolean
} {
  return { infinite429Retry: true, shouldAbort: () => state.shouldStop }
}

function isAllowedGameVersion(gameVersionRaw: string | null | undefined): boolean {
  const gameVersion = (gameVersionRaw ?? '').trim()
  if (!gameVersion) return false
  const [majorRaw, minorRaw] = gameVersion.split('.')
  const major = Number(majorRaw)
  const minor = Number(minorRaw)
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false
  if (major > MIN_ALLOWED_MAJOR) return true
  if (major < MIN_ALLOWED_MAJOR) return false
  return minor >= MIN_ALLOWED_MINOR
}

function comparePatchVersionDesc(a: string, b: string): number {
  const [aMajRaw, aMinRaw] = (a ?? '').trim().split('.')
  const [bMajRaw, bMinRaw] = (b ?? '').trim().split('.')
  const aMaj = Number(aMajRaw)
  const aMin = Number(aMinRaw)
  const bMaj = Number(bMajRaw)
  const bMin = Number(bMinRaw)
  const aMajSafe = Number.isFinite(aMaj) ? aMaj : -1
  const aMinSafe = Number.isFinite(aMin) ? aMin : -1
  const bMajSafe = Number.isFinite(bMaj) ? bMaj : -1
  const bMinSafe = Number.isFinite(bMin) ? bMin : -1
  if (aMajSafe !== bMajSafe) return bMajSafe - aMajSafe
  if (aMinSafe !== bMinSafe) return bMinSafe - aMinSafe
  return b.localeCompare(a)
}

async function resolvePatchPollingPolicy(): Promise<{
  latestPatch: string | null
  latestPatchOnly: boolean
}> {
  const patches = await prisma.activePatch.findMany({
    select: { gameVersion: true, gamesNumber: true, gameNumberMax: true },
  })
  if (patches.length === 0) return { latestPatch: null, latestPatchOnly: false }

  const latest = [...patches].sort((x, y) => comparePatchVersionDesc(x.gameVersion, y.gameVersion))[0]
  const max = Math.trunc(Number(latest.gameNumberMax ?? 0))
  const current = Math.trunc(Number(latest.gamesNumber ?? 0))
  const latestPatchOnly = max > 0 && current < max

  /** Patch « live » = data/game/version.json (sync Data Dragon), pas active_patches (peut traîner). */
  let latestPatch: string | null = null
  const versionInfoRes = await loadCurrentGameVersion()
  if (versionInfoRes.isOk()) {
    const info = versionInfoRes.unwrap()
    if (info?.currentVersion?.trim()) {
      latestPatch = normalizeGameVersionToMajorMinor(info.currentVersion) || null
    }
  }
  if (!latestPatch) {
    latestPatch =
      normalizeGameVersionToMajorMinor(latest.gameVersion) || (latest.gameVersion?.trim() || null)
  }

  return { latestPatch, latestPatchOnly }
}

function canAttemptTimelineFetchNow(matchId: string, nowMs: number): boolean {
  const s = timelineRetryState.get(matchId)
  return !s || s.nextRetryAtMs <= nowMs
}

function scheduleTimelineRetry(matchId: string): { attempts: number; nextRetryAtMs: number } {
  const prev = timelineRetryState.get(matchId)
  const attempts = Math.min(TIMELINE_RETRY_MAX_ATTEMPTS, (prev?.attempts ?? 0) + 1)
  const delay = Math.min(
    TIMELINE_RETRY_MAX_DELAY_MS,
    TIMELINE_RETRY_BASE_DELAY_MS * Math.max(1, 2 ** (attempts - 1))
  )
  const nextRetryAtMs = Date.now() + delay
  const nextState = { attempts, nextRetryAtMs }
  timelineRetryState.set(matchId, nextState)
  return nextState
}

function clearTimelineRetry(matchId: string): void {
  timelineRetryState.delete(matchId)
}

/** After first unified log when EUN has 0 pollable players, suppress repeat until EUN has players again. */
let eunRegionSkipInfoLogged = false

function logPollerRiotApiToUnified(message: string, json: Record<string, unknown>): void {
  void appendUnifiedLog({
    section: 'back',
    type: 'warning',
    script: 'poller_riot_api',
    message: message.replace(/\r?\n/g, ' ').replace(/\t/g, ' '),
    json,
  })
}

/** Throttle retry lines in unified log (still log attempt 1 and every 5th). */
function shouldLogPollerRiotAttempt(attempt: number, maxAttempts: number): boolean {
  if (attempt <= 1) return true
  if (attempt >= maxAttempts) return true
  return attempt % 5 === 0
}

function puuidLogTag(puuid: string): string {
  const t = (puuid ?? '').trim()
  if (t.length <= 10) return t
  return `${t.slice(0, 6)}…${t.slice(-4)}`
}

/**
 * Some match ids can fail ingest repeatedly (e.g. before a deploy fix). Without backoff, those ids
 * stay in toFetch forever, block lastSeen, and `newMatches` stays 0 while the loop burns quota.
 */
const matchIngestBackoffUntilMs = new Map<string, number>()
const matchIngestConsecutiveFails = new Map<string, number>()
/** Match ids currently queued or being ingested (cross-loop dedupe). */
const matchIngestPending = new Set<string>()
const MATCH_INGEST_FAILS_BEFORE_BACKOFF = 4
const MATCH_INGEST_BACKOFF_MS = 45 * 60 * 1000

function clearMatchIngestCooldownKeys(matchIdFromList: string, canonicalRiotMatchId: string): void {
  for (const k of [matchIdFromList, canonicalRiotMatchId]) {
    matchIngestBackoffUntilMs.delete(k)
    matchIngestConsecutiveFails.delete(k)
    matchIngestPending.delete(k)
  }
}

function canAttemptMatchIngestNow(matchId: string, nowMs: number): boolean {
  const until = matchIngestBackoffUntilMs.get(matchId)
  if (until == null) return true
  if (until <= nowMs) {
    matchIngestBackoffUntilMs.delete(matchId)
    matchIngestConsecutiveFails.delete(matchId)
    return true
  }
  return false
}

async function recordMatchIngestFailure(
  matchIdFromList: string,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  const fails = (matchIngestConsecutiveFails.get(matchIdFromList) ?? 0) + 1
  matchIngestConsecutiveFails.set(matchIdFromList, fails)
  if (fails >= MATCH_INGEST_FAILS_BEFORE_BACKOFF) {
    const until = Date.now() + MATCH_INGEST_BACKOFF_MS
    matchIngestBackoffUntilMs.set(matchIdFromList, until)
    matchIngestConsecutiveFails.delete(matchIdFromList)
    await logger.info('Match ingest suspended temporarily (repeated failures)', {
      matchId: matchIdFromList,
      failsBeforeSuspend: fails,
      retryNotBefore: new Date(until).toISOString(),
      backoffMinutes: Math.round(MATCH_INGEST_BACKOFF_MS / 60_000),
    })
    void appendUnifiedLog({
      section: 'back',
      type: 'warning',
      script: 'poller_ingest',
      message: 'Ingest match suspendu temporairement (échecs répétés)',
      json: {
        matchId: matchIdFromList,
        failsBeforeSuspend: fails,
        retryNotBeforeIso: new Date(until).toISOString(),
        backoffMinutes: Math.round(MATCH_INGEST_BACKOFF_MS / 60_000),
      },
    })
  }
}

/**
 * Paramètres pour GET match-v5 `/matches/by-puuid/{puuid}/ids` :
 * - `lastSeen` null → liste des matchs **sur la fenêtre patch** (match-filters + versions.json, ou mode priorité live).
 * - `lastSeen` défini → matchs **depuis le dernier poll** [lastSeen, maintenant], **bornés** à la fenêtre patch si elle existe.
 * Retourne `null` si l’intervalle est vide (rien à demander à l’API).
 */
function buildMatchIdsQueryForPlayer(
  player: { lastSeen: Date | null },
  filters: MatchFiltersConfig,
  patchWindow: { startTime: number; endTime: number } | null
): { queue: number; count: number; start: number; startTime?: number; endTime?: number } | null {
  const q: { queue: number; count: number; start: number; startTime?: number; endTime?: number } = {
    queue: filters.queue,
    count: filters.count,
    start: 0,
  }
  const nowSec = Math.floor(Date.now() / 1000)

  if (player.lastSeen == null) {
    if (patchWindow) {
      q.startTime = patchWindow.startTime
      q.endTime = Math.min(patchWindow.endTime, nowSec)
    }
    return q
  }

  const lastPollSec = Math.floor(player.lastSeen.getTime() / 1000)
  let startSec = lastPollSec
  let endSec = nowSec
  if (patchWindow) {
    startSec = Math.max(startSec, patchWindow.startTime)
    endSec = Math.min(endSec, patchWindow.endTime, nowSec)
  }
  if (endSec <= startSec) return null

  q.startTime = startSec
  q.endTime = endSec
  return q
}

async function getDiskUsagePercent(path: string): Promise<number | null> {
  try {
    const s = await statfs(path)
    const total = Number(s.blocks) * Number(s.bsize)
    const available = Number(s.bavail) * Number(s.bsize)
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(available) || available < 0) return null
    const used = Math.max(0, total - available)
    return (used / total) * 100
  } catch {
    return null
  }
}


export type RiotPollerInit = {
  ok: true
  client: RiotHttpClient
  rateLimiter: RiotRateLimiter
  logger: ReturnType<typeof createRiotPollerLogger>
  filters: MatchFiltersConfig
  clefType: string | null
}

/**
 * Extract (gameName, tagLine) from a match participant, preferring the fields that Riot
 * includes directly in Match v5 responses (riotIdGameName / riotIdTagline / riotIdTagLine).
 */
function participantNames(part: RiotParticipantDto): { gn: string; tl: string } {
  const gn = (
    (part.riotIdGameName as string | undefined) ??
    (part.riotIdName as string | undefined) ??
    ''
  ).trim().toLowerCase()
  const tl = (
    (part.riotIdTagline as string | undefined) ??
    (part.riotIdTagLine as string | undefined) ??
    ''
  ).trim().toLowerCase()
  return { gn, tl }
}

/**
 * Phase 2: sync all players whose puuidKeyVersion != clefType (includes 'erreur' and null).
 *
 * Strategy: positional matching against existing match history in our DB.
 * DB participants are stored in insertion order (= Riot response order), so
 * dbParticipant[i] ↔ riotParticipant[i] for the same match. One getMatch() call
 * resolves up to 10 players and also backfills role, challenges, and runes.
 *
 * No fallback API calls (getAccountByRiotId etc.). Players with no match history
 * or unresolved conflicts are marked as "perdu" for the current key version,
 * without overwriting puuid with synthetic placeholders.
 *
 * Accepts an optional shouldStop function (defaults to the module-level state flag).
 * This allows the puuid migration script to call this function with its own stop control.
 */
export async function runPhase2(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null,
  shouldStop: () => boolean = () => state.shouldStop
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2 start: sync players to current key (positional match-based)', { clefType })
  let totalSynced = 0
  let totalPlaceholder = 0
  let lastPulseMs = Date.now()
  let lastTotalSynced = 0
  let lastReqCount = state.requestCount

  while (!shouldStop()) {
    if (Date.now() - lastPulseMs >= POLLER_SUMMARY_30M_MS) {
      await appendUnifiedLog({
        section: 'back',
        type: 'info',
        script: 'puuid_migration',
        message: 'Resume migration PUUID (30 min)',
        json: {
          windowMs: POLLER_SUMMARY_30M_MS,
          migratedDelta: totalSynced - lastTotalSynced,
          requestCountDelta: state.requestCount - lastReqCount,
          totalSynced,
          totalPlaceholder,
        },
      })
      lastPulseMs = Date.now()
      lastTotalSynced = totalSynced
      lastReqCount = state.requestCount
    }
    // Include 'erreur' players and players with missing gameName (Match-v5 replaces Account-v1)
    const batch: { id: bigint; puuidKeyVersion: string | null }[] = await prisma.player.findMany({
      where: {
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: { notIn: ['perdu', clefType] } },
          { gameName: null, puuidKeyVersion: clefType },
        ],
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, puuidKeyVersion: true },
    })
    if (batch.length === 0) break

    const playerIds: bigint[] = batch.map(p => p.id)
    const pendingIds = new Set(playerIds)

    // Find matches where these players participated, prioritise highest coverage
    const partRows = await prisma.ingestMatchPlayer.findMany({
      where: { playerId: { in: playerIds } },
      select: { matchId: true },
    })
    const matchCoverage = new Map<bigint, number>()
    for (const r of partRows) {
      matchCoverage.set(r.matchId, (matchCoverage.get(r.matchId) ?? 0) + 1)
    }
    const sortedInternalIds = [...matchCoverage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)

    if (sortedInternalIds.length > 0) {
      const matchRows = await prisma.ingestMatch.findMany({
        where: { id: { in: sortedInternalIds } },
        select: { id: true, riotMatchId: true },
      })
      const internalToRiot = new Map(matchRows.map(m => [m.id, m.riotMatchId]))

      for (const internalId of sortedInternalIds) {
        if (shouldStop() || pendingIds.size === 0) break
        const riotMatchId = internalToRiot.get(internalId)
        if (!riotMatchId) continue

        const matchRes = await client.getMatch(riotMatchId)
        if (!matchRes.ok) {
          continue
        }

        // Positional matching: DB ingest_match_players ordered by id == Riot insertion order
        const dbMatchPlayers = await prisma.ingestMatchPlayer.findMany({
          where: { matchId: internalId },
          select: { id: true, playerId: true },
          orderBy: { id: 'asc' },
        })
        const riotParticipants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
        if (dbMatchPlayers.length !== riotParticipants.length) continue

        for (let i = 0; i < dbMatchPlayers.length; i++) {
          const dbPart = dbMatchPlayers[i]
          const riotPart = riotParticipants[i]
          const playerId = dbPart.playerId
          if (!pendingIds.has(playerId) || !riotPart.puuid) continue

          const { gn, tl } = participantNames(riotPart)
          try {
            await prisma.player.update({
              where: { id: playerId },
              data: {
                puuid: riotPart.puuid,
                puuidKeyVersion: clefType,
                ...(gn ? { gameName: gn } : {}),
                ...(tl ? { tagName: tl } : {}),
              },
            })
            pendingIds.delete(playerId)
            totalSynced++
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              // PUUID already taken by another player row — mark unresolved for this key.
              await prisma.player.update({
                where: { id: playerId },
                data: { puuidKeyVersion: 'perdu' },
              })
              pendingIds.delete(playerId)
              totalPlaceholder++
            } else {
              throw e
            }
          }
        }
      }
    }

    // Players with no match history or still unresolved:
    // → placeholder PUUID only for those needing PUUID migration (not just gameName refresh)
    for (const playerId of pendingIds) {
      const player = batch.find(b => b.id === playerId)!
      if (player.puuidKeyVersion !== clefType) {
        await prisma.player.update({
          where: { id: playerId },
          data: { puuidKeyVersion: 'perdu' },
        })
        totalPlaceholder++
      }
      // else: already on correct key, gameName will be populated when they next appear in Phase 4
    }
  }

  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'puuid_migration',
    message: 'Resume migration PUUID (final)',
    json: { totalSynced, totalPlaceholder, requestCount: state.requestCount },
  })
  await logger.step('Phase 2 end', { totalSynced, totalPlaceholder })
}

async function extractAndInsertJungleFirstClear(
  matchDbId: bigint,
  riotMatchId: string,
  timeline: RiotMatchTimelineDto,
  logger?: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  void matchDbId
  void riotMatchId
  void timeline
  void logger
}

const MATCH_INGEST_ORPHAN_STEP_ID = '__orphan__'

interface MatchIngestPlayerTrackerRef {
  pendingTransientIngest: boolean
  player: { id: bigint; puuid: string }
  ingestedIds: string[]
}

type MatchIngestStepContext = {
  stepId: string
  counters: {
    error400Count: number
    matchesFetched: number
    matchesApiIngestComplete: number
    playersFetched: number
    playersPolled: number
    participantsFetched: number
    playersRankUpdatedLeague: number
    matchIdsFromApi: number
    existingMatchesSkipped: number
    timeoutCount: number
  }
  onIngested: (trackerIdx: number, canonicalRiotMatchId: string) => void
  syncLiveCounters: () => void
  logger: ReturnType<typeof createRiotPollerLogger>
  playerTrackers: MatchIngestPlayerTrackerRef[] | null
  flagsRef: { foundPrismaError: boolean }
}

let matchIngestStepContext: MatchIngestStepContext | null = null
let activeMatchIngestClient: RiotHttpClient | null = null
let matchIngestBgTimer: ReturnType<typeof setInterval> | null = null
let matchIngestBgInFlight = 0
let matchIngestQueueDepthEstimate = -1
let matchIngestQueueDepthLastSyncAtMs = 0
const MATCH_INGEST_QUEUE_DEPTH_RESYNC_MS = 2_000
let rawIngestQueueDepthEstimate = -1
let rawIngestErrorDepthEstimate = -1
let matchIngestMetricsLastLogAtMs = 0
let matchIngestMetricsProcessed = 0
let matchIngestMetricsLagTotalMs = 0
let rawIngestFallbackWrites = 0

/** Limite les écritures ingest concurrentes (contention DB / MV). Défaut 1 = séquentiel. */
const matchIngestDbSlot = {
  active: 0,
  waiters: [] as Array<() => void>,
}

function getMatchIngestDbConcurrency(): number {
  const raw = parseInt(process.env.MATCH_INGEST_DB_CONCURRENCY ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(32, raw)
}

async function acquireMatchIngestDbSlot(): Promise<void> {
  const max = getMatchIngestDbConcurrency()
  while (matchIngestDbSlot.active >= max) {
    await new Promise<void>((resolve) => {
      matchIngestDbSlot.waiters.push(resolve)
    })
  }
  matchIngestDbSlot.active++
}

function releaseMatchIngestDbSlot(): void {
  matchIngestDbSlot.active--
  const wake = matchIngestDbSlot.waiters.shift()
  if (wake) wake()
}

/** Workers file/raw plafonnés par `MATCH_INGEST_DB_CONCURRENCY` pour éviter N ingest DB en parallèle. */
function getMatchIngestParallelJobs(): number {
  const cap = getMatchIngestDbConcurrency()
  const w = isRawIngestQueueEnabled() ? getRawIngestWorkers() : getMatchIngestFileWorkers()
  return Math.min(w, cap)
}

function getMatchIngestQueueMaxDepth(): number {
  const raw = parseInt(process.env.MATCH_INGEST_QUEUE_MAX_PENDING ?? '', 10)
  if (!Number.isFinite(raw) || raw < 100) return 5000
  return Math.min(100_000, raw)
}

function getMatchIngestBatchSize(): number {
  const raw = parseInt(process.env.MATCH_INGEST_BATCH_SIZE ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 5
  return Math.min(50, raw)
}

function getMatchIngestFileWorkers(): number {
  const raw = parseInt(process.env.MATCH_INGEST_FILE_WORKERS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(32, raw)
}

/** Raw-queue normalizer concurrency (défaut 1 pour limiter la pression sur la DB). */
function getRawIngestWorkers(): number {
  const raw = parseInt(process.env.RAW_INGEST_WORKERS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(64, raw)
}

/** Parallel match-detail producers in Phase 2 when not using async file/raw queue (default 25). */
function getParallelMatchIngestFetches(): number {
  const raw = parseInt(process.env.MATCH_INGEST_PARALLEL_FETCHES ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 25
  return Math.min(64, raw)
}

/** Max concurrent Phase-1 match-id lookups (league-v4 + match-v5 ids) to avoid bursty 429 waves. */
function getMatchIdsLookupConcurrency(): number {
  const raw = parseInt(process.env.RIOT_MATCH_IDS_LOOKUP_CONCURRENCY ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 6
  return Math.min(32, raw)
}

function getRawIngestErrorRequeueBatch(): number {
  const raw = parseInt(process.env.RAW_INGEST_ERROR_REQUEUE_BATCH ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 100
  return Math.min(10_000, raw)
}

function getRawIngestStaleProcessingMaxAgeMs(): number {
  const raw = parseInt(process.env.RAW_INGEST_STALE_PROCESSING_MAX_AGE_MS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 60_000) return 10 * 60_000
  return Math.min(24 * 60 * 60 * 1000, raw)
}

function getRawIngestStaleProcessingRequeueBatch(): number {
  const raw = parseInt(process.env.RAW_INGEST_STALE_PROCESSING_REQUEUE_BATCH ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 500
  return Math.min(10_000, raw)
}

function getRawIngestDoneCleanupIntervalMs(): number {
  const raw = parseInt(process.env.RAW_INGEST_DONE_CLEANUP_INTERVAL_MS ?? '', 10)
  if (!Number.isFinite(raw) || raw < 60_000) return 12 * 60 * 60 * 1000
  return Math.min(7 * 24 * 60 * 60 * 1000, raw)
}

function getRawIngestDoneCleanupBatch(): number {
  const raw = parseInt(process.env.RAW_INGEST_DONE_CLEANUP_BATCH ?? '', 10)
  if (!Number.isFinite(raw) || raw < 1) return 50_000
  return Math.min(200_000, raw)
}

async function syncMatchIngestQueueDepthEstimate(force = false): Promise<number> {
  if (!isMatchIngestFileQueueEnabled()) return 0
  const now = Date.now()
  if (
    !force &&
    matchIngestQueueDepthEstimate >= 0 &&
    now - matchIngestQueueDepthLastSyncAtMs < MATCH_INGEST_QUEUE_DEPTH_RESYNC_MS
  ) {
    return matchIngestQueueDepthEstimate
  }
  const depth = await countMatchIngestQueueFiles()
  matchIngestQueueDepthEstimate = depth
  matchIngestQueueDepthLastSyncAtMs = now
  return depth
}

async function syncRawIngestDepthEstimates(force = false): Promise<{
  pending: number
  processing: number
  error: number
}> {
  if (!isRawIngestQueueEnabled()) return { pending: 0, processing: 0, error: 0 }
  const now = Date.now()
  if (
    !force &&
    rawIngestQueueDepthEstimate >= 0 &&
    now - matchIngestQueueDepthLastSyncAtMs < MATCH_INGEST_QUEUE_DEPTH_RESYNC_MS
  ) {
    return {
      pending: rawIngestQueueDepthEstimate,
      processing: Math.max(0, matchIngestBgInFlight),
      error: Math.max(0, rawIngestErrorDepthEstimate),
    }
  }
  const s = await countRawIngestByStatus()
  rawIngestQueueDepthEstimate = s.pending
  rawIngestErrorDepthEstimate = s.error
  return s
}

function noteMatchIngestQueueDepthDelta(delta: number): void {
  if (matchIngestQueueDepthEstimate < 0) return
  matchIngestQueueDepthEstimate = Math.max(0, matchIngestQueueDepthEstimate + delta)
}

function noteRawIngestQueueDepthDelta(delta: number): void {
  if (rawIngestQueueDepthEstimate < 0) return
  rawIngestQueueDepthEstimate = Math.max(0, rawIngestQueueDepthEstimate + delta)
}

function noteMatchIngestProcessed(enqueuedAt: number | null | undefined): void {
  if (matchIngestMetricsLastLogAtMs <= 0) matchIngestMetricsLastLogAtMs = Date.now()
  matchIngestMetricsProcessed++
  if (typeof enqueuedAt === 'number' && Number.isFinite(enqueuedAt) && enqueuedAt > 0) {
    const lag = Date.now() - enqueuedAt
    if (lag > 0) matchIngestMetricsLagTotalMs += lag
  }
}

async function maybeLogMatchIngestMetrics(): Promise<void> {
  const now = Date.now()
  if (now - matchIngestMetricsLastLogAtMs < 30_000 || matchIngestMetricsProcessed <= 0) return
  const elapsedMs = Math.max(1, now - matchIngestMetricsLastLogAtMs)
  const processed = matchIngestMetricsProcessed
  const avgLagMs = Math.round(matchIngestMetricsLagTotalMs / processed)
  const ingestPerSecond = Number((processed / (elapsedMs / 1000)).toFixed(2))
  const rawDepths = isRawIngestQueueEnabled() ? await syncRawIngestDepthEstimates() : null
  const queueDepth = rawDepths ? rawDepths.pending : await syncMatchIngestQueueDepthEstimate()
  const errorDepth = rawDepths ? rawDepths.error : 0
  void appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'poller_ingest',
    message: `Ingest queue metrics — rate:${ingestPerSecond}/s avgLag:${avgLagMs}ms depth:${queueDepth} errorDepth:${errorDepth} workersBusy:${matchIngestBgInFlight} fallbackWrites:${rawIngestFallbackWrites}`,
    json: {
      ingestPerSecond,
      avgLagMs,
      queueDepth,
      errorDepth,
      workersBusy: matchIngestBgInFlight,
      workersMax: getMatchIngestParallelJobs(),
      configuredFileOrRawWorkers: isRawIngestQueueEnabled()
        ? getRawIngestWorkers()
        : getMatchIngestFileWorkers(),
      matchIngestDbConcurrency: getMatchIngestDbConcurrency(),
      fallbackFileWrites: rawIngestFallbackWrites,
      windowMs: elapsedMs,
      processed,
      parallelMatchFetchesMax: getParallelMatchIngestFetches(),
    },
  })
  matchIngestMetricsLastLogAtMs = now
  matchIngestMetricsProcessed = 0
  matchIngestMetricsLagTotalMs = 0
}

/**
 * One queue drain step: load up to MATCH_INGEST_BATCH_SIZE files, one DB preload for all Puuids,
 * shared League rank cache across matches in the batch.
 */
async function runMatchIngestProcessOneFile(client: RiotHttpClient): Promise<boolean> {
  const ctx = matchIngestStepContext
  if (!ctx) return false
  type Parsed = { path: string | null; rawId: bigint | null; payload: MatchIngestQueuePayloadV1 }
  const parsed: Parsed[] = []
  const useRaw = isRawIngestQueueEnabled()
  if (useRaw) {
    const rows = await claimRawIngestRows(getMatchIngestBatchSize())
    if (rows.length === 0) return false
    noteRawIngestQueueDepthDelta(-rows.length)
    for (const row of rows) {
      let payload: MatchIngestQueuePayloadV1
      try {
        payload = {
          v: 1,
          stepId: MATCH_INGEST_ORPHAN_STEP_ID,
          matchId: row.riotMatchId,
          region: row.region,
          matchDto: row.payloadJson,
          timelineDto: row.timelineJson,
          puuidKeyVersion: null,
          trackerIdx: -1,
          enqueuedAt: row.ingestedAt.getTime(),
        }
      } catch {
        await markRawIngestError(row.id, 'invalid_raw_payload_shape', 5 * 60_000)
        continue
      }
      parsed.push({ path: null, rawId: row.id, payload })
    }
  } else {
    const paths = await claimOldestMatchIngestQueueFilePaths(getMatchIngestBatchSize())
    if (paths.length === 0) return false
    noteMatchIngestQueueDepthDelta(-paths.length)
    for (const p of paths) {
      let raw: string
      try {
        raw = await readFile(p, 'utf8')
      } catch {
        await unlink(p).catch(() => undefined)
        continue
      }
      let payload: MatchIngestQueuePayloadV1
      try {
        payload = JSON.parse(raw) as MatchIngestQueuePayloadV1
      } catch {
        await unlink(p).catch(() => undefined)
        continue
      }
      if (payload.v !== 1) {
        await unlink(p).catch(() => undefined)
        continue
      }
      parsed.push({ path: p, rawId: null, payload })
    }
  }
  if (parsed.length === 0) return true

  await acquireMatchIngestDbSlot()
  try {
  const canonicalIds: string[] = []
  for (const { payload } of parsed) {
    const dto = payload.matchDto as RiotMatchDto
    canonicalIds.push(resolveRiotMatchIdForIngest(payload.matchId, dto))
  }
  const existingRows = await prisma.ingestMatch.findMany({
    where: { riotMatchId: { in: canonicalIds } },
    select: { riotMatchId: true, id: true },
  })
  const existingMatchIdByRiot = new Map(existingRows.map((r) => [r.riotMatchId, r.id]))

  const puuidsToPreload: string[] = []
  for (let i = 0; i < parsed.length; i++) {
    const { payload } = parsed[i]
    const cid = canonicalIds[i]
    if (existingMatchIdByRiot.has(cid)) continue
    const dto = payload.matchDto as RiotMatchDto
    const part = dto.info?.participants as RiotParticipantDto[] | undefined
    for (const p of part ?? []) {
      if (p.puuid) puuidsToPreload.push(p.puuid)
    }
  }
  const ingestPreload = await preloadIngestLeanMatchDbData(puuidsToPreload)
  const sharedAccountRankCache: MatchIngestRankCache = new Map()
  const rankIngestOpts: MatchIngestOptions = {
    ingestPreload,
    sharedAccountRankCache,
    shouldAbort: () => state.shouldStop,
  }

  for (let i = 0; i < parsed.length; i++) {
    const { path: p, rawId, payload } = parsed[i]
    const matchId = payload.matchId
    const matchDto = payload.matchDto as RiotMatchDto
    const timelineDto = payload.timelineDto as RiotMatchTimelineDto | null
    const trackerIdx = payload.trackerIdx
    const tracker = ctx.playerTrackers?.[trackerIdx]
    const canonicalRiotMatchId = canonicalIds[i]

    const existingDbId = existingMatchIdByRiot.get(canonicalRiotMatchId)
    if (existingDbId != null) {
      if (timelineDto) {
        await extractAndInsertJungleFirstClear(existingDbId, canonicalRiotMatchId, timelineDto, ctx.logger)
        await extractIngestTimelineExtras(
          existingDbId,
          canonicalRiotMatchId,
          timelineDto,
          matchDto.info?.participants ?? [],
          ctx.logger
        )
      }
      if (payload.stepId === ctx.stepId) {
        ctx.onIngested(trackerIdx, canonicalRiotMatchId)
      }
      clearMatchIngestCooldownKeys(matchId, canonicalRiotMatchId)
      ctx.syncLiveCounters()
      noteMatchIngestProcessed(payload.enqueuedAt)
      if (rawId != null) await markRawIngestDone(rawId)
      else await unlink(p!).catch(() => undefined)
      continue
    }

    try {
      const { matchDbId, canonicalRiotMatchId: canonical } = await upsertIngestMatchAndParticipants(
        client,
        payload.region,
        matchId,
        matchDto,
        payload.puuidKeyVersion,
        ctx.counters,
        ctx.logger,
        rankIngestOpts
      )
      if (timelineDto) {
        await extractAndInsertJungleFirstClear(matchDbId, canonical, timelineDto, ctx.logger)
        await extractIngestTimelineExtras(
          matchDbId,
          canonical,
          timelineDto,
          matchDto.info?.participants ?? [],
          ctx.logger
        )
      }
      if (payload.stepId === ctx.stepId) {
        ctx.onIngested(trackerIdx, canonical)
      }
      clearMatchIngestCooldownKeys(matchId, canonical)
      ctx.syncLiveCounters()
      noteMatchIngestProcessed(payload.enqueuedAt)
      if (rawId != null) await markRawIngestDone(rawId)
      else await unlink(p!).catch(() => undefined)
    } catch (err) {
      const skipped = unwrapMatchIngestSkipped(err)
      if (skipped) {
        await ctx.logger.info('Match ingest skipped (queue)', {
          matchId,
          reason: skipped.reason,
        })
        noteMatchIngestProcessed(payload.enqueuedAt)
        if (rawId != null) await markRawIngestDone(rawId)
        else await unlink(p!).catch(() => undefined)
        continue
      }
      if (err instanceof Error && err.message === RIOT_INGEST_ABORTED_MESSAGE) {
        noteMatchIngestProcessed(payload.enqueuedAt)
        if (rawId != null) {
          await markRawIngestError(rawId, RIOT_INGEST_ABORTED_MESSAGE, 30_000)
        } else {
          const errPath = p!.replace(/\.json$/i, '')
          await rename(p!, `${errPath}.abort.${Date.now()}.json`).catch(() => undefined)
        }
        continue
      }
      if (tracker) tracker.pendingTransientIngest = true
      const pid = tracker?.player.id.toString() ?? '?'
      await ctx.logger.error('Player match ingest failed (queue)', {
        playerId: pid,
        matchId,
        error: err instanceof Error ? err.message : String(err),
      })
      await recordMatchIngestFailure(matchId, ctx.logger)
      ctx.flagsRef.foundPrismaError = true
      ctx.syncLiveCounters()
      noteMatchIngestProcessed(payload.enqueuedAt)
      if (rawId != null) {
        const delay = Math.min(30 * 60_000, Math.max(60_000, (payload.enqueuedAt ? 1 : 1) * 60_000))
        await markRawIngestError(rawId, err instanceof Error ? err.message : String(err), delay)
      } else {
        const errPath = p!.replace(/\.json$/i, '')
        await rename(p!, `${errPath}.err.${Date.now()}.json`).catch(() => undefined)
      }
    }
  }
  await maybeLogMatchIngestMetrics()
  return true
  } finally {
    releaseMatchIngestDbSlot()
  }
}

async function drainMatchIngestQueueFolder(client: RiotHttpClient): Promise<void> {
  if (!isRawIngestQueueEnabled() && !isMatchIngestFileQueueEnabled()) return
  if (isRawIngestQueueEnabled()) await syncRawIngestDepthEstimates(true)
  else await syncMatchIngestQueueDepthEstimate(true)
  const workers = getMatchIngestParallelJobs()
  await Promise.all(
    Array.from({ length: workers }, async () => {
      let guard = 0
      while (guard < 50_000) {
        guard++
        const processed = await runMatchIngestProcessOneFile(client)
        if (!processed) break
      }
    })
  )
}

function startMatchIngestBackgroundProcessor(): void {
  if (matchIngestBgTimer != null) return
  if (!isRawIngestQueueEnabled() && !isMatchIngestFileQueueEnabled()) return
  const workers = getMatchIngestParallelJobs()
  matchIngestBgTimer = setInterval(() => {
    const c = activeMatchIngestClient
    if (!c || !matchIngestStepContext) return
    const availableSlots = Math.max(0, workers - matchIngestBgInFlight)
    if (availableSlots <= 0) return
    for (let i = 0; i < availableSlots; i++) {
      matchIngestBgInFlight++
      void runMatchIngestProcessOneFile(c)
        .catch(() => undefined)
        .finally(() => {
          matchIngestBgInFlight = Math.max(0, matchIngestBgInFlight - 1)
        })
    }
  }, 50)
}

function stopMatchIngestBackgroundProcessor(): void {
  if (matchIngestBgTimer != null) {
    clearInterval(matchIngestBgTimer)
    matchIngestBgTimer = null
  }
  matchIngestBgInFlight = 0
}

async function runStep4ForPlayer(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  filters: MatchFiltersConfig,
  region: string,
  puuidKeyVersion: string | null,
  counters: {
    error400Count: number
    matchesFetched: number
    matchesApiIngestComplete: number
    playersFetched: number
    playersPolled: number
    participantsFetched: number
    playersRankUpdatedLeague: number
    matchIdsFromApi: number
    existingMatchesSkipped: number
    timeoutCount: number
  },
  matchListTimeWindow: { startTime: number; endTime: number } | null
): Promise<'ok' | '400_decrypt' | 'prisma_error'> {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  let lastCountersSyncAtMs = 0
  const syncLiveCounters = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastCountersSyncAtMs < 5_000) return
    lastCountersSyncAtMs = now
    setState({
      error400Count: counters.error400Count,
      matchesFetched: counters.matchesFetched,
      matchesApiIngestComplete: counters.matchesApiIngestComplete,
      playersFetched: counters.playersFetched,
      playersPolled: counters.playersPolled,
      participantsFetched: counters.participantsFetched,
      playersRankUpdatedLeague: counters.playersRankUpdatedLeague,
      matchIdsFromApi: counters.matchIdsFromApi,
      existingMatchesSkipped: counters.existingMatchesSkipped,
      timeoutCount: counters.timeoutCount,
    })
  }

  type StrictFetchResult =
    | { ok: true; matchDto: RiotMatchDto; timelineDto: RiotMatchTimelineDto }
    | { ok: false; reason: '400_decrypt' | 'abort' | 'version' | 'deferred_patch' }
    | { ok: false; reason: 'transient'; matchDto: RiotMatchDto | null }

  const patchPolicy = await resolvePatchPollingPolicy()
  let latestPatchDateWindow: { startTime: number; endTime: number } | null = null
  /** Patchs normalisés (major.minor) acceptés en mode priorité live ; grâce post-release = latest + N-1. */
  let priorityAllowedPatches: string[] | null = null
  if (patchPolicy.latestPatchOnly && patchPolicy.latestPatch) {
    const currentRes = await loadCurrentGameVersion()
    const recapRes = await loadGameVersionsRecap()
    const releaseDate = currentRes.isOk() ? currentRes.unwrap()?.releaseDate : undefined
    const recap = recapRes.isOk() ? recapRes.unwrap() : null
    const w = resolveLatestPatchPriorityWindow({
      latestPatch: patchPolicy.latestPatch,
      currentReleaseDate: releaseDate,
      recap,
      graceDays: getPollerPatchRolloutGraceDays(),
      nowSec: Math.floor(Date.now() / 1000),
    })
    if (Number.isFinite(w.matchListStartTime)) {
      latestPatchDateWindow = {
        startTime: w.matchListStartTime,
        endTime: Math.floor(Date.now() / 1000),
      }
    }
    priorityAllowedPatches = w.allowedPatches.length ? w.allowedPatches : [patchPolicy.latestPatch]
  }

  const fetchMatchAndTimelineStrict = async (matchId: string): Promise<StrictFetchResult> => {
    let attempts = 0
    /** Match-v5 OK + version OK: reuse on timeline-only retries (avoids ~2× HTTP when timeline flakes). */
    let cachedMatchDto: RiotMatchDto | null = null
    while (!state.shouldStop && attempts < MATCH_FETCH_MAX_ATTEMPTS) {
      attempts++

      if (cachedMatchDto == null) {
        const [matchRes, timelineResFirst] = await Promise.all([
          client.getMatch(matchId, riotIngestRequestOptions()),
          client.getMatchTimeline(matchId, riotIngestRequestOptions()),
        ])
        if (!matchRes.ok) {
          if (matchRes.status === 0) counters.timeoutCount++
          if (matchRes.status === 400 && is400Decrypt(matchRes.body)) {
            counters.error400Count++
            await logger.error('400 decrypt on match', matchRes.body)
            return { ok: false, reason: '400_decrypt' }
          }
          if (matchRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
            return { ok: false, reason: 'abort' }
          }
          if (shouldLogPollerRiotAttempt(attempts, MATCH_FETCH_MAX_ATTEMPTS)) {
            logPollerRiotApiToUnified('Riot match-v5 fetch échoué ou en retry', {
              region,
              matchId,
              attempt: attempts,
              maxAttempts: MATCH_FETCH_MAX_ATTEMPTS,
              httpStatus: matchRes.status,
              message: matchRes.message ?? null,
            })
          }
          await logger.info('Retry match detail fetch', { matchId, attempt: attempts, status: matchRes.status })
          await sleep(MATCH_FETCH_RETRY_DELAY_MS)
          continue
        }
        if (
          !isAllowedGameVersion(
            normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(matchRes.data?.info))
          )
        ) {
          return { ok: false, reason: 'version' }
        }
        if (patchPolicy.latestPatchOnly) {
          const matchPatch = normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(matchRes.data?.info))
          const allowed = priorityAllowedPatches ?? []
          if (!allowed.includes(matchPatch)) {
            return { ok: false, reason: 'deferred_patch' }
          }
        }
        cachedMatchDto = matchRes.data as RiotMatchDto
        if (!timelineResFirst.ok) {
          if (timelineResFirst.status === 0) counters.timeoutCount++
          if (timelineResFirst.message === RIOT_INGEST_ABORTED_MESSAGE) {
            return { ok: false, reason: 'abort' }
          }
          const retry = scheduleTimelineRetry(matchId)
          if (shouldLogPollerRiotAttempt(attempts, MATCH_FETCH_MAX_ATTEMPTS)) {
            logPollerRiotApiToUnified('Riot timeline fetch échoué ou en retry', {
              region,
              matchId,
              attempt: attempts,
              maxAttempts: MATCH_FETCH_MAX_ATTEMPTS,
              httpStatus: timelineResFirst.status,
              message: timelineResFirst.message ?? null,
              timelineRetryStateAttempts: retry.attempts,
            })
          }
          await logger.info('Retry timeline fetch', {
            matchId,
            attempt: attempts,
            status: timelineResFirst.status,
            retryAttempts: retry.attempts,
          })
          await sleep(MATCH_FETCH_RETRY_DELAY_MS)
          continue
        }
        clearTimelineRetry(matchId)
        counters.matchesApiIngestComplete++
        return { ok: true, matchDto: cachedMatchDto, timelineDto: timelineResFirst.data }
      }

      const timelineRes = await client.getMatchTimeline(matchId, riotIngestRequestOptions())
      if (!timelineRes.ok) {
        if (timelineRes.status === 0) counters.timeoutCount++
        if (timelineRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
          return { ok: false, reason: 'abort' }
        }
        const retry = scheduleTimelineRetry(matchId)
        if (shouldLogPollerRiotAttempt(attempts, MATCH_FETCH_MAX_ATTEMPTS)) {
          logPollerRiotApiToUnified('Riot timeline fetch échoué ou en retry', {
            region,
            matchId,
            attempt: attempts,
            maxAttempts: MATCH_FETCH_MAX_ATTEMPTS,
            httpStatus: timelineRes.status,
            message: timelineRes.message ?? null,
            timelineRetryStateAttempts: retry.attempts,
          })
        }
        await logger.info('Retry timeline fetch', {
          matchId,
          attempt: attempts,
          status: timelineRes.status,
          retryAttempts: retry.attempts,
        })
        await sleep(MATCH_FETCH_RETRY_DELAY_MS)
        continue
      }
      clearTimelineRetry(matchId)
      counters.matchesApiIngestComplete++
      return { ok: true, matchDto: cachedMatchDto, timelineDto: timelineRes.data }
    }

    // Timeline exhausted retries but we have the match detail → return it
    // so the match data is still ingested (no wasted getMatch request).
    if (cachedMatchDto) {
      logPollerRiotApiToUnified('Timeline indisponible — match ingéré sans timeline', {
        region,
        matchId,
        maxAttempts: MATCH_FETCH_MAX_ATTEMPTS,
        lastAttempt: attempts,
      })
    }
    return { ok: false, reason: 'transient', matchDto: cachedMatchDto }
  }

  const playerWhere = {
    region,
    ...(puuidKeyVersion
      ? { puuidKeyVersion }
      : { puuidKeyVersion: { notIn: ['erreur', 'perdu'] as string[] } }),
  }
  const selectedPlayers: Array<{
    id: bigint
    puuid: string
    lastSeen: Date | null
    createdAt: Date
    region: string
    puuidKeyVersion: string | null
  }> = []
  const selectedIds = new Set<bigint>()

  const priorityPuuids = dequeuePriorityPuuids(PLAYERS_PER_LOOP * 3)
  if (priorityPuuids.length > 0) {
    const priorityRows = await prisma.player.findMany({
      where: { ...playerWhere, puuid: { in: priorityPuuids } },
      select: {
        id: true,
        puuid: true,
        lastSeen: true,
        createdAt: true,
        region: true,
        puuidKeyVersion: true,
      },
      take: PLAYERS_PER_LOOP,
    })
    const order = new Map(priorityPuuids.map((puuid, idx) => [puuid, idx]))
    priorityRows.sort((a, b) => (order.get(a.puuid) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.puuid) ?? Number.MAX_SAFE_INTEGER))
    for (const row of priorityRows) {
      selectedPlayers.push(row)
      selectedIds.add(row.id)
      if (selectedPlayers.length >= PLAYERS_PER_LOOP) break
    }
  }

  if (selectedPlayers.length < PLAYERS_PER_LOOP) {
    const fallbackRows = await prisma.player.findMany({
      where: {
        ...playerWhere,
        ...(selectedIds.size > 0 ? { id: { notIn: Array.from(selectedIds) } } : {}),
      },
      orderBy: [{ lastSeen: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: PLAYERS_PER_LOOP - selectedPlayers.length,
      select: {
        id: true,
        puuid: true,
        lastSeen: true,
        createdAt: true,
        region: true,
        puuidKeyVersion: true,
      },
    })
    selectedPlayers.push(...fallbackRows)
  }
  const players = selectedPlayers

  const flags = { foundPrismaError: false }

  const useRawMatchIngestQueue = isRawIngestQueueEnabled()
  const useFileMatchIngestQueue = isMatchIngestFileQueueEnabled()
  const useAsyncMatchIngestQueue = useRawMatchIngestQueue || useFileMatchIngestQueue
  if (useAsyncMatchIngestQueue) {
    if (useRawMatchIngestQueue) await syncRawIngestDepthEstimates(true)
    else await syncMatchIngestQueueDepthEstimate(true)
    matchIngestStepContext = {
      stepId: MATCH_INGEST_ORPHAN_STEP_ID,
      counters,
      onIngested: () => {},
      syncLiveCounters: () => syncLiveCounters(true),
      logger,
      playerTrackers: null,
      flagsRef: flags,
    }
    await drainMatchIngestQueueFolder(client)
    const phaseStepId = randomUUID()
    matchIngestStepContext = {
      stepId: phaseStepId,
      counters,
      onIngested: () => {},
      syncLiveCounters: () => syncLiveCounters(true),
      logger,
      playerTrackers: null,
      flagsRef: flags,
    }
  }

  const patchWindowForMatchList = latestPatchDateWindow ?? matchListTimeWindow

  // ── Phase 1: Collect match work items across all players ──────────────

  type PlayerTracker = {
    player: typeof players[number]
    matchIds: string[]
    toFetchCount: number
    pendingTransientIngest: boolean
    ingestedIds: string[]
    playersFetchedBefore: number
  }
  const playerTrackers: PlayerTracker[] = []
  if (useAsyncMatchIngestQueue && matchIngestStepContext) {
    matchIngestStepContext.playerTrackers = playerTrackers as MatchIngestPlayerTrackerRef[]
  }
  type MatchWorkItem = { matchId: string; trackerIdx: number }
  const workItems: MatchWorkItem[] = []

  try {
  // Validate puuids first (no API calls)
  const validPlayers: typeof players[number][] = []
  for (const player of players) {
    counters.playersPolled++
    syncLiveCounters()
    if (state.shouldStop) return 'ok'

    if (!isLikelyRiotPuuid(player.puuid)) {
      await logger.info('Skip player with invalid puuid format', {
        playerId: player.id.toString(),
        puuid: player.puuid,
      })
      await prisma.player.update({
        where: { id: player.id },
        data: { puuidKeyVersion: 'perdu' },
      }).catch(() => undefined)
      continue
    }
    validPlayers.push(player)
  }
  syncLiveCounters(true)

  // Fetch match IDs with bounded parallelism to avoid burst waves on league-v4.
  let phase1QueryNull = 0
  const matchIdResults: Array<{
    player: (typeof validPlayers)[number]
    res:
      | { ok: true; data: string[] }
      | { ok: false; status: number; message?: string; body?: unknown }
    queryNull: boolean
  }> = new Array(validPlayers.length)
  let nextPlayerIdx = 0
  const lookupWorkers = Math.min(getMatchIdsLookupConcurrency(), Math.max(1, validPlayers.length))
  await Promise.all(
    Array.from({ length: lookupWorkers }, async () => {
      while (true) {
        const idx = nextPlayerIdx++
        if (idx >= validPlayers.length) break
        const player = validPlayers[idx]
        const query = buildMatchIdsQueryForPlayer(player, filters, patchWindowForMatchList)
        if (query == null) {
          phase1QueryNull++
          matchIdResults[idx] = {
            player,
            res: { ok: true, data: [] as string[] },
            queryNull: true,
          }
          continue
        }
        const res = await client.getMatchIdsByPuuid(player.puuid, query, riotIngestRequestOptions())
        matchIdResults[idx] = { player, res, queryNull: false }
      }
    })
  )

  // Phase 1 diagnostics
  let phase1TotalIds = 0
  let phase1InDb = 0
  let phase1InBackoff = 0
  let phase1InTimelineRetry = 0
  let phase1InPendingIngest = 0
  let phase1ToFetch = 0
  let phase1ApiError = 0

  // Process results sequentially (DB lookups, tracker creation)
  for (const { player, res, queryNull } of matchIdResults) {
    if (!res.ok) {
      phase1ApiError++
      if (res.status === 0) counters.timeoutCount++
      if (res.message === RIOT_INGEST_ABORTED_MESSAGE) return 'ok'
      if (res.status === 400 && is400Decrypt(res.body)) {
        counters.error400Count++
        await logger.error('400 decrypt', res.body)
        return '400_decrypt'
      }
      logPollerRiotApiToUnified('Riot liste match ids by puuid échouée', {
        region,
        playerId: player.id.toString(),
        puuid: puuidLogTag(player.puuid),
        httpStatus: res.status,
        message: res.message ?? null,
      })
      continue
    }

    const matchIds = Array.isArray(res.data) ? res.data : []
    phase1TotalIds += matchIds.length
    const existing = await prisma.ingestMatch.findMany({
      where: { riotMatchId: { in: matchIds } },
      select: { riotMatchId: true },
    })
    const existingSet = new Set(existing.map((m) => m.riotMatchId))
    phase1InDb += existingSet.size
    const nowMs = Date.now()
    const toFetch = matchIds.filter((id) => {
      if (existingSet.has(id)) return false
      if (!canAttemptTimelineFetchNow(id, nowMs)) { phase1InTimelineRetry++; return false }
      if (!canAttemptMatchIngestNow(id, nowMs)) { phase1InBackoff++; return false }
      if (matchIngestPending.has(id)) { phase1InPendingIngest++; return false }
      return true
    })
    phase1ToFetch += toFetch.length

    const trackerIdx = playerTrackers.length
    const tracker: PlayerTracker = {
      player,
      matchIds,
      toFetchCount: toFetch.length,
      pendingTransientIngest: false,
      ingestedIds: [],
      playersFetchedBefore: counters.playersFetched,
    }
    playerTrackers.push(tracker)

    if (toFetch.length === 0) {
      await prisma.player.update({
        where: { id: player.id },
        data: { lastSeen: new Date() },
      })
      await logger.step('Player matches fetched', {
        playerId: player.id.toString(),
        region,
        matchesCount: matchIds.length,
        newPlayersCount: 0,
        queryNull,
      })
      continue
    }

    for (const matchId of toFetch) {
      workItems.push({ matchId, trackerIdx })
    }
  }
  counters.matchIdsFromApi += phase1TotalIds
  counters.existingMatchesSkipped += phase1InDb
  syncLiveCounters(true)

  const uniqueWorkItems: MatchWorkItem[] = []
  const seenWorkMatchIds = new Set<string>()
  let duplicateWorkItems = 0
  for (const item of workItems) {
    if (seenWorkMatchIds.has(item.matchId)) {
      duplicateWorkItems++
      continue
    }
    if (matchIngestPending.has(item.matchId)) {
      duplicateWorkItems++
      continue
    }
    seenWorkMatchIds.add(item.matchId)
    uniqueWorkItems.push(item)
  }

  // Log Phase 1 summary to unified log for diagnostics
  void appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'poller_diag',
    message: `Phase1 ${region} — players:${validPlayers.length} queryNull:${phase1QueryNull} idsFromApi:${phase1TotalIds} inDb:${phase1InDb} inBackoff:${phase1InBackoff} inTimelineRetry:${phase1InTimelineRetry} inPendingIngest:${phase1InPendingIngest} toFetch:${phase1ToFetch} apiErr:${phase1ApiError} workItems:${workItems.length} uniqueWorkItems:${uniqueWorkItems.length} duplicates:${duplicateWorkItems}`,
    json: {
      region,
      players: validPlayers.length,
      queryNull: phase1QueryNull,
      idsFromApi: phase1TotalIds,
      inDb: phase1InDb,
      inBackoff: phase1InBackoff,
      inTimelineRetry: phase1InTimelineRetry,
      inPendingIngest: phase1InPendingIngest,
      toFetch: phase1ToFetch,
      apiError: phase1ApiError,
      workItems: workItems.length,
      uniqueWorkItems: uniqueWorkItems.length,
      duplicateWorkItems,
      timelineRetryMapSize: timelineRetryState.size,
      matchIngestBackoffMapSize: matchIngestBackoffUntilMs.size,
    },
  })

  if (uniqueWorkItems.length === 0) return flags.foundPrismaError ? 'prisma_error' : 'ok'

  // ── Phase 2: Pipeline — concurrent API fetch + DB ingest (chunked) ───
  // Default path: in-memory queue + concurrent Prisma consumers.
  // File queue (MATCH_INGEST_FILE_QUEUE): write JSON to disk; ingest runs async (background + drain) so HTTP is not blocked by DB.

  const PIPELINE_QUEUE_MAX = 300
  const INGEST_CONSUMERS = 6
  const chunkSize = getPipelineChunkWorkItems()
  const FILE_QUEUE_BACKPRESS = getMatchIngestQueueMaxDepth()

  let pipelineAbort: '400_decrypt' | 'abort' | null = null

  if (useAsyncMatchIngestQueue && matchIngestStepContext) {
    matchIngestStepContext.onIngested = (trackerIdx, canonicalId) => {
      const t = playerTrackers[trackerIdx]
      if (t) t.ingestedIds.push(canonicalId)
    }
  }
  const fileQueueStepId = matchIngestStepContext?.stepId ?? ''

  for (let chunkStart = 0; chunkStart < uniqueWorkItems.length; chunkStart += chunkSize) {
    const chunk = uniqueWorkItems.slice(chunkStart, chunkStart + chunkSize)
    for (const item of chunk) {
      matchIngestPending.add(item.matchId)
    }
    const fileQueueDepth = useRawMatchIngestQueue
      ? (await syncRawIngestDepthEstimates()).pending
      : useFileMatchIngestQueue
        ? await syncMatchIngestQueueDepthEstimate()
        : 0
    void appendUnifiedLog({
      section: 'back',
      type: 'info',
      script: 'poller_diag',
      message: `Phase2 chunk ${region} — offset:${chunkStart} size:${chunk.length} total:${uniqueWorkItems.length} chunkSize:${chunkSize} asyncQueue:${useAsyncMatchIngestQueue ? 1 : 0} rawQueue:${useRawMatchIngestQueue ? 1 : 0} queueDepth:${fileQueueDepth}`,
      json: {
        region,
        chunkStart,
        chunkLen: chunk.length,
        totalWorkItems: uniqueWorkItems.length,
        chunkSize,
        fileQueue: useFileMatchIngestQueue,
        rawQueue: useRawMatchIngestQueue,
        fileQueueDepth,
      },
    })

    pipelineAbort = null

    if (!useAsyncMatchIngestQueue) {
      const ingestQueue: Array<{
        matchId: string
        trackerIdx: number
        matchDto: RiotMatchDto
        timelineDto: RiotMatchTimelineDto | null
      }> = []
      let producerDone = false

      const phase2IngestOpts: MatchIngestOptions = { shouldAbort: () => state.shouldStop }
      const runIngestConsumer = async (): Promise<void> => {
        while (true) {
          if (pipelineAbort || state.shouldStop) break
          if (ingestQueue.length > 0) {
            const item = ingestQueue.shift()!
            const tracker = playerTrackers[item.trackerIdx]
            try {
              const { matchDbId, canonicalRiotMatchId } = await upsertIngestMatchAndParticipants(
                client,
                region,
                item.matchId,
                item.matchDto,
                puuidKeyVersion,
                counters,
                logger,
                phase2IngestOpts
              )
              if (item.timelineDto) {
                await extractAndInsertJungleFirstClear(matchDbId, canonicalRiotMatchId, item.timelineDto, logger)
                await extractIngestTimelineExtras(
                  matchDbId,
                  canonicalRiotMatchId,
                  item.timelineDto,
                  item.matchDto.info?.participants ?? [],
                  logger
                )
              }
              tracker.ingestedIds.push(canonicalRiotMatchId)
              clearMatchIngestCooldownKeys(item.matchId, canonicalRiotMatchId)
              syncLiveCounters()
            } catch (err) {
              const skipped = unwrapMatchIngestSkipped(err)
              if (skipped) {
                matchIngestPending.delete(item.matchId)
                await logger.info('Match ingest skipped', {
                  playerId: tracker.player.id.toString(),
                  matchId: item.matchId,
                  reason: skipped.reason,
                })
                continue
              }
              if (err instanceof Error && err.message === RIOT_INGEST_ABORTED_MESSAGE) return
              tracker.pendingTransientIngest = true
              matchIngestPending.delete(item.matchId)
              await logger.error('Player match ingest failed', {
                playerId: tracker.player.id.toString(),
                matchId: item.matchId,
                error: err instanceof Error ? err.message : String(err),
              })
              await recordMatchIngestFailure(item.matchId, logger)
              flags.foundPrismaError = true
              syncLiveCounters()
            }
          } else if (producerDone) {
            break
          } else {
            await sleep(10)
          }
        }
      }

      let workIdx = 0
      const runProducerWorker = async (): Promise<void> => {
        while (!state.shouldStop && !pipelineAbort) {
          const idx = workIdx++
          if (idx >= chunk.length) break
          const work = chunk[idx]

          while (ingestQueue.length >= PIPELINE_QUEUE_MAX && !state.shouldStop && !pipelineAbort) {
            await sleep(10)
          }
          if (state.shouldStop || pipelineAbort) break

          const tracker = playerTrackers[work.trackerIdx]
          const strict = await fetchMatchAndTimelineStrict(work.matchId)
          if (!strict.ok) {
            if (strict.reason === '400_decrypt') { pipelineAbort = '400_decrypt'; break }
            if (strict.reason === 'abort') { pipelineAbort = 'abort'; break }
            if (strict.reason === 'version') {
              matchIngestPending.delete(work.matchId)
              await logger.info('Match skipped (game version not in allowed range)', {
                playerId: tracker.player.id.toString(),
                matchId: work.matchId,
              })
              continue
            }
            if (strict.reason === 'deferred_patch') {
              matchIngestPending.delete(work.matchId)
              await logger.info('Match deferred (latest patch priority mode)', {
                playerId: tracker.player.id.toString(),
                matchId: work.matchId,
                latestPatch: patchPolicy.latestPatch,
                allowedPatches: priorityAllowedPatches,
              })
              continue
            }
            if (strict.reason === 'transient') {
              if (!strict.matchDto) {
                matchIngestPending.delete(work.matchId)
                await recordMatchIngestFailure(work.matchId, logger)
                await logger.info('Match detail fetch failed (API), will retry later', {
                  playerId: tracker.player.id.toString(),
                  matchId: work.matchId,
                })
                continue
              }
              ingestQueue.push({
                matchId: work.matchId,
                trackerIdx: work.trackerIdx,
                matchDto: strict.matchDto,
                timelineDto: null,
              })
              continue
            }
            matchIngestPending.delete(work.matchId)
            continue
          }

          ingestQueue.push({
            matchId: work.matchId,
            trackerIdx: work.trackerIdx,
            matchDto: strict.matchDto,
            timelineDto: strict.timelineDto,
          })
        }
      }

      await Promise.all(Array.from({ length: getParallelMatchIngestFetches() }, () => runProducerWorker()))
      syncLiveCounters(true)

      producerDone = true
      await Promise.all(Array.from({ length: INGEST_CONSUMERS }, () => runIngestConsumer()))
      syncLiveCounters(true)
    } else {
      let workIdx = 0
      const runProducerWorkerFile = async (): Promise<void> => {
        while (!state.shouldStop && !pipelineAbort) {
          const idx = workIdx++
          if (idx >= chunk.length) break
          const work = chunk[idx]

          while (
            (useRawMatchIngestQueue
              ? (await syncRawIngestDepthEstimates()).pending
              : await syncMatchIngestQueueDepthEstimate()) >= FILE_QUEUE_BACKPRESS &&
            !state.shouldStop &&
            !pipelineAbort
          ) {
            await sleep(10)
          }
          if (state.shouldStop || pipelineAbort) break

          const tracker = playerTrackers[work.trackerIdx]
          const strict = await fetchMatchAndTimelineStrict(work.matchId)
          if (!strict.ok) {
            if (strict.reason === '400_decrypt') { pipelineAbort = '400_decrypt'; break }
            if (strict.reason === 'abort') { pipelineAbort = 'abort'; break }
            if (strict.reason === 'version') {
              matchIngestPending.delete(work.matchId)
              await logger.info('Match skipped (game version not in allowed range)', {
                playerId: tracker.player.id.toString(),
                matchId: work.matchId,
              })
              continue
            }
            if (strict.reason === 'deferred_patch') {
              matchIngestPending.delete(work.matchId)
              await logger.info('Match deferred (latest patch priority mode)', {
                playerId: tracker.player.id.toString(),
                matchId: work.matchId,
                latestPatch: patchPolicy.latestPatch,
                allowedPatches: priorityAllowedPatches,
              })
              continue
            }
            if (strict.reason === 'transient') {
              if (!strict.matchDto) {
                matchIngestPending.delete(work.matchId)
                await recordMatchIngestFailure(work.matchId, logger)
                await logger.info('Match detail fetch failed (API), will retry later', {
                  playerId: tracker.player.id.toString(),
                  matchId: work.matchId,
                })
                continue
              }
              try {
                const payload: MatchIngestQueuePayloadV1 = {
                  v: 1,
                  stepId: fileQueueStepId,
                  matchId: work.matchId,
                  region,
                  matchDto: strict.matchDto,
                  timelineDto: null,
                  puuidKeyVersion,
                  trackerIdx: work.trackerIdx,
                  enqueuedAt: Date.now(),
                }
                const r = useRawMatchIngestQueue
                  ? await tryInsertRawIngestPayload(payload)
                  : await tryEnqueueMatchIngestPayload(payload)
                matchIngestPending.delete(work.matchId)
                if (r === 'written') {
                  if (useRawMatchIngestQueue) noteRawIngestQueueDepthDelta(1)
                  else noteMatchIngestQueueDepthDelta(1)
                  syncLiveCounters()
                }
              } catch (e) {
                tracker.pendingTransientIngest = true
                if (useRawMatchIngestQueue && useFileMatchIngestQueue) {
                  try {
                    await tryEnqueueMatchIngestPayload({
                      v: 1,
                      stepId: fileQueueStepId,
                      matchId: work.matchId,
                      region,
                      matchDto: strict.matchDto,
                      timelineDto: null,
                      puuidKeyVersion,
                      trackerIdx: work.trackerIdx,
                      enqueuedAt: Date.now(),
                    })
                    rawIngestFallbackWrites++
                    noteMatchIngestQueueDepthDelta(1)
                    matchIngestPending.delete(work.matchId)
                    syncLiveCounters()
                    continue
                  } catch {
                    // keep original error logging path
                  }
                }
                await logger.error('Match ingest queue write failed', {
                  matchId: work.matchId,
                  error: e instanceof Error ? e.message : String(e),
                })
              }
              continue
            }
            matchIngestPending.delete(work.matchId)
            continue
          }

          try {
            const payload: MatchIngestQueuePayloadV1 = {
              v: 1,
              stepId: fileQueueStepId,
              matchId: work.matchId,
              region,
              matchDto: strict.matchDto,
              timelineDto: strict.timelineDto,
              puuidKeyVersion,
              trackerIdx: work.trackerIdx,
              enqueuedAt: Date.now(),
            }
            const r = useRawMatchIngestQueue
              ? await tryInsertRawIngestPayload(payload)
              : await tryEnqueueMatchIngestPayload(payload)
            matchIngestPending.delete(work.matchId)
            if (r === 'written') {
              if (useRawMatchIngestQueue) noteRawIngestQueueDepthDelta(1)
              else noteMatchIngestQueueDepthDelta(1)
              syncLiveCounters()
            }
          } catch (e) {
            tracker.pendingTransientIngest = true
            if (useRawMatchIngestQueue && useFileMatchIngestQueue) {
              try {
                await tryEnqueueMatchIngestPayload({
                  v: 1,
                  stepId: fileQueueStepId,
                  matchId: work.matchId,
                  region,
                  matchDto: strict.matchDto,
                  timelineDto: strict.timelineDto,
                  puuidKeyVersion,
                  trackerIdx: work.trackerIdx,
                  enqueuedAt: Date.now(),
                })
                rawIngestFallbackWrites++
                noteMatchIngestQueueDepthDelta(1)
                matchIngestPending.delete(work.matchId)
                syncLiveCounters()
                continue
              } catch {
                // keep original error logging path
              }
            }
            await logger.error('Match ingest queue write failed', {
              matchId: work.matchId,
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      }

      await Promise.all(Array.from({ length: getParallelMatchIngestFetches() }, () => runProducerWorkerFile()))
      syncLiveCounters(true)
    }

    for (const item of chunk) {
      matchIngestPending.delete(item.matchId)
    }

    if (pipelineAbort === '400_decrypt') return '400_decrypt'
    if (pipelineAbort === 'abort') return 'ok'
  }

  if (useAsyncMatchIngestQueue) {
    await drainMatchIngestQueueFolder(client)
    matchIngestStepContext = null
  }

  // ── Phase 3: Post-processing — verify ingested, lastSeen, logging ─────

  for (const tracker of playerTrackers) {
    if (tracker.toFetchCount === 0) continue

    if (tracker.ingestedIds.length > 0) {
      const dbCount = await prisma.ingestMatch.count({
        where: { riotMatchId: { in: tracker.ingestedIds } },
      })
      if (dbCount !== tracker.ingestedIds.length) {
        await appendUnifiedLog({
          section: 'db',
          type: 'warning',
          script: 'poller',
          message: `Écart DB: ${tracker.ingestedIds.length} match(s) attendus, ${dbCount} présents`,
          json: {
            playerId: tracker.player.id.toString(),
            region,
            expected: tracker.ingestedIds.length,
            dbCount,
            riotMatchIdsSample: tracker.ingestedIds.slice(0, 32),
          },
        })
      }
    }

    if (!tracker.pendingTransientIngest && !state.shouldStop) {
      await prisma.player.update({
        where: { id: tracker.player.id },
        data: { lastSeen: new Date() },
      })
    }

    const newPlayersFromPlayer = counters.playersFetched - tracker.playersFetchedBefore
    await logger.step('Player matches fetched', {
      playerId: tracker.player.id.toString(),
      region,
      matchesCount: tracker.matchIds.length,
      newPlayersCount: newPlayersFromPlayer,
      pendingTransientIngest: tracker.pendingTransientIngest,
    })
  }
  syncLiveCounters(true)

  return flags.foundPrismaError ? 'prisma_error' : 'ok'
  } finally {
    if (useFileMatchIngestQueue) {
      matchIngestStepContext = {
        stepId: MATCH_INGEST_ORPHAN_STEP_ID,
        counters,
        onIngested: () => {},
        syncLiveCounters: () => syncLiveCounters(true),
        logger,
        playerTrackers: null,
        flagsRef: flags,
      }
      await drainMatchIngestQueueFolder(client)
      matchIngestStepContext = null
    }
  }
}

/** Resolves the API key and sets it on the client without making a test request. */
export async function initRiotPoller(): Promise<RiotPollerInit | { ok: false }> {
  if (!isDatabaseConfigured()) {
    setState({ lastError: 'DATABASE_URL not set' })
    return { ok: false }
  }
  const logger = createRiotPollerLogger()
  const rateLimiter = new RiotRateLimiter()
  const client = new RiotHttpClient(rateLimiter, logger, 'poller')
  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) {
    await logger.error('Failed to load match-filters', filtersRes.unwrapErr())
    setState({ lastError: 'match-filters config' })
    return { ok: false }
  }
  const filters = filtersRes.unwrap()
  await loadCurrentGameVersion()

  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) {
    await logger.error('No API key configured', resolved.error)
    setState({ lastError: resolved.error })
    return { ok: false }
  }
  client.setKey(resolved.key, resolved.source, resolved.clefType)
  await logger.step('API key loaded', { source: resolved.source, keyLen: resolved.key.length })

  client.setOnHttpResponse(({ httpStatus }) => {
    setState({
      requestCount: state.requestCount + 1,
      ...(httpStatus === 429 ? { error429Count: state.error429Count + 1 } : {}),
    })
  })

  client.setOnInvalidKey(() => {
    const msg = 'API key invalid or expired — stopping poller'
    if (state.shouldStop && state.lastError === msg) return
    setState({ shouldStop: true, lastError: msg })
    void logger.error(msg, {})
  })

  const clefType = client.getActiveKeyInfo()?.clefType ?? null
  return { ok: true, client, rateLimiter, logger, filters, clefType }
}

async function runStep4Counters() {
  return {
    error400Count: state.error400Count,
    matchesFetched: state.matchesFetched,
    matchesApiIngestComplete: state.matchesApiIngestComplete,
    playersFetched: state.playersFetched,
    playersPolled: state.playersPolled,
    participantsFetched: state.participantsFetched,
    playersRankUpdatedLeague: state.playersRankUpdatedLeague,
    matchIdsFromApi: state.matchIdsFromApi,
    existingMatchesSkipped: state.existingMatchesSkipped,
    timeoutCount: state.timeoutCount,
  }
}

async function runLoop(init: RiotPollerInit): Promise<void> {
  const { client, rateLimiter, logger, filters, clefType } = init
  const discord = new DiscordService()
  const hourlySummaryIntervalMs = getPollerHourlySummaryIntervalMs()
  let summaryTicker: ReturnType<typeof setInterval> | null = null
  setState({
    isRunning: true,
    shouldStop: false,
    lastLoopStartedAt: new Date().toISOString(),
    lastError: null,
    requestCount: 0,
    error429Count: 0,
    error400Count: 0,
    matchesFetched: 0,
    matchesApiIngestComplete: 0,
    playersFetched: 0,
    playersPolled: 0,
    participantsFetched: 0,
    playersRankUpdatedLeague: 0,
    matchIdsFromApi: 0,
    existingMatchesSkipped: 0,
    timeoutCount: 0,
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
  })

  try {
    activeMatchIngestClient = client
    startMatchIngestBackgroundProcessor()
    const recapRes = await loadGameVersionsRecap()
    let matchListTimeWindow: { startTime: number; endTime: number } | null = null
    if (recapRes.isOk()) {
      matchListTimeWindow = computeMatchIdsTimeWindow(filters, recapRes.unwrap())
    }
    if (recapRes.isErr()) {
      await logger.step('versions.json indisponible — liste matchs sans startTime/endTime', {
        error: recapRes.unwrapErr().message,
      })
    } else if (matchListTimeWindow) {
      await logger.step('Fenêtre liste matchs (data/game/versions.json → Riot ids)', {
        startTime: matchListTimeWindow.startTime,
        endTime: matchListTimeWindow.endTime,
        startIso: new Date(matchListTimeWindow.startTime * 1000).toISOString(),
        endIso: new Date(matchListTimeWindow.endTime * 1000).toISOString(),
      })
    } else {
      await logger.step(
        'Pas de fenêtre start/end — vérifier match-filters.json vs versions.json (patchLabel)',
        {}
      )
    }

    // ── Main collection loop ──────────────────────────────────────────────────
    let loopIteration = 0
    let heartbeatAtMs = Date.now()
    let heartbeatPlayersPolled = 0
    let heartbeatPlayersFetched = 0
    let heartbeatMatchesFetched = 0
    let heartbeatMatchesApiIngestComplete = 0
    const rawDoneCleanupIntervalMs = getRawIngestDoneCleanupIntervalMs()
    const rawDoneCleanupBatch = getRawIngestDoneCleanupBatch()
    let nextRawDoneCleanupAtMs = Date.now() + rawDoneCleanupIntervalMs
    const initLimiterStats = client.getRateLimiterStats()
    const sw: PollerSummaryWindows = {
      summary30mWindowStartedAtMs: Date.now(),
      summary30mPlayersPolled: state.playersPolled,
      summary30mPlayersFetched: state.playersFetched,
      summary30mMatchesFetched: state.matchesFetched,
      summary30mMatchesApiIngestComplete: state.matchesApiIngestComplete,
      summary30mPlayersRankUpdatedLeague: state.playersRankUpdatedLeague,
      summary30mRequestCount: state.requestCount,
      summary30mError429Count: state.error429Count,
      summary30mParticipantsFetched: state.participantsFetched,
      summary30mNearLimitPauseCount: initLimiterStats.nearLimitPauseCount,
      summary30mHttp429PauseCount: initLimiterStats.http429PauseCount,
      summary30mMatchIdsFromApi: state.matchIdsFromApi,
      summary30mExistingMatchesSkipped: state.existingMatchesSkipped,
      summary30mTimeoutCount: state.timeoutCount,
      hourlyWindowStartedAtMs: Date.now(),
      hourlyPlayersPolled: state.playersPolled,
      hourlyPlayersFetched: state.playersFetched,
      hourlyMatchesFetched: state.matchesFetched,
      hourlyMatchesApiIngestComplete: state.matchesApiIngestComplete,
      hourlyPlayersRankUpdatedLeague: state.playersRankUpdatedLeague,
      hourlyRequestCount: state.requestCount,
      hourlyError429Count: state.error429Count,
      hourlyParticipantsFetched: state.participantsFetched,
      hourlyNearLimitPauseCount: initLimiterStats.nearLimitPauseCount,
      hourlyHttp429PauseCount: initLimiterStats.http429PauseCount,
      hourlyMatchIdsFromApi: state.matchIdsFromApi,
      hourlyExistingMatchesSkipped: state.existingMatchesSkipped,
      hourlyTimeoutCount: state.timeoutCount,
    }

    let summaryEmitChain: Promise<void> = Promise.resolve()
    const scheduleSummaryEmit = (): void => {
      summaryEmitChain = summaryEmitChain
        .then(() => emitPollerSummariesIfDue(client, hourlySummaryIntervalMs, sw))
        .catch(() => undefined)
    }
    summaryTicker = setInterval(scheduleSummaryEmit, 60_000)

    while (!state.shouldStop && isDatabaseConfigured()) {
      loopIteration++
      if (isRawIngestQueueEnabled()) {
        const recovered = await requeueRawIngestStaleProcessing(
          getRawIngestStaleProcessingMaxAgeMs(),
          getRawIngestStaleProcessingRequeueBatch()
        ).catch(() => 0)
        if (recovered > 0) {
          noteRawIngestQueueDepthDelta(recovered)
          void appendUnifiedLog({
            section: 'back',
            type: 'warning',
            script: 'poller_ingest',
            message: `Raw ingest recovery: ${recovered} ligne(s) stale processing -> pending`,
            json: {
              recovered,
              staleMaxAgeMs: getRawIngestStaleProcessingMaxAgeMs(),
            },
          })
        }
        const moved = await requeueRawIngestErrors(getRawIngestErrorRequeueBatch()).catch(() => 0)
        if (moved > 0) {
          noteRawIngestQueueDepthDelta(moved)
          void appendUnifiedLog({
            section: 'back',
            type: 'info',
            script: 'poller_ingest',
            message: `Raw ingest requeue: ${moved} ligne(s) error -> pending`,
            json: { moved },
          })
        }
        if (Date.now() >= nextRawDoneCleanupAtMs) {
          const deleted = await deleteDoneRawIngestRows(rawDoneCleanupBatch).catch(() => 0)
          nextRawDoneCleanupAtMs = Date.now() + rawDoneCleanupIntervalMs
          void appendUnifiedLog({
            section: 'back',
            type: 'info',
            script: 'poller_ingest',
            message: `Raw ingest cleanup done rows: ${deleted}`,
            json: {
              deleted,
              batch: rawDoneCleanupBatch,
              cleanupIntervalMs: rawDoneCleanupIntervalMs,
            },
          })
        }
      }

      const diskUsage = await getDiskUsagePercent(process.cwd())
      if (diskUsage != null) {
        const roundedUsage = Math.round(diskUsage * 10) / 10
        for (const threshold of DISK_ALERT_THRESHOLDS) {
          if (diskUsage >= threshold && !diskAlertedThresholds.has(threshold)) {
            diskAlertedThresholds.add(threshold)
            await logger.alerte(
              `Disk usage alert: ${roundedUsage}% used (threshold ${threshold}%)`
            )
            await discord.sendAlert(
              'Riot Poller disk usage alert',
              `Disk usage reached ${roundedUsage}% (threshold ${threshold}%).`
            )
          }
        }
        if (diskUsage >= DISK_STOP_THRESHOLD) {
          if (!diskStopAlertSent) {
            diskStopAlertSent = true
            await logger.alerte(
              `Disk usage critical: ${roundedUsage}% used. Stopping poller to protect server.`
            )
            await discord.sendAlert(
              'Riot Poller stopped: critical disk usage',
              `Disk usage reached ${roundedUsage}% (>= ${DISK_STOP_THRESHOLD}%). Poller stopped automatically to prevent server crash.`
            )
          }
          requestStopRiotPoller()
          continue
        }
      }

      // EUW1 collection
      client.setPlatform('euw1')
      const countersEuw = await runStep4Counters()
      const requestCountBeforeEuw = state.requestCount
      const resultEuw = await runStep4ForPlayer(
        client,
        logger,
        filters,
        'euw1',
        clefType,
        countersEuw,
        matchListTimeWindow
      )
      setState({
        error400Count: countersEuw.error400Count,
        matchesFetched: countersEuw.matchesFetched,
        matchesApiIngestComplete: countersEuw.matchesApiIngestComplete,
        playersFetched: countersEuw.playersFetched,
        playersPolled: countersEuw.playersPolled,
        participantsFetched: countersEuw.participantsFetched,
        playersRankUpdatedLeague: countersEuw.playersRankUpdatedLeague,
        matchIdsFromApi: countersEuw.matchIdsFromApi,
        existingMatchesSkipped: countersEuw.existingMatchesSkipped,
        timeoutCount: countersEuw.timeoutCount,
      })
      if (resultEuw === '400_decrypt') {
        setTriggerPuuidMigrationOnPollerExit(true)
        requestStopRiotPoller()
        continue
      }
      if (resultEuw === 'prisma_error') {
        await logger.alerte('Prisma error in step 4 (euw1), continuing', {
          region: 'euw1',
          loopIteration,
          httpRequestsTotal: state.requestCount,
          httpRequestsDeltaThisRegion: state.requestCount - requestCountBeforeEuw,
        })
      }

      // EUN1 collection — skip when no pollable rows (tout le monde en euw1, etc.)
      const eunPollableCount = await prisma.player.count({
        where: {
          region: 'eun1',
          ...(clefType
            ? { puuidKeyVersion: clefType }
            : { puuidKeyVersion: { notIn: ['erreur', 'perdu'] } }),
        },
      })
      if (eunPollableCount === 0) {
        if (!eunRegionSkipInfoLogged) {
          eunRegionSkipInfoLogged = true
          void appendUnifiedLog({
            section: 'back',
            type: 'info',
            script: 'poller',
            message:
              'Collecte EUN1 ignorée — aucun joueur avec players.region=eun1 (hors puuidKeyVersion erreur/perdu)',
            json: { eunPollableCount: 0 },
          })
        }
      } else {
        eunRegionSkipInfoLogged = false
        client.setPlatform('eun1')
        const countersEun = await runStep4Counters()
        const requestCountBeforeEun = state.requestCount
        const resultEun = await runStep4ForPlayer(
          client,
          logger,
          filters,
          'eun1',
          clefType,
          countersEun,
          matchListTimeWindow
        )
        setState({
          error400Count: countersEun.error400Count,
          matchesFetched: countersEun.matchesFetched,
          matchesApiIngestComplete: countersEun.matchesApiIngestComplete,
          playersFetched: countersEun.playersFetched,
          playersPolled: countersEun.playersPolled,
          participantsFetched: countersEun.participantsFetched,
          playersRankUpdatedLeague: countersEun.playersRankUpdatedLeague,
          matchIdsFromApi: countersEun.matchIdsFromApi,
          existingMatchesSkipped: countersEun.existingMatchesSkipped,
          timeoutCount: countersEun.timeoutCount,
        })
        if (resultEun === '400_decrypt') {
          setTriggerPuuidMigrationOnPollerExit(true)
          requestStopRiotPoller()
          continue
        }
        if (resultEun === 'prisma_error') {
          await logger.alerte('Prisma error in step 4 (eun1), continuing', {
            region: 'eun1',
            loopIteration,
            httpRequestsTotal: state.requestCount,
            httpRequestsDeltaThisRegion: state.requestCount - requestCountBeforeEun,
          })
        }
      }

      // ── Sync active_patches (cadence: 4h) — refresh MV délégué au cron API (groupes décalés) ──
      if (Date.now() - lastSyncActivePatchesAt >= SYNC_ACTIVE_PATCHES_EVERY_MS) {
        try {
          await syncActivePatches()
          lastSyncActivePatchesAt = Date.now()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          await logger.alerte('syncActivePatches error (non-fatal)', errorMessage)
          lastSyncActivePatchesAt = Date.now()
        }
      }

      // ── Clôture patches passés ayant atteint maxMatches (archive + suppression brutes) ──
      if (loopIteration % 200 === 0) {
        try {
          await runPatchCleanupFromConfig(logger)
        } catch (err) {
          await logger.alerte('Patch cleanup error (non-fatal)')
          void err
        }
      }

      // ── Snapshot quotidien WR / pick / bans par tier (UTC), une fois par jour après l’heure configurée ──
      try {
        await tryRunChampionTierDailySnapshot(logger)
      } catch (err) {
        await logger.alerte('Champion tier snapshot check error (non-fatal)')
        void err
      }

      cleanupGlobalRankCache()

      const now = Date.now()
      if (now - heartbeatAtMs >= 60_000) {
        const deltaPlayersPolled = state.playersPolled - heartbeatPlayersPolled
        const deltaPlayersFetched = state.playersFetched - heartbeatPlayersFetched
        const deltaMatchesFetched = state.matchesFetched - heartbeatMatchesFetched
        const deltaMatchesApi = state.matchesApiIngestComplete - heartbeatMatchesApiIngestComplete
        // newMatches = nouvelles lignes en DB ; matchPairsApiOk = détail+timeline OK (activité API même sans nouvelle ligne).
        console.log(
          '[RiotPoller] Ping 60s',
          JSON.stringify({
            playersPolled: deltaPlayersPolled,
            newPlayersAdded: deltaPlayersFetched,
            newMatches: deltaMatchesFetched,
            matchPairsApiOk: deltaMatchesApi,
            totals: {
              playersPolled: state.playersPolled,
              newPlayersAdded: state.playersFetched,
              newMatches: state.matchesFetched,
              matchPairsApiOk: state.matchesApiIngestComplete,
            },
          })
        )
        heartbeatPlayersPolled = state.playersPolled
        heartbeatPlayersFetched = state.playersFetched
        heartbeatMatchesFetched = state.matchesFetched
        heartbeatMatchesApiIngestComplete = state.matchesApiIngestComplete
        heartbeatAtMs = now
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logger.error('Poller loop error', msg)
    setState({ lastError: msg })
  } finally {
    stopMatchIngestBackgroundProcessor()
    activeMatchIngestClient = null
    if (summaryTicker != null) {
      clearInterval(summaryTicker)
      summaryTicker = null
    }
    await rateLimiter.disconnect().catch(() => undefined)
    setState({ isRunning: false, shouldStop: false, lastLoopFinishedAt: new Date().toISOString() })
    const stopped = getRiotPollerStatus()
    console.log(
      '[RiotPoller] Poller stopped',
      JSON.stringify({
        requestCount: stopped.requestCount,
        error429: stopped.error429Count,
        matchesFetched: stopped.matchesFetched,
        playersFetched: stopped.playersFetched,
        playersPolled: stopped.playersPolled,
        participantsFetched: stopped.participantsFetched,
      })
    )
  }
}

export function getRiotPollerStatus(): RiotPollerStatus {
  return { ...state }
}

export function requestStopRiotPoller(): void {
  setState({ shouldStop: true })
}

export function startRiotPoller(): void {
  if (state.isRunning) return
  if (!isDatabaseConfigured()) {
    console.warn('[RiotPoller] DATABASE_URL not set, poller not started')
    return
  }
  diskAlertedThresholds.clear()
  diskStopAlertSent = false
  setState({ shouldStop: false })
  loopPromise = (async () => {
    const init = await initRiotPoller()
    if (!init.ok) {
      setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString() })
      return
    }
    await runLoop(init)
  })()
  loopPromise.catch((err) => console.error('[RiotPoller] runLoop failed:', err))
}

/** Returns the active loop promise so the orchestrator can await its completion. */
export function getPollerLoopPromise(): Promise<void> | null {
  return loopPromise
}

export function isRiotPollerRunning(): boolean {
  return state.isRunning
}
