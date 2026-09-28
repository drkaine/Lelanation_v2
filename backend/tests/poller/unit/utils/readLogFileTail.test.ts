import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readLogFileTail } from '../../../../src/utils/readLogFileTail.js'

describe('readLogFileTail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tail-'))

  it('returns empty for a missing or empty file', async () => {
    expect(await readLogFileTail(join(dir, 'missing.log'))).toBe('')
    writeFileSync(join(dir, 'empty.log'), '')
    expect(await readLogFileTail(join(dir, 'empty.log'))).toBe('')
  })

  it('keeps whole lines only when the file is cut', async () => {
    const file = join(dir, 'app.log')
    writeFileSync(file, 'line one\nline two\nline three\n')
    expect(await readLogFileTail(file)).toBe('line one\nline two\nline three\n')
    expect(await readLogFileTail(file, 15)).toBe('line three\n')
  })
})
