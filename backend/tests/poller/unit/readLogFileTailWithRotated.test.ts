import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readLogFileTailWithRotated } from '../../../src/utils/readLogFileTail.js';

describe('readLogFileTailWithRotated', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tail-rot-'));
    file = join(dir, 'app.log');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('prepend rotated file when current log was just rotated', async () => {
    await writeFile(`${file}.1`, 'old-1\nold-2\n');
    await writeFile(file, 'new-1\n');
    expect(await readLogFileTailWithRotated(file, 1024)).toBe('old-1\nold-2\nnew-1\n');
  });

  test('skip rotated file when current log fills the budget', async () => {
    await writeFile(`${file}.1`, 'old-1\n');
    await writeFile(file, 'a\nb\nc\n');
    expect(await readLogFileTailWithRotated(file, 4)).toBe('c\n');
  });

  test('read only the rotated tail that fits the remaining budget', async () => {
    await writeFile(`${file}.1`, 'old-1\nold-2\n');
    await writeFile(file, 'new\n');
    expect(await readLogFileTailWithRotated(file, 11)).toBe('old-2\nnew\n');
  });

  test('no files → empty string', async () => {
    expect(await readLogFileTailWithRotated(file, 1024)).toBe('');
  });
});
