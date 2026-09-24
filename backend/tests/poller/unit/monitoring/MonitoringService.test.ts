import { describe, expect, test } from 'vitest';
import {
  MonitoringService,
  type MonitoringDeps,
  type MonitoringState,
} from '../../../../src/monitoring/MonitoringService.js';
import type { RecapLogEntry, RecapEmbed } from '../../../../src/monitoring/dailyRecap.js';
import type { HttpWindowStats } from '../../../../src/monitoring/incidentRules.js';

const NOW = Date.parse('2026-09-24T07:00:00.000Z');
const MIN = 60_000;

function pollerLine(minutesAgo: number, matchesIngested: number): RecapLogEntry {
  return {
    type: 'info',
    script: 'poller_v3_10m',
    atIso: new Date(NOW - minutesAgo * MIN).toISOString(),
    message: 'poller-v3 aggregate 10m',
    json: {
      uptime_ms: 5 * 3_600_000,
      gateway: { total_requests: 400, total_429s: 0 },
      poll: { matches_fetched_success: 10, matches_fetched_failed: 0 },
      ingestion: { matches_ingested: matchesIngested, matches_failed: 0 },
    },
  };
}

type Extra = Partial<Pick<MonitoringDeps, 'cronJobs' | 'processes' | 'codeVersion'>>;

function fakeDeps(
  entries: RecapLogEntry[],
  http: HttpWindowStats = { total: 0, errors5xx: 0, topRoutes: [] },
  extra: Extra = {},
) {
  let saved: MonitoringState | null = null;
  const sent: Array<{ title: string; color: number }> = [];
  const logged: Array<{ type: string; message: string }> = [];
  const deps: MonitoringDeps = {
    now: () => NOW,
    readLogEntries: async () => entries,
    httpStats: () => http,
    loadState: async () => saved,
    saveState: async (s) => {
      saved = s;
    },
    sendEmbed: async (e: RecapEmbed) => {
      sent.push({ title: e.title, color: e.color });
      return true;
    },
    appendLog: async (type, message) => {
      logged.push({ type, message });
    },
    cronJobs: async () => [],
    uptimeMs: () => 24 * 60 * MIN,
    processes: async () => [],
    codeVersion: async () => ({ head: 'aaa', latestSourceMtime: 0 }),
    ...extra,
  };
  return { deps, sent, logged, saved: () => saved };
}

describe('MonitoringService.runCheck', () => {
  test('check_sends_discord_alert_when_ingestion_stalls', async () => {
    const f = fakeDeps([pollerLine(25, 0), pollerLine(15, 0), pollerLine(5, 0)]);

    await new MonitoringService(f.deps).runCheck();

    expect(f.sent.map((s) => s.title)).toEqual(['🚨 Plus d’ingestion']);
  });

  test('check_logs_opened_incident_as_error_in_unified_log', async () => {
    const f = fakeDeps([pollerLine(25, 0), pollerLine(15, 0), pollerLine(5, 0)]);

    await new MonitoringService(f.deps).runCheck();

    expect(f.logged[0]?.type).toBe('erreur');
  });

  test('check_sends_nothing_when_everything_is_nominal', async () => {
    const f = fakeDeps([pollerLine(25, 5), pollerLine(15, 5), pollerLine(5, 5)]);

    await new MonitoringService(f.deps).runCheck();

    expect(f.sent).toEqual([]);
  });

  test('check_persists_active_incidents_and_check_time', async () => {
    const f = fakeDeps([], { total: 50, errors5xx: 50, topRoutes: [] });

    await new MonitoringService(f.deps).runCheck();

    expect([f.saved()?.incidents.active.map((i) => i.code), f.saved()?.lastCheckAt]).toEqual([
      ['POLLER_SILENT', 'API_DOWN'],
      new Date(NOW).toISOString(),
    ]);
  });
});

describe('MonitoringService.runDailyRecap', () => {
  test('recap_is_sent_and_stored_when_run', async () => {
    const f = fakeDeps([pollerLine(60, 5)]);

    await new MonitoringService(f.deps).runDailyRecap();

    expect([f.sent[0]?.title, f.saved()?.lastRecap?.poller.matchesIngested, f.saved()?.lastRecapSentAt]).toEqual([
      '✅ Récap quotidien — RAS',
      5,
      new Date(NOW).toISOString(),
    ]);
  });

  test('recap_covers_the_last_24_hours', async () => {
    const f = fakeDeps([]);

    await new MonitoringService(f.deps).runDailyRecap();

    expect(f.saved()?.lastRecap?.fromIso).toBe(new Date(NOW - 24 * 60 * MIN).toISOString());
  });
});

describe('MonitoringService extra checks', () => {
  const nominal = [pollerLine(25, 5), pollerLine(15, 5), pollerLine(5, 5)];

  test('check_alerts_when_a_cron_failed', async () => {
    const f = fakeDeps(nominal, undefined, {
      cronJobs: async () => [
        { job: 'youtubeSync', lastSuccessAt: null, lastFailureAt: new Date(NOW).toISOString(), lastFailureMessage: 'quota' },
      ],
    });

    await new MonitoringService(f.deps).runCheck();

    expect(f.sent.map((s) => s.title)).toEqual(['🚨 Cron youtubeSync en échec']);
  });

  test('snapshot_flags_process_running_stale_code', async () => {
    const f = fakeDeps(nominal, undefined, {
      processes: async () => [{ name: 'poller', pid: 1, startedAt: new Date(NOW - MIN).toISOString(), commit: 'old' }],
      codeVersion: async () => ({ head: 'new', latestSourceMtime: 0 }),
    });

    const snap = await new MonitoringService(f.deps).snapshot();

    expect(snap.processes.map((p) => [p.name, p.stale])).toEqual([['poller', true]]);
  });

  test('check_tracks_stale_code_as_warning_without_discord', async () => {
    const f = fakeDeps(nominal, undefined, {
      processes: async () => [{ name: 'poller', pid: 1, startedAt: new Date(NOW - MIN).toISOString(), commit: 'old' }],
      codeVersion: async () => ({ head: 'new', latestSourceMtime: 0 }),
    });

    await new MonitoringService(f.deps).runCheck();

    expect([f.sent, f.saved()?.incidents.active.map((i) => i.code)]).toEqual([[], ['STALE_CODE_poller']]);
  });
});
