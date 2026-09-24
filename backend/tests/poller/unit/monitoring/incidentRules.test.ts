import { describe, expect, test } from 'vitest';
import {
  DEFAULT_MONITORING_THRESHOLDS,
  evaluateHttpHealth,
  evaluateIngestionHealth,
  parsePollerSummary,
  type PollerWindowSummary,
} from '../../../../src/monitoring/incidentRules.js';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');
const MIN = 60_000;

function win(minutesAgo: number, over: Partial<PollerWindowSummary> = {}): PollerWindowSummary {
  return {
    atMs: NOW - minutesAgo * MIN,
    uptimeMs: 5 * 3_600_000,
    requests: 470,
    count429: 0,
    matchesFetchedOk: 20,
    matchesFetchedFailed: 0,
    matchesIngested: 20,
    matchesFailed: 0,
    topErrors: [],
    ...over,
  };
}

function codes(summaries: PollerWindowSummary[]): string[] {
  return evaluateIngestionHealth(summaries, NOW, DEFAULT_MONITORING_THRESHOLDS).map((i) => i.code);
}

describe('parsePollerSummary', () => {
  test('parsePollerSummary_extracts_counters_when_json_is_poller_v3_aggregate', () => {
    const json = {
      uptime_ms: 1000,
      gateway: { total_requests: 470, total_429s: 3 },
      poll: { matches_fetched_success: 10, matches_fetched_failed: 1 },
      ingestion: { matches_ingested: 9, matches_failed: 2, failure_top_errors: [{ error: 'boom', count: 2 }] },
    };

    const s = parsePollerSummary('2026-09-24T11:53:41.610Z', json);

    expect(s).toEqual({
      atMs: Date.parse('2026-09-24T11:53:41.610Z'),
      uptimeMs: 1000,
      requests: 470,
      count429: 3,
      matchesFetchedOk: 10,
      matchesFetchedFailed: 1,
      matchesIngested: 9,
      matchesFailed: 2,
      topErrors: [{ message: 'boom', count: 2 }],
    });
  });

  test('parsePollerSummary_returns_null_when_json_has_no_gateway_block', () => {
    expect(parsePollerSummary('2026-09-24T11:53:41.610Z', { foo: 1 })).toBeNull();
  });
});

describe('evaluateIngestionHealth', () => {
  test('ingestion_health_is_clean_when_windows_are_nominal', () => {
    expect(codes([win(25), win(15), win(5)])).toEqual([]);
  });

  test('poller_silent_is_raised_when_no_summary_exists', () => {
    expect(codes([])).toEqual(['POLLER_SILENT']);
  });

  test('poller_silent_is_raised_when_last_summary_is_older_than_threshold', () => {
    expect(codes([win(40), win(30)])).toEqual(['POLLER_SILENT']);
  });

  test('riot_unreachable_is_raised_when_last_two_windows_sent_no_request', () => {
    const zero = { requests: 0, matchesFetchedOk: 0, matchesIngested: 0 };
    expect(codes([win(15, zero), win(5, zero)])).toContain('RIOT_UNREACHABLE');
  });

  test('riot_unreachable_is_not_raised_when_poller_just_restarted', () => {
    const zero = { requests: 0, matchesFetchedOk: 0, matchesIngested: 0, uptimeMs: 1000 };
    expect(codes([win(15, zero), win(5, zero)])).not.toContain('RIOT_UNREACHABLE');
  });

  test('rate_limit_loop_is_raised_when_429_repeat_on_consecutive_windows', () => {
    expect(codes([win(15, { count429: 8 }), win(5, { count429: 12 })])).toContain('RATE_LIMIT_LOOP');
  });

  test('rate_limit_loop_is_not_raised_when_429_burst_is_isolated', () => {
    expect(codes([win(15, { count429: 0 }), win(5, { count429: 12 })])).not.toContain('RATE_LIMIT_LOOP');
  });

  test('riot_fetch_failing_is_raised_when_match_fetch_mostly_fails_twice', () => {
    const bad = { matchesFetchedOk: 1, matchesFetchedFailed: 9 };
    expect(codes([win(15, bad), win(5, bad)])).toContain('RIOT_FETCH_FAILING');
  });

  test('ingestion_stalled_is_raised_when_three_windows_ingest_nothing', () => {
    const none = { matchesIngested: 0 };
    expect(codes([win(25, none), win(15, none), win(5, none)])).toContain('INGESTION_STALLED');
  });

  test('ingestion_stalled_is_not_raised_when_only_two_windows_are_empty', () => {
    const none = { matchesIngested: 0 };
    expect(codes([win(25), win(15, none), win(5, none)])).not.toContain('INGESTION_STALLED');
  });

  test('ingestion_failing_is_raised_when_ingestion_mostly_fails_twice', () => {
    const bad = { matchesIngested: 2, matchesFailed: 10 };
    expect(codes([win(15, bad), win(5, bad)])).toContain('INGESTION_FAILING');
  });

  test('ingestion_incidents_are_critical', () => {
    const incidents = evaluateIngestionHealth([], NOW, DEFAULT_MONITORING_THRESHOLDS);
    expect(incidents[0].severity).toBe('critical');
  });
});

describe('evaluateHttpHealth', () => {
  test('api_down_is_raised_when_most_requests_fail_with_5xx', () => {
    const incidents = evaluateHttpHealth({ total: 40, errors5xx: 38, topRoutes: [] }, DEFAULT_MONITORING_THRESHOLDS);
    expect(incidents.map((i) => [i.code, i.severity])).toEqual([['API_DOWN', 'critical']]);
  });

  test('api_errors_warning_is_raised_when_5xx_are_frequent_but_minority', () => {
    const incidents = evaluateHttpHealth({ total: 1000, errors5xx: 30, topRoutes: [] }, DEFAULT_MONITORING_THRESHOLDS);
    expect(incidents.map((i) => [i.code, i.severity])).toEqual([['API_ERRORS', 'warning']]);
  });

  test('http_health_is_clean_when_traffic_is_too_low_to_judge', () => {
    expect(evaluateHttpHealth({ total: 3, errors5xx: 3, topRoutes: [] }, DEFAULT_MONITORING_THRESHOLDS)).toEqual([]);
  });
});
