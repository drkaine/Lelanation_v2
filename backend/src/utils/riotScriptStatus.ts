/**
 * Shared script status file (data/cron/riot-script-status.json).
 * Used by admin routes and by the worker when it spawns child scripts so the UI shows current job + PID.
 */
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..', '..')

export const RIOT_SCRIPT_STATUS_FILE = join(projectRoot, 'data', 'cron', 'riot-script-status.json')

export type ScriptStatusValue = 'started' | 'running' | 'stopped' | 'failed'
export type ScriptStatusRow = {
  script: string
  status: ScriptStatusValue
  pid?: number
  args?: string[]
  lastStartAt?: string
  lastEndAt?: string
  lastExitCode?: number
}
export type ScriptStatusMap = Record<string, ScriptStatusRow>

export async function readScriptStatusMapRaw(): Promise<ScriptStatusMap> {
  const raw = await fs.readFile(RIOT_SCRIPT_STATUS_FILE, 'utf-8').catch(() => '{}')
  try {
    const map = JSON.parse(raw || '{}')
    return typeof map === 'object' && map !== null ? map : {}
  } catch {
    return {}
  }
}

export async function writeScriptStatusMap(map: ScriptStatusMap): Promise<void> {
  await fs.mkdir(dirname(RIOT_SCRIPT_STATUS_FILE), { recursive: true })
  await fs.writeFile(RIOT_SCRIPT_STATUS_FILE, JSON.stringify(map, null, 0), 'utf-8')
}

/** Update one script row. Used by worker when spawning children; admin uses its own readScriptStatusMap (with reconciliation). */
export async function updateScriptStatusFromWorker(script: string, patch: Partial<ScriptStatusRow>): Promise<void> {
  const map = await readScriptStatusMapRaw()
  const current = map[script] ?? { script, status: 'stopped' as ScriptStatusValue }
  map[script] = { ...current, ...patch, script }
  await writeScriptStatusMap(map)
}
