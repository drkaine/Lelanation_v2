/** Document JSON stocké dans `participants.spell_history`. */
export type SpellHistoryDoc = {
  /** Séquence complète Q/W/E/R (ex. `1-2-1-3-1-4`). */
  order?: string
  /** Premier timestamp (ms) par slot 1–4 — rétrocompat. */
  tsBySlot?: Record<string, number>
  /** Somme des timestamps de montée de sort (ms). */
  sumTimestampMs?: number
}

export function emptySpellHistoryDoc(): SpellHistoryDoc {
  return { order: '', tsBySlot: {}, sumTimestampMs: 0 }
}

export function spellOrderFromHistoryDoc(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
  const doc = raw as SpellHistoryDoc & Record<string, unknown>
  const explicit = String(doc.order ?? '').trim()
  if (explicit) return explicit
  // Legacy: flat { "1": ts, "2": ts } — pas une vraie séquence, ignoré.
  return ''
}

export function spellTimestampSumFromHistoryDoc(raw: unknown): number {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const doc = raw as SpellHistoryDoc & Record<string, unknown>
  const sum = Number(doc.sumTimestampMs ?? 0)
  if (Number.isFinite(sum) && sum > 0) return Math.trunc(sum)
  const tsBySlot = doc.tsBySlot ?? (doc as Record<string, number>)
  if (!tsBySlot || typeof tsBySlot !== 'object') return 0
  let legacySum = 0
  for (const v of Object.values(tsBySlot)) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) legacySum += n
  }
  return Math.trunc(legacySum)
}

export function buildSpellHistoryDocFromEvents(
  events: Array<{ type?: string; participantId?: number; skillSlot?: number; timestamp?: number }>,
  participantId: number,
): SpellHistoryDoc {
  const pid = Math.trunc(participantId)
  const slots: string[] = []
  let sumTimestampMs = 0
  const firstTsBySlot: Record<string, number> = {}
  for (const event of events) {
    if (event.type !== 'SKILL_LEVEL_UP' || Math.trunc(Number(event.participantId ?? 0)) !== pid) {
      continue
    }
    const skill = Math.trunc(Number(event.skillSlot ?? 0))
    if (skill !== 1 && skill !== 2 && skill !== 3 && skill !== 4) continue
    const ts = Math.trunc(Number(event.timestamp ?? 0))
    if (ts > 0) sumTimestampMs += ts
    const key = String(skill)
    if (firstTsBySlot[key] == null) firstTsBySlot[key] = ts
    slots.push(key)
  }
  return {
    order: slots.join('-'),
    tsBySlot: firstTsBySlot,
    sumTimestampMs,
  }
}
