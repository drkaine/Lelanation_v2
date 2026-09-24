/**
 * Detects processes running code older than the repository (commit moved or sources edited
 * after the process started). Each process records its info at startup.
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { DetectedIncident } from './incidentRules.js'

export type ProcessInfo = { name: string; pid: number; startedAt: string; commit: string | null }

const execFileAsync = promisify(execFile)
const SOURCE_RE = /\.(ts|js|mjs|json)$/
const TEST_RE = /\.test\.[jt]s$/

export function evaluateCodeFreshness(
  infos: ProcessInfo[],
  repoHead: string | null,
  latestSourceMtime: number
): DetectedIncident[] {
  return infos.flatMap((p) => {
    const reasons: string[] = []
    if (p.commit && repoHead && p.commit !== repoHead) {
      reasons.push(`commit ${p.commit.slice(0, 7)} au démarrage, dépôt sur ${repoHead.slice(0, 7)}`)
    }
    if (latestSourceMtime > Date.parse(p.startedAt)) {
      reasons.push('fichiers source modifiés après le démarrage')
    }
    if (reasons.length === 0) return []
    return [
      {
        code: `STALE_CODE_${p.name}`,
        severity: 'warning' as const,
        title: `${p.name} tourne sur du code périmé`,
        message: `${reasons.join(' ; ')}. Redémarrer : make deploy-backend.`,
        context: { pid: p.pid, demarre: p.startedAt },
      },
    ]
  })
}

export async function latestSourceMtimeMs(dir: string): Promise<number> {
  let latest = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      latest = Math.max(latest, await latestSourceMtimeMs(full))
    } else if (SOURCE_RE.test(e.name) && !TEST_RE.test(e.name)) {
      latest = Math.max(latest, (await stat(full)).mtimeMs)
    }
  }
  return latest
}

export async function gitHead(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd, timeout: 5_000 })
    return stdout.trim() || null
  } catch {
    return null
  }
}

function processesDir(): string {
  return join(process.cwd(), 'data', 'monitoring', 'processes')
}

/** Called once at process startup (backend, poller). */
export async function recordProcessStart(name: string): Promise<void> {
  const info: ProcessInfo = {
    name,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    commit: await gitHead(process.cwd()),
  }
  await mkdir(processesDir(), { recursive: true })
  await writeFile(join(processesDir(), `${name}.json`), JSON.stringify(info, null, 2), 'utf-8')
}

export async function readProcessInfos(): Promise<ProcessInfo[]> {
  let files: string[]
  try {
    files = await readdir(processesDir())
  } catch {
    return []
  }
  const infos: ProcessInfo[] = []
  for (const f of files.filter((x) => x.endsWith('.json'))) {
    try {
      infos.push(JSON.parse(await readFile(join(processesDir(), f), 'utf-8')) as ProcessInfo)
    } catch {
      // ignore unreadable file
    }
  }
  return infos
}
