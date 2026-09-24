import { describe, expect, test } from 'vitest';
import { buildDailyRecap, recapToDiscordEmbed, type RecapLogEntry } from '../../../../src/monitoring/dailyRecap.js';
import type { PollerWindowSummary } from '../../../../src/monitoring/incidentRules.js';
import type { ResolvedIncident } from '../../../../src/monitoring/incidentTracker.js';

const FROM = '2026-09-23T07:00:00.000Z';
const TO = '2026-09-24T07:00:00.000Z';
const IN = '2026-09-23T12:00:00.000Z';

function entry(type: string, script: string, message: string, over: Partial<RecapLogEntry> = {}): RecapLogEntry {
  return { type, script, atIso: IN, message, json: null, ...over };
}

function summary(over: Partial<PollerWindowSummary> = {}): PollerWindowSummary {
  return {
    atMs: Date.parse(IN),
    uptimeMs: 3_600_000,
    requests: 100,
    count429: 0,
    matchesFetchedOk: 10,
    matchesFetchedFailed: 0,
    matchesIngested: 10,
    matchesFailed: 0,
    topErrors: [],
    ...over,
  };
}

function build(input: Partial<Parameters<typeof buildDailyRecap>[0]> = {}) {
  return buildDailyRecap({ fromIso: FROM, toIso: TO, entries: [], summaries: [], incidents: [], ...input });
}

const incident: ResolvedIncident = {
  code: 'RATE_LIMIT_LOOP',
  severity: 'critical',
  title: '429 en boucle',
  message: 'x',
  openedAt: '2026-09-23T10:00:00.000Z',
  lastSeenAt: '2026-09-23T10:40:00.000Z',
  lastNotifiedAt: '2026-09-23T10:00:00.000Z',
  resolvedAt: '2026-09-23T10:45:00.000Z',
};

describe('buildDailyRecap', () => {
  test('recap_counts_errors_and_warnings_per_script', () => {
    const r = build({
      entries: [
        entry('erreur', 'youtube', 'quota'),
        entry('erreur', 'youtube', 'quota'),
        entry('warning', 'datadragon', 'slow'),
        entry('info', 'datadragon', 'ok'),
      ],
    });

    expect([r.errors, r.warnings, r.byScript]).toEqual([
      2,
      1,
      [
        { script: 'youtube', errors: 2, warnings: 0 },
        { script: 'datadragon', errors: 0, warnings: 1 },
      ],
    ]);
  });

  test('recap_ignores_entries_when_outside_period', () => {
    const r = build({ entries: [entry('erreur', 'youtube', 'old', { atIso: '2026-09-22T12:00:00.000Z' })] });

    expect(r.errors).toBe(0);
  });

  test('recap_groups_messages_when_they_only_differ_by_numbers', () => {
    const r = build({
      entries: [
        entry('erreur', 'youtube', 'channel 123 failed', { atIso: '2026-09-23T10:00:00.000Z' }),
        entry('erreur', 'youtube', 'channel 456 failed', { atIso: '2026-09-23T11:00:00.000Z' }),
      ],
    });

    expect(r.topMessages).toEqual([
      { script: 'youtube', type: 'erreur', message: 'channel 456 failed', count: 2, lastAt: '2026-09-23T11:00:00.000Z' },
    ]);
  });

  test('recap_counts_http_5xx_including_suppressed_lines', () => {
    const r = build({ entries: [entry('erreur', 'http', 'GET /a → 500', { json: { suppressed: 4 } })] });

    expect(r.http5xx).toBe(5);
  });

  test('recap_counts_throttled_repeats_in_error_totals', () => {
    const r = build({ entries: [entry('erreur', 'poller', 'boom', { json: { suppressed: 2 } })] });

    expect([r.errors, r.byScript[0].errors, r.topMessages[0].count]).toEqual([3, 3, 3]);
  });

  test('recap_sums_poller_windows_inside_period', () => {
    const r = build({ summaries: [summary({ count429: 2 }), summary({ matchesFailed: 3 })] });

    expect(r.poller).toEqual({
      windows: 2,
      requests: 200,
      count429: 2,
      matchesFetchedFailed: 0,
      matchesIngested: 20,
      matchesFailed: 3,
    });
  });

  test('recap_lists_incidents_opened_or_active_during_period_with_duration', () => {
    const r = build({ incidents: [incident] });

    expect(r.incidents).toEqual([
      {
        code: 'RATE_LIMIT_LOOP',
        severity: 'critical',
        title: '429 en boucle',
        openedAt: incident.openedAt,
        resolvedAt: incident.resolvedAt,
        durationMin: 45,
      },
    ]);
  });

  test('recap_status_is_ok_when_nothing_happened', () => {
    expect(build({ summaries: [summary()] }).status).toBe('ok');
  });

  test('recap_status_is_warning_when_errors_were_logged', () => {
    expect(build({ entries: [entry('erreur', 'youtube', 'x')] }).status).toBe('warning');
  });

  test('recap_status_is_critical_when_critical_incident_occurred', () => {
    expect(build({ incidents: [incident] }).status).toBe('critical');
  });
});

describe('recapToDiscordEmbed', () => {
  test('embed_title_announces_clean_day_when_status_is_ok', () => {
    const embed = recapToDiscordEmbed(build());

    expect(embed.title).toContain('RAS');
  });

  test('embed_lists_incidents_and_top_errors_when_present', () => {
    const embed = recapToDiscordEmbed(build({ incidents: [incident], entries: [entry('erreur', 'youtube', 'quota')] }));

    const text = embed.fields.map((f) => `${f.name}\n${f.value}`).join('\n');
    expect([text.includes('429 en boucle'), text.includes('quota')]).toEqual([true, true]);
  });

  test('embed_fields_respect_discord_value_limit', () => {
    const entries = Array.from({ length: 50 }, (_, i) => entry('erreur', `s${i}`, 'x'.repeat(200) + String.fromCharCode(65 + (i % 26)) + i));

    const embed = recapToDiscordEmbed(build({ entries }));

    expect(embed.fields.every((f) => f.value.length <= 1024)).toBe(true);
  });
});
