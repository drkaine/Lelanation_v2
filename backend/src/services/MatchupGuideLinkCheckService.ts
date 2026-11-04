import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  allMatchupGuideUrls,
  MATCHUP_GUIDES_SHEET_TABS,
  matchupGuidesSheetUrl,
  mergeMatchupGuideTabs,
  parseMatchupGuidesSheet,
  type SheetMatchupGuidesByChampion,
} from '@lelanation/shared-types'

/**
 * Vérification des liens du Google Sheet des guides matchups (lancée à chaque nouveau patch).
 * Les liens morts sont écrits dans un fichier que la route Nuxt `/matchup-guides.json` retire du site :
 * le sheet appartient à un tiers, on ne peut pas le modifier.
 */

export type LinkProbeKind = 'youtube' | 'page'
export type LinkProbe = { status?: number; errorCode?: string }
export type LinkVerdict = 'alive' | 'dead' | 'unknown'

export const MATCHUP_GUIDES_DEAD_LINKS_FILE = join('data', 'matchup-guides', 'dead-links.json')

export type MatchupGuideDeadLinksFile = {
  checkedAt: string
  version: string | null
  checked: number
  dead: string[]
  unknown: string[]
}

function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtu.be') return url.pathname.slice(1) || null
  if (host !== 'youtube.com') return null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const m = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(url.pathname)
  return m?.[1] ?? null
}

/** Une vidéo YouTube supprimée garde une page en 200 : on interroge oEmbed (404/400 si supprimée). */
export function linkProbeUrl(link: string): { kind: LinkProbeKind; url: string } {
  try {
    const id = youtubeVideoId(new URL(link))
    if (id) {
      const watch = `https://www.youtube.com/watch?v=${id}`
      return { kind: 'youtube', url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}` }
    }
  } catch {
    // URL invalide : sondée telle quelle, l'erreur réseau tranchera.
  }
  return { kind: 'page', url: link }
}

/** Prudent : seul un « n'existe plus » franc est mort ; anti-bot, 5xx, timeout restent inconnus. */
export function classifyLinkProbe(probe: LinkProbe, kind: LinkProbeKind): LinkVerdict {
  if (probe.errorCode === 'ENOTFOUND') return 'dead'
  const status = probe.status
  if (status === undefined) return 'unknown'
  if (status === 404 || status === 410) return 'dead'
  if (kind === 'youtube' && status === 400) return 'dead'
  if (status >= 200 && status < 400) return 'alive'
  return 'unknown'
}

export async function probeLink(url: string, timeoutMs = 15_000): Promise<LinkProbe> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LelanationLinkCheck/1.0)' },
    })
    await res.body?.cancel().catch(() => undefined)
    return { status: res.status }
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause
    if (cause?.code) return { errorCode: cause.code }
    if ((error as Error).name === 'TimeoutError') return { errorCode: 'TIMEOUT' }
    return { errorCode: 'UNKNOWN' }
  }
}

/** Un lien n'est déclaré mort qu'après deux essais morts (évite les pannes passagères). */
export async function checkMatchupGuideLinks(
  urls: readonly string[],
  opts: { probe?: (url: string) => Promise<LinkProbe>; concurrency?: number; retryDelayMs?: number } = {}
): Promise<{ checked: number; dead: string[]; unknown: string[] }> {
  const probe = opts.probe ?? ((u: string) => probeLink(u))
  const retryDelayMs = opts.retryDelayMs ?? 5_000
  const verdicts = new Map<string, LinkVerdict>()

  async function check(link: string): Promise<void> {
    const { kind, url } = linkProbeUrl(link)
    let verdict = classifyLinkProbe(await probe(url), kind)
    if (verdict === 'dead') {
      if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs))
      verdict = classifyLinkProbe(await probe(url), kind)
    }
    verdicts.set(link, verdict)
  }

  const queue = [...urls]
  const workers = Array.from({ length: Math.max(1, opts.concurrency ?? 5) }, async () => {
    for (let link = queue.shift(); link !== undefined; link = queue.shift()) await check(link)
  })
  await Promise.all(workers)

  const pick = (v: LinkVerdict) => urls.filter((u) => verdicts.get(u) === v)
  return { checked: urls.length, dead: pick('dead'), unknown: pick('unknown') }
}

/** Les 5 onglets de rôle, fusionnés. Un onglet illisible fait échouer (pas de vérif sur données partielles). */
export async function fetchSheetMatchupGuides(
  fetchText: (url: string) => Promise<string> = async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`sheet HTTP ${res.status}`)
    return res.text()
  }
): Promise<SheetMatchupGuidesByChampion> {
  const tabs = await Promise.all(
    MATCHUP_GUIDES_SHEET_TABS.map(async ({ role, gid }) => ({
      role,
      data: parseMatchupGuidesSheet(await fetchText(matchupGuidesSheetUrl(gid))),
    }))
  )
  return mergeMatchupGuideTabs(tabs)
}

/** Lit le sheet, sonde chaque lien, écrit le fichier des liens morts (réécrit en entier : un lien réparé revient). */
export async function runMatchupGuideLinkCheck(
  version: string | null,
  backendRoot: string = process.cwd()
): Promise<MatchupGuideDeadLinksFile> {
  const urls = allMatchupGuideUrls(await fetchSheetMatchupGuides())
  const result = await checkMatchupGuideLinks(urls)
  const file: MatchupGuideDeadLinksFile = { checkedAt: new Date().toISOString(), version, ...result }
  const path = join(backendRoot, MATCHUP_GUIDES_DEAD_LINKS_FILE)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(file, null, 2) + '\n')
  return file
}
