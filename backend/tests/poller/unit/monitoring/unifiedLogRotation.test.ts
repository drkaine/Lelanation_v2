import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { rotateUnifiedLogIfNeeded } from '../../../../src/logging/unifiedAppLog.js';

let dir = '';
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function logFile(content: string): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'ulog-'));
  const file = join(dir, 'u.log');
  await writeFile(file, content, 'utf-8');
  return file;
}

describe('rotateUnifiedLogIfNeeded', () => {
  test('rotation_leaves_file_untouched_when_under_size_limit', async () => {
    const file = await logFile('line-1\nline-2\n');

    await rotateUnifiedLogIfNeeded(file, { maxBytes: 100, keepBytes: 50 });

    expect(await readFile(file, 'utf-8')).toBe('line-1\nline-2\n');
  });

  test('rotation_keeps_only_whole_recent_lines_when_over_size_limit', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line-${String(i).padStart(2, '0')}`);
    const file = await logFile(lines.join('\n') + '\n');

    await rotateUnifiedLogIfNeeded(file, { maxBytes: 50, keepBytes: 25 });

    expect(await readFile(file, 'utf-8')).toBe('line-07\nline-08\nline-09\n');
  });

  test('rotation_ignores_missing_file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ulog-'));

    await expect(rotateUnifiedLogIfNeeded(join(dir, 'none.log'), { maxBytes: 1, keepBytes: 1 })).resolves.toBeUndefined();
  });
});
