import { describe, expect, test } from 'vitest';
import { HttpErrorTracker } from '../../../../src/monitoring/httpErrorTracker.js';

const T0 = Date.parse('2026-09-24T12:00:00.000Z');
const MIN = 60_000;

function tracker() {
  return new HttpErrorTracker({ windowMs: 5 * MIN, logThrottleMs: MIN });
}

describe('HttpErrorTracker', () => {
  test('stats_count_requests_and_5xx_when_inside_window', () => {
    const t = tracker();
    t.record('GET /api/stats/champions', 200, T0);
    t.record('GET /api/stats/champions', 500, T0);
    t.record('GET /api/builds', 503, T0);

    expect(t.stats(T0 + MIN)).toEqual({
      total: 3,
      errors5xx: 2,
      topRoutes: [
        { route: 'GET /api/stats/champions', count: 1 },
        { route: 'GET /api/builds', count: 1 },
      ],
    });
  });

  test('stats_ignore_requests_when_older_than_window', () => {
    const t = tracker();
    t.record('GET /a', 500, T0);
    t.record('GET /a', 200, T0 + 6 * MIN);

    expect(t.stats(T0 + 6 * MIN)).toMatchObject({ total: 1, errors5xx: 0 });
  });

  test('top_routes_are_sorted_by_error_count_when_several_routes_fail', () => {
    const t = tracker();
    t.record('GET /a', 500, T0);
    t.record('GET /b', 500, T0);
    t.record('GET /b', 500, T0);

    expect(t.stats(T0).topRoutes[0]).toEqual({ route: 'GET /b', count: 2 });
  });

  test('record_asks_to_log_first_5xx_of_a_route', () => {
    expect(tracker().record('GET /a', 500, T0)).toEqual({ log: true, suppressed: 0 });
  });

  test('record_does_not_ask_to_log_when_status_is_not_5xx', () => {
    expect(tracker().record('GET /a', 404, T0)).toEqual({ log: false, suppressed: 0 });
  });

  test('record_throttles_repeated_5xx_and_reports_suppressed_count', () => {
    const t = tracker();
    t.record('GET /a', 500, T0);
    t.record('GET /a', 500, T0 + 1000);
    t.record('GET /a', 500, T0 + 2000);

    expect(t.record('GET /a', 500, T0 + MIN + 1)).toEqual({ log: true, suppressed: 2 });
  });
});
