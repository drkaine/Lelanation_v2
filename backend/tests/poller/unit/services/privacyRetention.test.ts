import { mkdtempSync, readFileSync, utimesSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RETENTION_MS,
  expiredLogFiles,
  purgeContactData,
  runPrivacyRetention,
} from '../../../../src/services/privacyRetention.js'

const NOW = new Date('2026-10-29T04:00:00Z').getTime()
const old = new Date(NOW - RETENTION_MS - 86_400_000).toISOString()
const recent = new Date(NOW - 86_400_000).toISOString()

describe('purgeContactData', () => {
  it('drops entries older than 12 months', () => {
    const { data, removed } = purgeContactData(
      {
        suggestion: [
          { name: 'a', message: 'x', date: old },
          { name: 'b', message: 'y', date: recent },
        ],
        bug: [{ name: 'c', message: 'z', date: old }],
      },
      NOW
    )
    expect(removed).toBe(2)
    expect(data).toEqual({ suggestion: [{ name: 'b', message: 'y', date: recent }], bug: [] })
  })

  it('drops entries without a valid date', () => {
    const { removed } = purgeContactData({ autre: [{ name: 'a', message: 'x', date: 'nope' }] }, NOW)
    expect(removed).toBe(1)
  })
})

describe('expiredLogFiles', () => {
  it('lists rotated logs older than 12 months, never active logs', () => {
    const oldMs = NOW - RETENTION_MS - 1
    expect(
      expiredLogFiles(
        [
          { name: 'backend-out.log', mtimeMs: oldMs },
          { name: 'backend-out.log.1', mtimeMs: oldMs },
          { name: 'backend-out.log.4.gz', mtimeMs: oldMs },
          { name: 'frontend-error.log.2.gz', mtimeMs: NOW - 1000 },
          { name: 'poller-observability.json', mtimeMs: oldMs },
        ],
        NOW
      )
    ).toEqual(['backend-out.log.1', 'backend-out.log.4.gz'])
  })
})

describe('runPrivacyRetention', () => {
  it('rewrites the contact file and deletes expired rotated logs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'privacy-'))
    const contactFile = join(dir, 'contact.json')
    writeFileSync(
      contactFile,
      JSON.stringify({ bug: [{ name: 'a', message: 'x', date: old }, { name: 'b', message: 'y', date: recent }] })
    )
    const logDir = join(dir, 'logs')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(logDir)
    const oldLog = join(logDir, 'backend-out.log.3.gz')
    writeFileSync(oldLog, '')
    const oldSec = (NOW - RETENTION_MS - 86_400_000) / 1000
    utimesSync(oldLog, oldSec, oldSec)
    writeFileSync(join(logDir, 'backend-out.log'), '')

    const result = await runPrivacyRetention({ contactFile, logDir, now: NOW })

    expect(result).toEqual({ contactRemoved: 1, logFilesRemoved: 1 })
    expect(JSON.parse(readFileSync(contactFile, 'utf-8')).bug).toHaveLength(1)
    expect(existsSync(oldLog)).toBe(false)
    expect(existsSync(join(logDir, 'backend-out.log'))).toBe(true)
  })

  it('tolerates missing contact file and log dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'privacy-'))
    const result = await runPrivacyRetention({
      contactFile: join(dir, 'none.json'),
      logDir: join(dir, 'none'),
      now: NOW,
    })
    expect(result).toEqual({ contactRemoved: 0, logFilesRemoved: 0 })
  })
})
