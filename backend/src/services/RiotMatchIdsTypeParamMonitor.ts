import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as cheerio from 'cheerio'
import { DiscordService } from './DiscordService.js'

const MATCH_V5_DETAILS_URL = 'https://developer.riotgames.com/api-details/match-v5'
const PORTAL_DOC_URL = 'https://developer.riotgames.com/apis#match-v5/GET_getMatchIdsByPUUID'
const STATE_PATH = join(process.cwd(), 'data', 'api-riot', 'match-ids-type-param-options.json')

type MatchIdsTypeParamState = {
  checkedAt: string
  values: string[]
  sourceUrl: string
}

export type CheckMatchIdsTypeParamResult = {
  checkedAt: string
  values: string[]
  added: string[]
  removed: string[]
  firstRun: boolean
  notified: boolean
}

function normalizeOptionValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseMatchIdsTypeParamOptionsFromPortalHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const select = $('#execute_inputs_match-v5_GET_getMatchIdsByPUUID select[name="type"]')
  if (!select.length) {
    throw new Error('match_ids_type_select_not_found')
  }

  const values: string[] = []
  select.find('option').each((_, option) => {
    const text = normalizeOptionValue($(option).text())
    if (text) values.push(text)
  })

  return [...new Set(values)].sort()
}

async function fetchMatchV5PortalHtml(): Promise<string> {
  const res = await fetch(MATCH_V5_DETAILS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) {
    throw new Error(`riot_portal_http_${res.status}`)
  }
  const payload = (await res.json()) as { html?: string }
  if (!payload.html?.trim()) {
    throw new Error('riot_portal_missing_html')
  }
  return payload.html
}

async function readState(): Promise<MatchIdsTypeParamState | null> {
  try {
    const raw = await readFile(STATE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as MatchIdsTypeParamState
    if (!Array.isArray(parsed?.values)) return null
    return parsed
  } catch {
    return null
  }
}

async function writeState(state: MatchIdsTypeParamState): Promise<void> {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function notifyNewTypeOptions(
  added: string[],
  meta: { checkedAt: string; values: string[] },
): Promise<void> {
  const discord = new DiscordService()
  await discord.sendCustomEmbed({
    title: `API Riot — ${added.length} nouvelle(s) valeur(s) pour le paramètre \`type\``,
    description:
      `Le sélecteur \`type\` de [GET getMatchIdsByPUUID](${PORTAL_DOC_URL}) contient de nouvelles options. ` +
      `Vérifier le poller / les filtres match-v5.`,
    color: 0xffd700,
    fields: [
      { name: 'Nouvelles valeurs', value: added.map((v) => `- \`${v}\``).join('\n').substring(0, 1024), inline: false },
      {
        name: 'Valeurs actuelles',
        value: meta.values.map((v) => `- \`${v}\``).join('\n').substring(0, 1024),
        inline: false,
      },
      { name: 'Contrôle', value: new Date(meta.checkedAt).toISOString(), inline: true },
    ],
  })
}

/**
 * Surveille les options du paramètre query `type` sur le portail Riot Developer
 * (endpoint match-v5 GET /matches/by-puuid/{puuid}/ids).
 */
export async function checkRiotMatchIdsTypeParamOptions(options?: {
  notifyDiscord?: boolean
}): Promise<CheckMatchIdsTypeParamResult> {
  const html = await fetchMatchV5PortalHtml()
  const values = parseMatchIdsTypeParamOptionsFromPortalHtml(html)
  const checkedAt = new Date().toISOString()
  const previous = await readState()

  const previousSet = new Set(previous?.values ?? [])
  const currentSet = new Set(values)
  const added = values.filter((value) => !previousSet.has(value))
  const removed = (previous?.values ?? []).filter((value) => !currentSet.has(value))
  const firstRun = previous == null

  await writeState({
    checkedAt,
    values,
    sourceUrl: PORTAL_DOC_URL,
  })

  const shouldNotify =
    options?.notifyDiscord !== false && !firstRun && added.length > 0
  if (shouldNotify) {
    await notifyNewTypeOptions(added, { checkedAt, values })
  }

  return {
    checkedAt,
    values,
    added,
    removed,
    firstRun,
    notified: shouldNotify,
  }
}
