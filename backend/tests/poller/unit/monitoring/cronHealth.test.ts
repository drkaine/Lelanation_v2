import { describe, expect, test } from 'vitest';
import { evaluateCronHealth, type CronJobHealthInput } from '../../../../src/monitoring/incidentRules.js';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');
const HOUR = 3_600_000;
const UPTIME = 24 * HOUR;

function job(over: Partial<CronJobHealthInput> = {}): CronJobHealthInput {
  return {
    job: 'dataDragonSync',
    lastSuccessAt: new Date(NOW - 10 * 60_000).toISOString(),
    lastFailureAt: null,
    lastFailureMessage: null,
    ...over,
  };
}

function codes(jobs: CronJobHealthInput[], uptimeMs = UPTIME): string[] {
  return evaluateCronHealth(jobs, NOW, uptimeMs).map((i) => `${i.code}:${i.severity}`);
}

describe('evaluateCronHealth', () => {
  test('cron_health_is_clean_when_last_run_succeeded_recently', () => {
    expect(codes([job()])).toEqual([]);
  });

  test('cron_failed_is_critical_when_last_run_failed', () => {
    const failed = job({ lastFailureAt: new Date(NOW - 60_000).toISOString(), lastFailureMessage: 'HTTP 503' });
    expect(codes([failed])).toEqual(['CRON_FAILED_dataDragonSync:critical']);
  });

  test('cron_failed_incident_carries_error_message', () => {
    const failed = job({ lastFailureAt: new Date(NOW - 60_000).toISOString(), lastFailureMessage: 'HTTP 503' });
    expect(evaluateCronHealth([failed], NOW, UPTIME)[0].context).toMatchObject({ erreur: 'HTTP 503' });
  });

  test('cron_stale_is_critical_when_no_success_for_three_intervals', () => {
    expect(codes([job({ lastSuccessAt: new Date(NOW - 4 * HOUR).toISOString() })])).toEqual([
      'CRON_STALE_dataDragonSync:critical',
    ]);
  });

  test('cron_stale_is_not_raised_when_process_started_recently', () => {
    expect(codes([job({ lastSuccessAt: new Date(NOW - 4 * HOUR).toISOString() })], HOUR)).toEqual([]);
  });

  test('cron_stale_is_not_raised_when_job_is_unknown', () => {
    expect(codes([job({ job: 'liveAggArchiveCheckpoint', lastSuccessAt: '2026-05-19T09:02:24.871Z' })])).toEqual([]);
  });
});
