/** Logique pure des cards de patch « gaming ». */
import type { ChangeType, StatChange } from '~/stores/PatchNotesStore'
import type { PatchEntitySummaryType } from '~/utils/patchEntitySummary'

export type PatchTone = 'info' | 'error' | 'accent' | 'muted'

/** Couleur du verdict de la card (bandeau + bordure du portrait). */
export const PATCH_VERDICT_TONES: Record<PatchEntitySummaryType, PatchTone> = {
  buff: 'info',
  nerf: 'error',
  adjustment: 'accent',
  new: 'info',
  removed: 'muted',
}

/** ▲ buffs + nouveautés, ▼ nerfs + retraits, ◆ ajustements ; le texte libre est ignoré. */
export function patchChangeCounts(changes: StatChange[]): {
  up: number
  down: number
  adjust: number
} {
  const counts = { up: 0, down: 0, adjust: 0 }
  for (const { type } of changes) {
    if (type === 'buff' || type === 'new') counts.up++
    else if (type === 'nerf' || type === 'removed') counts.down++
    else if (type === 'adjustment') counts.adjust++
  }
  return counts
}

const NUMERIC_VALUE = /^([+-]?\d+(?:[.,]\d+)?)(\s*)([%a-zA-Z]*)$/

function parseNumeric(value: string): { n: number; space: string; unit: string } | null {
  const match = value.trim().match(NUMERIC_VALUE)
  if (!match) return null
  return { n: Number(match[1]!.replace(',', '.')), space: match[2]!, unit: match[3]! }
}

/** « 40 » → « 55 » : « +15 » ; même unité exigée ; null si non comparable ou égal. */
export function statDelta(before: string, after: string): string | null {
  const a = parseNumeric(before)
  const b = parseNumeric(after)
  if (!a || !b || a.unit !== b.unit) return null
  const diff = Math.round((b.n - a.n) * 1000) / 1000
  if (diff === 0) return null
  return `${diff > 0 ? '+' : ''}${diff}${a.unit ? a.space + a.unit : ''}`
}

/** Le sens d'un delta dépend du type (un temps de recharge qui baisse est un buff). */
export function statDeltaTone(type: ChangeType): PatchTone {
  if (type === 'buff' || type === 'new') return 'info'
  if (type === 'nerf' || type === 'removed') return 'error'
  if (type === 'adjustment') return 'accent'
  return 'muted'
}

export type PatchChangeSection = { title: string; changes: StatChange[] }

/** Regroupe par sous-catégorie (sort, stats de base…) dans l'ordre d'apparition. */
export function groupChangesBySection(
  changes: StatChange[],
  fallbackTitle: string
): PatchChangeSection[] {
  const sections: PatchChangeSection[] = []
  const byTitle = new Map<string, PatchChangeSection>()
  for (const change of changes) {
    const title = change.subCategory?.trim() || fallbackTitle.trim()
    let section = byTitle.get(title)
    if (!section) {
      section = { title, changes: [] }
      byTitle.set(title, section)
      sections.push(section)
    }
    section.changes.push(change)
  }
  return sections
}
