import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createJsonStateStore, entriesSince, routeKey } from '../../../../src/monitoring/monitoringRuntime.js';
import type { MonitoringState } from '../../../../src/monitoring/MonitoringService.js';

describe('entriesSince', () => {
  test('entries_since_keeps_valid_lines_at_or_after_date', () => {
    const text = [
      'tial line from tail cut',
      '[back] [erreur] [youtube]\t2026-09-24T06:00:00.000Z\told\t',
      '[back] [erreur] [youtube]\t2026-09-24T08:00:00.000Z\tquota\t{"n":1}',
    ].join('\n');

    expect(entriesSince(text, '2026-09-24T07:00:00.000Z')).toEqual([
      { type: 'erreur', script: 'youtube', atIso: '2026-09-24T08:00:00.000Z', message: 'quota', json: { n: 1 } },
    ]);
  });
});

describe('routeKey', () => {
  test('route_key_uses_route_pattern_when_express_matched_a_route', () => {
    expect(routeKey({ method: 'GET', baseUrl: '/api/builds', path: '/abc123', route: { path: '/:id' } })).toBe(
      'GET /api/builds/:id'
    );
  });

  test('route_key_masks_ids_when_no_route_matched', () => {
    expect(routeKey({ method: 'GET', baseUrl: '', path: '/api/stats/champion/266/details', route: undefined })).toBe(
      'GET /api/stats/champion/:n/details'
    );
  });
});

describe('createJsonStateStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test('state_store_returns_null_when_file_is_missing', async () => {
    dir = await mkdtemp(join(tmpdir(), 'mon-'));

    expect(await createJsonStateStore(join(dir, 'x', 'state.json')).load()).toBeNull();
  });

  test('state_store_round_trips_saved_state', async () => {
    dir = await mkdtemp(join(tmpdir(), 'mon-'));
    const store = createJsonStateStore(join(dir, 'x', 'state.json'));
    const state: MonitoringState = {
      incidents: { active: [], history: [] },
      lastCheckAt: '2026-09-24T07:00:00.000Z',
      lastRecap: null,
      lastRecapSentAt: null,
    };

    await store.save(state);

    expect(await store.load()).toEqual(state);
  });
});
