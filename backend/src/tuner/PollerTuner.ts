import { riotConfig } from '../riot-gateway/config/riotConfig.js';
import type { GatewayStatus } from '../riot-gateway/types.js';
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
const MIN_CONCURRENT = 1;
const MAX_CONCURRENT_PLAYERS = 20;
const MAX_CONCURRENT_MATCHES = 20;
const MAX_CONCURRENT_RANKS = 10;
const QUEUE_PRESSURE_FACTOR = 0.7;
const REQ_PER_PLAYER_SEED = 25;
const REQ_PER_MATCH_SEED = 3;
const CACHE_HIT_RATE_SEED = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function maxAppUtilizationPct(status: GatewayStatus): number {
  const appBuckets = status.metrics.tokenUtilization.filter((b) => b.bucketId.startsWith('app:'));
  if (appBuckets.length === 0) return 0;
  return Math.max(...appBuckets.map((b) => b.pct));
}

export class PollerTuner {
  private static instance: PollerTuner | null = null;

  private readonly reqPerPlayerEma: ExponentialMovingAverage;
  private readonly reqPerMatchEma: ExponentialMovingAverage;
  private readonly cacheHitRateEma: ExponentialMovingAverage;
  private readonly limitDetector = new LimitChangeDetector();
  private sessionCount = 0;
  private lastComputedParams: TuningParams | null = null;
  private consecutiveMinParams = 0;
  private effectiveSafetyMargin = riotConfig.safetyMargin;
  private sessionsWithout429 = 0;

  private constructor() {
    this.reqPerPlayerEma = new ExponentialMovingAverage(EMA_ALPHA, REQ_PER_PLAYER_SEED);
    this.reqPerMatchEma = new ExponentialMovingAverage(EMA_ALPHA, REQ_PER_MATCH_SEED);
    this.cacheHitRateEma = new ExponentialMovingAverage(EMA_ALPHA, CACHE_HIT_RATE_SEED);

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

    const requestBudget = targetRps * TARGET_SESSION_DURATION;
    const reqPerPlayer = Math.max(1, this.reqPerPlayerEma.value);

    let rawBatchSize = Math.floor(requestBudget / reqPerPlayer);
    rawBatchSize = clamp(rawBatchSize, MIN_BATCH_SIZE, MAX_BATCH_SIZE);

    const availableCap = ctx.availablePlayers > 0 ? ctx.availablePlayers : MAX_BATCH_SIZE;
    if (rawBatchSize > availableCap) {
      tunerLogger.warn(
        {
          component: 'PollerTuner',
          rawBatchSize,
          availablePlayers: ctx.availablePlayers,
        },
        'tuned batchSize capped to availablePlayers',
      );
    }
    rawBatchSize = Math.min(rawBatchSize, availableCap);

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

    const effectiveMultiplier = warmupActive ? WARMUP_MULTIPLIER : 1;
    const batchSize = Math.max(MIN_BATCH_SIZE, Math.floor(rawBatchSize * effectiveMultiplier));

    const rpsPerPlayer = reqPerPlayer / TARGET_SESSION_DURATION;
    const maxConcurrentPlayers = clamp(
      Math.floor(Math.ceil(targetRps / Math.max(0.01, rpsPerPlayer)) * effectiveMultiplier),
      MIN_CONCURRENT,
      Math.min(MAX_CONCURRENT_PLAYERS, batchSize),
    );

    const rpsPerPlayerBudget = targetRps / maxConcurrentPlayers;
    const reqPerMatch = Math.max(1, this.reqPerMatchEma.value);
    const rpsPerMatch = reqPerMatch / TARGET_SESSION_DURATION;

    const maxConcurrentMatchFetches = clamp(
      Math.floor(Math.ceil(rpsPerPlayerBudget / Math.max(0.01, rpsPerMatch)) * effectiveMultiplier),
      MIN_CONCURRENT,
      MAX_CONCURRENT_MATCHES,
    );

    const cacheHitRate = clamp(this.cacheHitRateEma.value, 0, 1);
    const participantRankConcurrency = clamp(
      Math.floor(
        Math.ceil(maxConcurrentMatchFetches * (1 - cacheHitRate) * 10) * effectiveMultiplier,
      ),
      MIN_CONCURRENT,
      MAX_CONCURRENT_RANKS,
    );

    const utilPct = maxAppUtilizationPct(ctx.gatewayStatus);
    let discoveryIntervalMs = 0;
    if (utilPct > 90) {
      discoveryIntervalMs = 3000;
    } else if (utilPct > 70) {
      discoveryIntervalMs = 1000;
    } else if (ctx.queueDepth > threshold * 0.8) {
      discoveryIntervalMs = 2000;
    }

    const params: TuningParams = {
      batchSize,
      discoveryIntervalMs,
      maxConcurrentPlayers,
      maxConcurrentMatchFetches,
      participantRankConcurrency,
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
        discoveryIntervalMs: params.discoveryIntervalMs,
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
    return {
      params: this.lastComputedParams,
      ema: {
        reqPerPlayer: this.reqPerPlayerEma.value,
        reqPerMatch: this.reqPerMatchEma.value,
        cacheHitRate: this.cacheHitRateEma.value,
      },
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
