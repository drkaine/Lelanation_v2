import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** Marker written when a new-version sync starts, removed once assets reach the frontend. */
export type DataDragonPendingRun = {
  version: string
  startedAt: string
  attempts: number
  /** Set once the "gave up" Discord alert was sent (no hourly repeat). */
  gaveUpAlerted?: boolean
}

export type DataDragonCatchUpReason =
  | 'interrupted'
  | 'frontend_game_version_mismatch'
  | 'patch_notes_missing'

export type DataDragonCatchUpPlan = {
  resume: boolean
  interrupted: boolean
  gaveUp: boolean
  reasons: DataDragonCatchUpReason[]
}

export const DATA_DRAGON_MAX_CATCH_UP_ATTEMPTS = 3

/**
 * Decide whether the publish steps (patch notes, theorycraft, copy to frontend) must be replayed
 * although Data Dragon reports no new version — e.g. the previous run was killed mid-way.
 */
export function planDataDragonCatchUp(input: {
  pending: DataDragonPendingRun | null
  currentVersion: string | null
  frontendGameVersion: string | null
  frontendPatchVersions: string[]
  maxAttempts?: number
}): DataDragonCatchUpPlan {
  const maxAttempts = input.maxAttempts ?? DATA_DRAGON_MAX_CATCH_UP_ATTEMPTS
  const interrupted = input.pending !== null
  const reasons: DataDragonCatchUpReason[] = []
  if (interrupted) reasons.push('interrupted')

  const current = input.currentVersion?.trim() || null
  if (!current) return { resume: false, interrupted, gaveUp: false, reasons }

  if (input.frontendGameVersion !== current) reasons.push('frontend_game_version_mismatch')
  const patch = current.split('.').slice(0, 2).join('.')
  if (!input.frontendPatchVersions.includes(patch)) reasons.push('patch_notes_missing')

  const gaveUp = reasons.length > 0 && (input.pending?.attempts ?? 0) >= maxAttempts
  return { resume: reasons.length > 0 && !gaveUp, interrupted, gaveUp, reasons }
}

export type TheorycraftWorkerResult = {
  champions: number
  validationIssues: number
  textWarnings: number
}

const OK_LINE_RE =
  /\[build-theorycraft-data\] ok version=\S+ champions=(\d+) validationIssues=(\d+) textWarnings=(\d+)/

export function parseTheorycraftWorkerOutput(stdout: string): TheorycraftWorkerResult | null {
  const m = OK_LINE_RE.exec(stdout)
  if (!m) return null
  return { champions: Number(m[1]), validationIssues: Number(m[2]), textWarnings: Number(m[3]) }
}

/** The build peaks above 1 GB: own heap, outside the API process watched by PM2 (max_memory_restart). */
export const theorycraftWorkerArgs = ['--max-old-space-size=3072']

export function resolveTheorycraftWorkerCommand(input: {
  moduleDir: string
  backendRoot: string
  execPath: string
  fileExists: (path: string) => boolean
}): { command: string; args: string[] } {
  const bundled = join(input.moduleDir, 'buildTheorycraftData.js')
  if (input.fileExists(bundled)) {
    return { command: input.execPath, args: [...theorycraftWorkerArgs, bundled] }
  }
  return {
    command: input.execPath,
    args: [
      ...theorycraftWorkerArgs,
      '--import',
      'tsx',
      join(input.backendRoot, 'src', 'scripts', 'buildTheorycraftData.ts'),
    ],
  }
}

/** Run the theorycraft build in a child process (cwd = backend root). */
export function runTheorycraftWorker(
  backendRoot: string = process.cwd()
): Promise<{ ok: true; result: TheorycraftWorkerResult } | { ok: false; error: string }> {
  const { command, args } = resolveTheorycraftWorkerCommand({
    moduleDir: dirname(fileURLToPath(import.meta.url)),
    backendRoot,
    execPath: process.execPath,
    fileExists: existsSync,
  })
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: backendRoot, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderrTail = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000)
    })
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('close', (code, signal) => {
      const result = parseTheorycraftWorkerOutput(stdout)
      // Exit 1 with an ok line = built with validation issues (reported by the caller).
      if (result) return resolve({ ok: true, result })
      resolve({
        ok: false,
        error: `theorycraft worker exited code=${code} signal=${signal}: ${stderrTail.trim().slice(-500)}`,
      })
    })
  })
}
