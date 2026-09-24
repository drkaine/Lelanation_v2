import { describe, expect, test } from 'vitest';
import type { DetectedIncident } from '../../../../src/monitoring/incidentRules.js';
import {
  EMPTY_INCIDENT_STATE,
  reconcileIncidents,
  type IncidentState,
} from '../../../../src/monitoring/incidentTracker.js';

const T0 = Date.parse('2026-09-24T12:00:00.000Z');
const MIN = 60_000;
const OPTS = { reminderMs: 60 * MIN, historyLimit: 3 };

const critical: DetectedIncident = {
  code: 'INGESTION_STALLED',
  severity: 'critical',
  title: 'Plus d’ingestion',
  message: 'Aucun match',
};
const warning: DetectedIncident = { code: 'API_ERRORS', severity: 'warning', title: 'Erreurs', message: '5xx' };

function kinds(r: ReturnType<typeof reconcileIncidents>): string[] {
  return r.notifications.map((n) => `${n.kind}:${n.incident.code}`);
}

describe('reconcileIncidents', () => {
  test('critical_incident_is_notified_when_first_detected', () => {
    const r = reconcileIncidents(EMPTY_INCIDENT_STATE, [critical], T0, OPTS);

    expect(kinds(r)).toEqual(['opened:INGESTION_STALLED']);
  });

  test('warning_incident_is_tracked_without_notification', () => {
    const r = reconcileIncidents(EMPTY_INCIDENT_STATE, [warning], T0, OPTS);

    expect([kinds(r), r.state.active.map((i) => i.code)]).toEqual([[], ['API_ERRORS']]);
  });

  test('ongoing_incident_is_not_renotified_before_reminder_delay', () => {
    const s1 = reconcileIncidents(EMPTY_INCIDENT_STATE, [critical], T0, OPTS).state;

    const r = reconcileIncidents(s1, [critical], T0 + 30 * MIN, OPTS);

    expect(kinds(r)).toEqual([]);
  });

  test('ongoing_incident_is_reminded_when_reminder_delay_elapsed', () => {
    const s1 = reconcileIncidents(EMPTY_INCIDENT_STATE, [critical], T0, OPTS).state;

    const r = reconcileIncidents(s1, [critical], T0 + 61 * MIN, OPTS);

    expect(kinds(r)).toEqual(['reminder:INGESTION_STALLED']);
  });

  test('incident_is_resolved_and_archived_when_no_longer_detected', () => {
    const s1 = reconcileIncidents(EMPTY_INCIDENT_STATE, [critical], T0, OPTS).state;

    const r = reconcileIncidents(s1, [], T0 + 20 * MIN, OPTS);

    expect([kinds(r), r.state.active, r.state.history[0]?.resolvedAt]).toEqual([
      ['resolved:INGESTION_STALLED'],
      [],
      new Date(T0 + 20 * MIN).toISOString(),
    ]);
  });

  test('resolved_warning_is_archived_without_notification', () => {
    const s1 = reconcileIncidents(EMPTY_INCIDENT_STATE, [warning], T0, OPTS).state;

    const r = reconcileIncidents(s1, [], T0 + MIN, OPTS);

    expect([kinds(r), r.state.history.length]).toEqual([[], 1]);
  });

  test('history_is_capped_when_limit_is_exceeded', () => {
    let state: IncidentState = EMPTY_INCIDENT_STATE;
    for (let i = 0; i < 5; i++) {
      state = reconcileIncidents(state, [critical], T0 + i * 2 * MIN, OPTS).state;
      state = reconcileIncidents(state, [], T0 + (i * 2 + 1) * MIN, OPTS).state;
    }

    expect(state.history.map((h) => h.openedAt)).toEqual([
      new Date(T0 + 8 * MIN).toISOString(),
      new Date(T0 + 6 * MIN).toISOString(),
      new Date(T0 + 4 * MIN).toISOString(),
    ]);
  });

  test('active_incident_message_is_refreshed_when_detected_again', () => {
    const s1 = reconcileIncidents(EMPTY_INCIDENT_STATE, [critical], T0, OPTS).state;

    const r = reconcileIncidents(s1, [{ ...critical, message: 'nouveau' }], T0 + MIN, OPTS);

    expect(r.state.active[0].message).toBe('nouveau');
  });

});
