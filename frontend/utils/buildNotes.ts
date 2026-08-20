import type { Build, BuildNotesContent, SubBuild } from '@lelanation/shared-types'
import {
  BUILD_NOTES_DETAILED_SECTION_MAX_CHARS,
  BUILD_NOTES_SIMPLE_CARD_MAX_CHARS,
} from '@lelanation/shared-types'

export { BUILD_NOTES_DETAILED_SECTION_MAX_CHARS, BUILD_NOTES_SIMPLE_CARD_MAX_CHARS }

export function createEmptyNotesContent(): BuildNotesContent {
  return {
    layout: 'simple',
    youtubeUrl: '',
    simpleCards: [],
    detailed: {},
  }
}

function hasNotesContent(notes: BuildNotesContent | undefined): boolean {
  if (!notes) return false
  if (notes.youtubeUrl?.trim()) return true
  if (notes.simpleCards.some(card => card.title.trim() || card.body.trim())) return true
  const d = notes.detailed
  if (d.howToTrade?.trim()) return true
  if (d.whatToWatchOutFor?.trim()) return true
  if (d.tips?.trim()) return true
  return false
}

export function buildHasAnyNotes(build: Pick<Build, 'notes' | 'notesMode' | 'subBuilds'>): boolean {
  if (hasNotesContent(build.notes)) return true
  return (build.subBuilds ?? []).some(sub => hasNotesContent(sub.notes))
}

export function getActiveBuildNotes(
  build: Build | null | undefined,
  variantKey: 'main' | number
): BuildNotesContent {
  if (!build) return createEmptyNotesContent()
  const mode = build.notesMode ?? 'single'
  if (mode === 'single' || variantKey === 'main') {
    return build.notes ?? createEmptyNotesContent()
  }
  const sub = build.subBuilds?.[variantKey as number]
  return sub?.notes ?? createEmptyNotesContent()
}

export function normalizeYoutubeUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

export function extractYoutubeVideoId(url: string | undefined): string | null {
  const value = (url ?? '').trim()
  if (!value) return null
  try {
    const parsed = new URL(normalizeYoutubeUrl(value))
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/?]+)/)
      if (embedMatch?.[1]) return embedMatch[1]
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/)
      if (shortsMatch?.[1]) return shortsMatch[1]
    }
  } catch {
    return null
  }
  return null
}

export function createNotesCardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function cloneNotesContent(notes: BuildNotesContent | undefined): BuildNotesContent {
  if (!notes) return createEmptyNotesContent()
  return {
    layout: notes.layout,
    youtubeUrl: notes.youtubeUrl ?? '',
    simpleCards: notes.simpleCards.map(card => ({ ...card })),
    detailed: { ...notes.detailed },
  }
}

export function notesForSubBuild(sub: SubBuild | undefined): BuildNotesContent {
  return sub?.notes ?? createEmptyNotesContent()
}
