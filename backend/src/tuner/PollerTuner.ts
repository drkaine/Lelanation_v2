import { riotConfig } from '../riot-gateway/config/riotConfig.js';
import type { ApiKeyType, GatewayStatus } from '../riot-gateway/types.js';
import { ExponentialMovingAverage } from './ExponentialMovingAverage.js';
import { LimitChangeDetector } from './LimitChangeDetector.js';
import { tunerLogger } from './TuningLogger.js';
import type { SessionFeedback, TunerSnapshot, TuningContext, TuningParams } from './types.js';

export const TUNER_MAX_DISCOVERY_FETCH = 200;

const WARMUP_SESSIONS = Number.parseInt(process.env.TUNER_WARMUP_SESSIONS ?? '5', 10);
const TARGET_SESSION_DURATION = Number.parseInt(process.env.TUNER_SESSION_DURATION_S ?? '30', 10);
const EMA_ALPHA = Number.parseFloat(process.env.TUNER_EMA_ALPHA ?? '0.3');
const WARMUP_MULTIPLIER = 0.5;
const RATCHET_STEP = Number.parseFloat(process.env.TUNER_RATCHET_STEP ?? '0.02');
const RATCHET_MAX = Number.parseFloat(process.env.TUNER_RATCHET_MAX ?? '0.20');
const RATCHET_DECAY_SESSIONS = Number.parseInt(process.env.TUNER_RATCHET_DECAY ?? '10', 10);
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 200;
const MAX_PLAYERS_PER_SESSION = Number.parseInt(process.env.MAX_PLAYERS_PER_SESSION ?? '500', 10);
const MATCH_LATENCY_EMA_ALPHA = 0.2;
const MATCH_LATENCY_SEED_MS = 2600;
const MIN_CONCURRENT = 1;
const MAX_CONCURRENT_PLAYERS = 20;
const MAX_CONCURRENT_MATCHES = 20;
const MAX_CONCURRENT_RANKS = 10;
const QUEUE_PRESSURE_FACTOR = 0.7;
const REQ_PER_PLAYER_SEED = 25;
const REQ_PER_MATCH_SEED = 3;
const CACHE_HIT_RATE_SEED = 0.5;
const PERSONAL_WARMUP_MULTIPLIER = Number.parseFloat(process.env.PERSONAL_WARMUP_MULTIPLIER ?? '0.9');
/** Keep the gateway queue fed between match/DB gaps (gateway still throttles to ~95 tokens/120s). */
const PERSONAL_MAX_CONCURRENT_PLAYERS = Number.parseInt(process.env.PERSONAL_MAX_CONCURRENT_PLAYERS ?? '2', 10);
const PERSONAL_MAX_CONCURRENT_MATCH_FETCHES = Number.parseInt(
  process.env.PERSONAL_MAX_CONCURRENT_MATCH_FETCHES ?? '4',
  10,
);
const PERSONAL_MAX_PARTICIPANT_RANK_CONCURRENCY = Number.parseInt(
  process.env.PERSONAL_MAX_PARTICIPANT_RANK_CONCURRENCY ?? '2',
  10,
);
const MAX_SESSIONS_BY_KEY: Record<ApiKeyType, number> = {
  personal: Number.parseInt(process.env.PERSONAL_MAX_CONCURRENT_SESSIONS ?? '2', 10),
  production: Number.parseInt(process.env.PRODUCTION_MAX_CONCURRENT_SESSIONS ?? '20', 10),
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function backpressureThreshold(): number {
  return Number.parseInt(process.env.BACKPRESSURE_THRESHOLD ?? '500', 10);
}

function extractLimits(status: GatewayStatus): {
  limit120s: number;
  limit1s: number;
  fromFallback: boolean;
} {
  const bucket120s = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
  const bucket1s = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);

  if (!bucket120s || !bucket1s) {
    const fallback = riotConfig.fallbackLimits[riotConfig.apiKeyType].app;
    const limit120s = fallback.find((w) => w.windowMs === 120_000)?.limit ?? 99;
    const limit1s = fallback.find((w) => w.windowMs === 1_000)?.limit ?? 19;
    return { limit120s, limit1s, fromFallback: true };
  }

  return { limit120s: bucket120s.limit, limit1s: bucket1s.limit, fromFallback: false };
}

export class PollerTuner {
  private static instance: PollerTuner | null = null;

  private readonly reqPerPlayerEma: ExponentialMovingAverage;
  private readonly reqPerMatchEma: ExponentialMovingAverage;
  private readonly cacheHitRateEma: ExponentialMovingAverage;
  private readonly matchLatencyEma: ExponentialMovingAverage;
  private lastSessionDispatchS = 0;
  private lastSessionWallClockS = 0;
  private readonly limitDetector = new LimitChangeDetector();
  private sessionCount = 0;
  private lastComputedParams: TuningParams | null = null;
  private consecutiveMinParams = 0;
  private effectiveSafetyMargin = riotConfig.safetyMargin;
  private sessionsWithout429 = 0;
  private utilizationCorrection = 1.0;
  private sessionsSinceCorrection = 0;
  private utilizationSamples: number[] = [];
  private readonly correctionStep = 0.1;
  private readonly correctionMax = 2.0;
  private readonly correctionMin = 0.5;
  private readonly correctionSessions = 3;

  private constructor() {
    this.reqPerPlayerEma = new ExponentialMovingAverage(EMA_ALPHA, REQ_PER_PLAYER_SEED);
    this.reqPerMatchEma = new ExponentialMovingAverage(EMA_ALPHA, REQ_PER_MATCH_SEED);
    this.cacheHitRateEma = new ExponentialMovingAverage(EMA_ALPHA, CACHE_HIT_RATE_SEED);
    this.matchLatencyEma = new ExponentialMovingAverage(MATCH_LATENCY_EMA_ALPHA, MATCH_LATENCY_SEED_MS);

    const fallback = riotConfig.fallbackLimits[riotConfig.apiKeyType].app;
    tunerLogger.info(
      {
        component: 'PollerTuner',
        warmupSessions: WARMUP_SESSIONS,
        sessionDurationS: TARGET_SESSION_DURATION,
        emaAlpha: EMA_ALPHA,
        fallbackLimits: fallback,
        apiKeyType: riotConfig.apiKeyType,
      },
      'tuner initialized',
    );
  }

  static getInstance(): PollerTuner {
    if (!PollerTuner.instance) {
      PollerTuner.instance = new PollerTuner();
    }
    return PollerTuner.instance;
  }

  static resetInstance(): void {
    PollerTuner.instance = null;
  }

  compute(ctx: TuningContext): TuningParams {
    const { limit120s, limit1s, fromFallback } = extractLimits(ctx.gatewayStatus);

    if (fromFallback) {
      tunerLogger.debug(
        { component: 'PollerTuner', limit120s, limit1s, reason: 'no_headers_yet' },
        'using fallback limits',
      );
    }

    const changeEvent = this.limitDetector.check(limit120s, limit1s);
    if (changeEvent) {
      const impact = changeEvent.ratio > 1 ? 'scale_up' : 'scale_down';
      tunerLogger.info(
        {
          component: 'PollerTuner',
          previous120s: changeEvent.previous120s,
          current120s: changeEvent.current120s,
          previous1s: changeEvent.previous1s,
          current1s: changeEvent.current1s,
          ratio: changeEvent.ratio,
          impact,
        },
        'rate limit change detected',
      );

      if (changeEvent.ratio > 2 || changeEvent.ratio < 0.5) {
        this.reqPerPlayerEma.reset(REQ_PER_PLAYER_SEED);
        this.reqPerMatchEma.reset(REQ_PER_MATCH_SEED);
        tunerLogger.info(
          { component: 'PollerTuner', ratio: changeEvent.ratio, resetTo: REQ_PER_PLAYER_SEED },
          'EMA reset due to dramatic limit change',
        );
      }
    }

    const safety = this.effectiveSafetyMargin;
    const safeTokens120s = Math.floor(limit120s * (1 - safety));
    const safeTokens1s = Math.floor(limit1s * (1 - safety));
    const rps120s = safeTokens120s / 120;
    const rps1s = safeTokens1s;
    let targetRps = Math.min(rps120s, rps1s);
    if (riotConfig.apiKeyType === 'personal') {
      const targetTokens = riotConfig.personalTargetTokens120s(limit120s);
      targetRps = targetTokens / 120;
    }

    const threshold = backpressureThreshold();
    if (ctx.queueDepth > threshold * 0.5) {
      const pressureFactor = Math.max(
        QUEUE_PRESSURE_FACTOR,
        1 - (ctx.queueDepth / threshold) * 0.5,
      );
      const before = targetRps;
      targetRps *= pressureFactor;
      tunerLogger.debug(
        {
          component: 'PollerTuner',
          queueDepth: ctx.queueDepth,
          pressureFactor,
          targetRps_before: before,
          targetRps_after: targetRps,
        },
        'queue pressure applied',
      );
    }

    if (targetRps < 0.1) {
      tunerLogger.warn(
        { component: 'PollerTuner', limit120s, limit1s, safety, targetRps },
        'targetRps very low',
      );
    }

    const reqPerPlayer = Math.max(1, this.reqPerPlayerEma.value);
    const avgMatchLatencyS = this.matchLatencyEma.value / 1000;
    const availableCap =
      ctx.availablePlayers > 0 ? ctx.availablePlayers : MAX_PLAYERS_PER_SESSION;
    const maxBatchCap =
      riotConfig.apiKeyType === 'personal'
        ? Math.min(MAX_PLAYERS_PER_SESSION, availableCap)
        : Math.min(MAX_PLAYERS_PER_SESSION, MAX_BATCH_SIZE, availableCap);

    let maxConcurrentSessions = 1;
    let rawBatchSize = MIN_BATCH_SIZE;
    for (let pass = 0; pass < 2; pass += 1) {
      const tokenBudgetPerSession = safeTokens120s / Math.max(1, maxConcurrentSessions);
      rawBatchSize = Math.ceil(tokenBudgetPerSession / reqPerPlayer);
      rawBatchSize = clamp(rawBatchSize, MIN_BATCH_SIZE, maxBatchCap);
      const reqPerSession = rawBatchSize * reqPerPlayer;
      const sessionDispatchS = reqPerSession / Math.max(0.001, targetRps);
      const sessionWallClockS = Math.max(sessionDispatchS, avgMatchLatencyS);
      maxConcurrentSessions = Math.max(
        1,
        Math.ceil(sessionWallClockS / Math.max(0.001, sessionDispatchS)) + 1,
      );
      this.lastSessionDispatchS = sessionDispatchS;
      this.lastSessionWallClockS = sessionWallClockS;
    }

    const rawMaxConcurrentSessions = maxConcurrentSessions;
    const maxConcurrentSessionsCap = MAX_SESSIONS_BY_KEY[riotConfig.apiKeyType];
    maxConcurrentSessions = Math.min(rawMaxConcurrentSessions, maxConcurrentSessionsCap);

    if (rawMaxConcurrentSessions > maxConcurrentSessions) {
      tunerLogger.debug(
        {
          component: 'PollerTuner',
          event: 'sessions_capped_by_key_type',
          raw: rawMaxConcurrentSessions,
          capped: maxConcurrentSessions,
          apiKeyType: riotConfig.apiKeyType,
        },
        'max concurrent sessions capped for api key type',
      );
      const tokenBudgetPerSession = safeTokens120s / Math.max(1, maxConcurrentSessions);
      rawBatchSize = Math.ceil(tokenBudgetPerSession / reqPerPlayer);
      rawBatchSize = clamp(rawBatchSize, MIN_BATCH_SIZE, maxBatchCap);
      const reqPerSession = rawBatchSize * reqPerPlayer;
      const sessionDispatchS = reqPerSession / Math.max(0.001, targetRps);
      const sessionWallClockS = Math.max(sessionDispatchS, avgMatchLatencyS);
      this.lastSessionDispatchS = sessionDispatchS;
      this.lastSessionWallClockS = sessionWallClockS;
    }

    if (rawBatchSize > availableCap) {
      tunerLogger.warn(
        {
          component: 'PollerTuner',
          rawBatchSize,
          availablePlayers: ctx.availablePlayers,
        },
        'tuned batchSize capped to availablePlayers',
      );
      rawBatchSize = Math.min(rawBatchSize, availableCap);
    }

    const correctedBatchSize = Math.round(rawBatchSize * this.utilizationCorrection);

    const warmupActive = this.sessionCount < WARMUP_SESSIONS;
    if (warmupActive) {
      tunerLogger.debug(
        {
          component: 'PollerTuner',
          sessionsRemaining: WARMUP_SESSIONS - this.sessionCount,
        },
        'warmup active',
      );
    }

    const warmupMultiplier =
      riotConfig.apiKeyType === 'personal' ? PERSONAL_WARMUP_MULTIPLIER : WARMUP_MULTIPLIER;
    const effectiveMultiplier = warmupActive ? warmupMultiplier : 1;
    const batchSize = Math.max(
      MIN_BATCH_SIZE,
      Math.min(
        Math.floor(correctedBatchSize * effectiveMultiplier),
        maxBatchCap,
        availableCap,
      ),
    );

    const rpsPerPlayer = Math.max(0.01, reqPerPlayer / TARGET_SESSION_DURATION);
    const maxConcurrentPlayers = clamp(
      Math.ceil(targetRps / rpsPerPlayer) * effectiveMultiplier,
      MIN_CONCURRENT,
      Math.min(MAX_CONCURRENT_PLAYERS, batchSize),
    );
    const cappedConcurrentPlayers =
      riotConfig.apiKeyType === 'personal'
        ? Math.min(maxConcurrentPlayers, PERSONAL_MAX_CONCURRENT_PLAYERS)
        : maxConcurrentPlayers;

    const rpsPerPlayerBudget = targetRps / cappedConcurrentPlayers;
    const reqPerMatch = Math.max(1, this.reqPerMatchEma.value);
    const rpsPerMatch = reqPerMatch / TARGET_SESSION_DURATION;

    const maxConcurrentMatchFetchesRaw = clamp(
      Math.floor(Math.ceil(rpsPerPlayerBudget / Math.max(0.01, rpsPerMatch)) * effectiveMultiplier),
      MIN_CONCURRENT,
      MAX_CONCURRENT_MATCHES,
    );
    const maxConcurrentMatchFetches =
      riotConfig.apiKeyType === 'personal'
        ? Math.min(maxConcurrentMatchFetchesRaw, PERSONAL_MAX_CONCURRENT_MATCH_FETCHES)
        : maxConcurrentMatchFetchesRaw;

    const cacheHitRate = clamp(this.cacheHitRateEma.value, 0, 1);
    const participantRankConcurrencyRaw = clamp(
      Math.floor(
        Math.ceil(maxConcurrentMatchFetches * (1 - cacheHitRate) * 10) * effectiveMultiplier,
      ),
      MIN_CONCURRENT,
      MAX_CONCURRENT_RANKS,
    );
    const participantRankConcurrency =
      riotConfig.apiKeyType === 'personal'
        ? Math.min(participantRankConcurrencyRaw, PERSONAL_MAX_PARTICIPANT_RANK_CONCURRENCY)
        : participantRankConcurrencyRaw;

    const params: TuningParams = {
      batchSize,
      discoveryIntervalMs: 0,
      maxConcurrentPlayers: cappedConcurrentPlayers,
      maxConcurrentMatchFetches,
      participantRankConcurrency,
      maxConcurrentSessions,
      rawMaxConcurrentSessions,
      maxConcurrentSessionsCap,
      sessionDispatchS: this.lastSessionDispatchS,
      sessionWallClockS: this.lastSessionWallClockS,
      targetRps,
      detectedLimit120s: limit120s,
      detectedLimit1s: limit1s,
      estimatedReqPerPlayer: this.reqPerPlayerEma.value,
      warmupActive,
      sessionsSinceStart: this.sessionCount,
    };

    this.lastComputedParams = params;

    const atMinimum =
      batchSize === MIN_BATCH_SIZE &&
      maxConcurrentPlayers === MIN_CONCURRENT &&
      maxConcurrentMatchFetches === MIN_CONCURRENT;
    if (atMinimum) {
      this.consecutiveMinParams += 1;
      if (this.consecutiveMinParams >= 5) {
        tunerLogger.warn(
          { component: 'PollerTuner', consecutiveMinParams: this.consecutiveMinParams },
          'computed params at minimum for consecutive sessions',
        );
      }
    } else {
      this.consecutiveMinParams = 0;
    }

    tunerLogger.info(
      {
        component: 'poller-tuner',
        event: 'params_computed',
        warmupActive,
        effectiveMultiplier,
        rawBatchSize,
        utilizationCorrection: this.utilizationCorrection,
        batchSize: params.batchSize,
        maxConcurrentPlayers: params.maxConcurrentPlayers,
        maxConcurrentMatchFetches: params.maxConcurrentMatchFetches,
        participantRankConcurrency: params.participantRankConcurrency,
        targetRps: params.targetRps,
        detectedLimit120s: limit120s,
        detectedLimit1s: limit1s,
        estimatedReqPerPlayer: this.reqPerPlayerEma.value,
        sessionsSinceStart: this.sessionCount,
        effectiveSafetyMargin: this.effectiveSafetyMargin,
        maxConcurrentSessions: params.maxConcurrentSessions,
        sessionDispatchS: params.sessionDispatchS,
        sessionWallClockS: params.sessionWallClockS,
        availablePlayers: ctx.availablePlayers,
        queueDepth: ctx.queueDepth,
      },
      'tuning params applied',
    );

    return params;
  }

  onRateLimitHit(): void {
    const previous = this.effectiveSafetyMargin;
    this.effectiveSafetyMargin = Math.min(
      RATCHET_MAX,
      this.effectiveSafetyMargin + RATCHET_STEP,
    );
    this.sessionsWithout429 = 0;

    tunerLogger.warn(
      {
        component: 'poller-tuner',
        event: 'safety_margin_ratchet_up',
        previous: previous.toFixed(3),
        current: this.effectiveSafetyMargin.toFixed(3),
        step: RATCHET_STEP,
      },
      'safety margin increased after 429',
    );
  }

  recordUtilization(avgTokenPct120s: number): void {
    this.utilizationSamples.push(avgTokenPct120s);
    this.sessionsSinceCorrection += 1;

    if (this.sessionsSinceCorrection < this.correctionSessions) {
      return;
    }

    const avgUtilization = mean(this.utilizationSamples);
    const targetUtilization =
      riotConfig.apiKeyType === 'personal'
        ? riotConfig.personalTargetUtilizationPct * 100
        : (1 - riotConfig.safetyMargin) * 100;

    if (avgUtilization < targetUtilization * 0.8) {
      this.utilizationCorrection = Math.min(
        this.correctionMax,
        this.utilizationCorrection + this.correctionStep,
      );
      tunerLogger.info(
        {
          component: 'poller-tuner',
          event: 'utilization_correction_up',
          avgUtilization,
          targetUtilization,
          utilizationCorrection: this.utilizationCorrection,
        },
        'utilization below target — scaling batch size up',
      );
    } else if (avgUtilization > targetUtilization * 1.02) {
      this.utilizationCorrection = Math.max(
        this.correctionMin,
        this.utilizationCorrection - this.correctionStep,
      );
      tunerLogger.warn(
        {
          component: 'poller-tuner',
          event: 'utilization_correction_down',
          avgUtilization,
          targetUtilization,
          utilizationCorrection: this.utilizationCorrection,
        },
        'utilization above target — scaling batch size down',
      );
    }

    this.utilizationSamples = [];
    this.sessionsSinceCorrection = 0;
  }

  recordSession(feedback: SessionFeedback): void {
    if (feedback.playersCompleted === 0) {
      return;
    }

    const actualReqPerPlayer = feedback.totalGatewayRequests / feedback.playersCompleted;
    const previousReqPerPlayer = this.reqPerPlayerEma.value;
    const newReqPerPlayer = this.reqPerPlayerEma.update(actualReqPerPlayer);
    tunerLogger.trace(
      {
        component: 'PollerTuner',
        metric: 'reqPerPlayer',
        sample: actualReqPerPlayer,
        previousEma: previousReqPerPlayer,
        newEma: newReqPerPlayer,
        alpha: EMA_ALPHA,
      },
      'EMA sample received',
    );

    if (feedback.matchesFetched > 0) {
      const matchRequests = feedback.matchesFetched * 2;
      const reqPerMatch = matchRequests / feedback.matchesFetched;
      this.reqPerMatchEma.update(reqPerMatch);
    }

    if (
      feedback.matchesFetched > 0 &&
      feedback.avgMatchLatencyMs > 0 &&
      !feedback.wasGatewayQueueCongested
    ) {
      this.matchLatencyEma.update(feedback.avgMatchLatencyMs);
    } else if (feedback.wasGatewayQueueCongested) {
      tunerLogger.debug(
        {
          component: 'PollerTuner',
          event: 'latency_ema_skipped_congestion',
          observedMs: feedback.avgMatchLatencyMs,
          currentEma: this.matchLatencyEma.value,
        },
        'match latency EMA not updated — gateway queue was congested',
      );
    }

    const totalParticipantEvents =
      feedback.participantRanksFetched + feedback.participantRanksFromCache;
    if (totalParticipantEvents > 0) {
      const hitRate = feedback.participantRanksFromCache / totalParticipantEvents;
      const previousCache = this.cacheHitRateEma.value;
      const newCache = this.cacheHitRateEma.update(hitRate);
      tunerLogger.trace(
        {
          component: 'PollerTuner',
          metric: 'cacheHitRate',
          sample: hitRate,
          previousEma: previousCache,
          newEma: newCache,
          alpha: EMA_ALPHA,
        },
        'EMA sample received',
      );
    }

    this.sessionCount += 1;

    this.sessionsWithout429 += 1;
    if (this.sessionsWithout429 >= RATCHET_DECAY_SESSIONS) {
      const floor = riotConfig.safetyMargin;
      if (this.effectiveSafetyMargin > floor) {
        const previous = this.effectiveSafetyMargin;
        this.effectiveSafetyMargin = Math.max(
          floor,
          this.effectiveSafetyMargin - RATCHET_STEP,
        );
        this.sessionsWithout429 = 0;
        tunerLogger.info(
          {
            component: 'poller-tuner',
            event: 'safety_margin_ratchet_down',
            previous: previous.toFixed(3),
            current: this.effectiveSafetyMargin.toFixed(3),
          },
          'safety margin decayed — no 429s in last sessions',
        );
      }
    }

    tunerLogger.debug(
      {
        component: 'PollerTuner',
        sessionCount: this.sessionCount,
        actualReqPerPlayer,
        reqPerPlayerEma: this.reqPerPlayerEma.value,
        reqPerMatchEma: this.reqPerMatchEma.value,
        cacheHitRate: this.cacheHitRateEma.value,
        matchesFetched: feedback.matchesFetched,
        matchesSkipped: feedback.matchesSkipped,
        previousReqPerPlayer,
      },
      'tuner feedback recorded',
    );
  }

  getSnapshot(): TunerSnapshot {
    const floor = riotConfig.safetyMargin;
    const params = this.lastComputedParams;
    return {
      params,
      ema: {
        reqPerPlayer: this.reqPerPlayerEma.value,
        reqPerMatch: this.reqPerMatchEma.value,
        cacheHitRate: this.cacheHitRateEma.value,
        matchLatencyMs: this.matchLatencyEma.value,
      },
      concurrent: params
        ? {
            maxConcurrentSessions: params.maxConcurrentSessions,
            matchLatencyEma: this.matchLatencyEma.value,
            sessionDispatchS: params.sessionDispatchS,
            sessionWallClockS: params.sessionWallClockS,
          }
        : null,
      limitHistory: this.limitDetector.getHistory(),
      sessionCount: this.sessionCount,
      ratchet: {
        effectiveSafetyMargin: this.effectiveSafetyMargin,
        configuredFloor: floor,
        sessionsWithout429: this.sessionsWithout429,
        ratchetActive: this.effectiveSafetyMargin > floor,
      },
    };
  }
}
