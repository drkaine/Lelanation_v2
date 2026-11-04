import { describe, expect, test } from 'vitest'
import {
  planDataDragonCatchUp,
  parseTheorycraftWorkerOutput,
  resolveTheorycraftWorkerCommand,
  theorycraftWorkerArgs,
} from '../../../../src/cron/dataDragonSyncRecovery.js'

describe('planDataDragonCatchUp', () => {
  const base = {
    pending: null,
    currentVersion: '16.22.1',
    frontendGameVersion: '16.22.1',
    frontendPatchVersions: ['16.22', '16.21'],
  }

  test('nothing to do when frontend is up to date and no pending run', () => {
    expect(planDataDragonCatchUp(base)).toEqual({ resume: false, interrupted: false, gaveUp: false, reasons: [] })
  })

  test('pending marker means the previous run was interrupted', () => {
    const plan = planDataDragonCatchUp({
      ...base,
      pending: { version: '16.22.1', startedAt: '2026-11-03T23:00:00.000Z', attempts: 1 },
    })
    expect(plan.interrupted).toBe(true)
    expect(plan.resume).toBe(true)
    expect(plan.reasons).toContain('interrupted')
  })

  test('frontend game data behind the backend version triggers a resume', () => {
    const plan = planDataDragonCatchUp({ ...base, frontendGameVersion: '16.21.1' })
    expect(plan.resume).toBe(true)
    expect(plan.reasons).toEqual(['frontend_game_version_mismatch'])
  })

  test('current patch missing from the patch notes index triggers a resume', () => {
    const plan = planDataDragonCatchUp({ ...base, frontendPatchVersions: ['16.21', '16.20'] })
    expect(plan.resume).toBe(true)
    expect(plan.reasons).toEqual(['patch_notes_missing'])
  })

  test('gives up after max attempts (no hourly loop), still reports the interruption', () => {
    const plan = planDataDragonCatchUp({
      ...base,
      frontendGameVersion: '16.21.1',
      pending: { version: '16.22.1', startedAt: '2026-11-03T23:00:00.000Z', attempts: 3 },
      maxAttempts: 3,
    })
    expect(plan).toMatchObject({ resume: false, interrupted: true, gaveUp: true })
  })

  test('no current version: nothing to resume', () => {
    expect(planDataDragonCatchUp({ ...base, currentVersion: null }).resume).toBe(false)
  })
})

describe('parseTheorycraftWorkerOutput', () => {
  test('reads the ok line', () => {
    const out = 'noise\n[build-theorycraft-data] ok version=16.22.1 champions=173 validationIssues=2 textWarnings=0\n'
    expect(parseTheorycraftWorkerOutput(out)).toEqual({ champions: 173, validationIssues: 2, textWarnings: 0 })
  })

  test('returns null without ok line', () => {
    expect(parseTheorycraftWorkerOutput('Error: boom')).toBeNull()
  })
})

describe('resolveTheorycraftWorkerCommand', () => {
  test('uses the compiled bundle next to the module when present', () => {
    const cmd = resolveTheorycraftWorkerCommand({
      moduleDir: '/app/backend/dist/app',
      backendRoot: '/app/backend',
      execPath: '/usr/bin/node',
      fileExists: (p) => p === '/app/backend/dist/app/buildTheorycraftData.js',
    })
    expect(cmd).toEqual({
      command: '/usr/bin/node',
      args: [...theorycraftWorkerArgs, '/app/backend/dist/app/buildTheorycraftData.js'],
    })
  })

  test('falls back to tsx on the TypeScript script in dev', () => {
    const cmd = resolveTheorycraftWorkerCommand({
      moduleDir: '/app/backend/src/cron',
      backendRoot: '/app/backend',
      execPath: '/usr/bin/node',
      fileExists: () => false,
    })
    expect(cmd).toEqual({
      command: '/usr/bin/node',
      args: [...theorycraftWorkerArgs, '--import', 'tsx', '/app/backend/src/scripts/buildTheorycraftData.ts'],
    })
  })
})
