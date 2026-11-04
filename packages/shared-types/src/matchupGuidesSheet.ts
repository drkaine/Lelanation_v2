/**
 * Guides matchups par champion, lus dans la vue HTML publiée du Google Sheet
 * « TOUS LES MATCHUPS » (colonnes : image, Champion, Qui / Level, Lien, -, Notes,
 * puis « autres guides » : lvl, Lien, Notes). Un champion occupe un bloc de
 * lignes fusionnées : « Qui » en haut, « Level » en dessous.
 */
export type SheetMatchupGuideRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support'

export type SheetMatchupGuide = {
  /** Onglet du sheet d'où vient le guide (absent pour un onglet lu seul). */
  role?: SheetMatchupGuideRole
  who: string
  level: string
  url: string
  label: string
  notes: string
}

export type SheetMatchupGuidesByChampion = Record<string, SheetMatchupGuide[]>

const MATCHUP_GUIDES_SHEET_ID = '1J3CRQZvwkef8EECoj_QtoVu-pFyH9F5JsuxGhXs2MRE'

/** Un onglet par rôle (l'onglet FAQ n'a pas de guides). */
export const MATCHUP_GUIDES_SHEET_TABS: ReadonlyArray<{ role: SheetMatchupGuideRole; gid: string }> = [
  { role: 'top', gid: '1495176325' },
  { role: 'jungle', gid: '53586033' },
  { role: 'mid', gid: '1225427097' },
  { role: 'adc', gid: '272298789' },
  { role: 'support', gid: '1765416003' },
]

export function matchupGuidesSheetUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${MATCHUP_GUIDES_SHEET_ID}/htmlview/sheet?headers=false&gid=${gid}`
}

type Cell = { text: string; href: string; row: number }

const COL = { name: 1, who: 2, link: 3, notes: 5, otherLevel: 6, otherLink: 7, otherNotes: 8 }

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function cellText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map(l => l.trim())
    .join('\n')
    .trim()
}

/** Lien réel derrière la redirection google.com/url?q=… du sheet. */
function cellHref(html: string): string {
  const raw = /<a\b[^>]*\bhref="([^"]+)"/i.exec(html)?.[1]
  if (!raw) return ''
  const href = decodeEntities(raw)
  try {
    const url = new URL(href)
    if (url.hostname.endsWith('google.com') && url.pathname === '/url') {
      return url.searchParams.get('q') ?? href
    }
  } catch {
    return ''
  }
  return href
}

/** Grille du tableau, cellues fusionnées recopiées dans chaque case couverte. */
function sheetGrid(html: string): Cell[][] {
  const grid: Cell[][] = []
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []
  rows.forEach((rowHtml, r) => {
    grid[r] ??= []
    let c = 0
    for (const m of rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
      while (grid[r]![c]) c++
      const attrs = m[1] ?? ''
      const rowspan = Number(/rowspan="(\d+)"/.exec(attrs)?.[1] ?? 1)
      const colspan = Number(/colspan="(\d+)"/.exec(attrs)?.[1] ?? 1)
      const cell: Cell = { text: cellText(m[2] ?? ''), href: cellHref(m[2] ?? ''), row: r }
      for (let dr = 0; dr < rowspan; dr++) {
        grid[r + dr] ??= []
        for (let dc = 0; dc < colspan; dc++) grid[r + dr]![c + dc] = cell
      }
      c += colspan
    }
  })
  return grid
}

/** Cellules propres à ces lignes (une cellule fusionnée n'est comptée qu'une fois). */
function ownCells(grid: Cell[][], rows: number[], col: number): Cell[] {
  return rows.map(r => grid[r]?.[col]).filter((cell): cell is Cell => !!cell && rows.includes(cell.row))
    .filter((cell, i, all) => all.indexOf(cell) === i)
}

export function parseMatchupGuidesSheet(html: string): SheetMatchupGuidesByChampion {
  const grid = sheetGrid(html)
  const starts = grid
    .map((row, r) => ({ r, cell: row?.[COL.name] }))
    .filter(({ r, cell }) => cell && cell.row === r && cell.text && cell.text !== 'Champion')
  const out: SheetMatchupGuidesByChampion = {}

  starts.forEach(({ r, cell }, i) => {
    const end = starts[i + 1]?.r ?? grid.length
    const rows = Array.from({ length: end - r }, (_, k) => r + k)
    const guides: SheetMatchupGuide[] = []

    const whoCells = ownCells(grid, rows, COL.who)
    const link = grid[r]?.[COL.link]
    if (link?.href) {
      guides.push({
        who: whoCells[0]?.text ?? '',
        level: whoCells.slice(1).find(c => c.text)?.text ?? '',
        url: link.href,
        label: link.text,
        notes: grid[r]?.[COL.notes]?.text ?? '',
      })
    }
    for (const other of ownCells(grid, rows, COL.otherLink)) {
      if (!other.href) continue
      guides.push({
        who: '',
        level: grid[other.row]?.[COL.otherLevel]?.text ?? '',
        url: other.href,
        label: other.text,
        notes: grid[other.row]?.[COL.otherNotes]?.text ?? '',
      })
    }
    if (guides.length > 0) out[cell!.text] = guides
  })
  return out
}

/** Fusion des onglets : chaque guide garde son rôle, un même lien n'est gardé qu'une fois par champion. */
export function mergeMatchupGuideTabs(
  tabs: ReadonlyArray<{ role: SheetMatchupGuideRole; data: SheetMatchupGuidesByChampion }>
): SheetMatchupGuidesByChampion {
  const out: SheetMatchupGuidesByChampion = {}
  for (const { role, data } of tabs) {
    for (const [champion, guides] of Object.entries(data)) {
      const list = (out[champion] ??= [])
      for (const guide of guides) {
        if (!list.some(g => g.url === guide.url)) list.push({ ...guide, role })
      }
    }
  }
  return out
}

/** Retire les liens morts ; un champion sans guide restant disparaît. */
export function withoutDeadMatchupGuides(
  data: SheetMatchupGuidesByChampion,
  deadUrls: readonly string[]
): SheetMatchupGuidesByChampion {
  const dead = new Set(deadUrls)
  const out: SheetMatchupGuidesByChampion = {}
  for (const [champion, guides] of Object.entries(data)) {
    const alive = guides.filter(g => !dead.has(g.url))
    if (alive.length > 0) out[champion] = alive
  }
  return out
}

export function allMatchupGuideUrls(data: SheetMatchupGuidesByChampion): string[] {
  return [...new Set(Object.values(data).flatMap(guides => guides.map(g => g.url)))]
}
