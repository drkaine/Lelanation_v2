import { mkdtemp, rm, utimes, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  evaluateCodeFreshness,
  latestSourceMtimeMs,
  type ProcessInfo,
} from '../../../../src/monitoring/processFreshness.js';

const STARTED = '2026-09-24T10:00:00.000Z';

function info(over: Partial<ProcessInfo> = {}): ProcessInfo {
  return { name: 'poller', pid: 42, startedAt: STARTED, commit: 'aaa1111', ...over };
}

describe('evaluateCodeFreshness', () => {
  test('freshness_is_clean_when_commit_matches_and_no_file_changed_after_start', () => {
    expect(evaluateCodeFreshness([info()], 'aaa1111', Date.parse(STARTED) - 1000)).toEqual([]);
  });

  test('stale_code_warning_when_repo_head_moved_after_start', () => {
    const incidents = evaluateCodeFreshness([info()], 'bbb2222', Date.parse(STARTED) - 1000);
    expect(incidents.map((i) => [i.code, i.severity])).toEqual([['STALE_CODE_poller', 'warning']]);
  });

  test('stale_code_warning_when_sources_modified_after_start', () => {
    const incidents = evaluateCodeFreshness([info()], 'aaa1111', Date.parse(STARTED) + 60_000);
    expect(incidents.map((i) => i.code)).toEqual(['STALE_CODE_poller']);
  });

  test('stale_code_is_ignored_when_commit_is_unknown_and_sources_older', () => {
    expect(evaluateCodeFreshness([info({ commit: null })], null, Date.parse(STARTED) - 1)).toEqual([]);
  });
});

describe('latestSourceMtimeMs', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test('latest_mtime_ignores_test_files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'src-'));
    await mkdir(join(dir, 'a'));
    await writeFile(join(dir, 'a', 'x.ts'), '');
    await writeFile(join(dir, 'a', 'x.test.ts'), '');
    await utimes(join(dir, 'a', 'x.ts'), new Date(1_000_000), new Date(1_000_000));
    await utimes(join(dir, 'a', 'x.test.ts'), new Date(9_000_000), new Date(9_000_000));

    expect(await latestSourceMtimeMs(dir)).toBe(1_000_000);
  });
});
