import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isBootsItemId } from '../parsers/bootItemClassification.js'
import {
  isStarterItemId,
  STARTER_PURCHASE_WINDOW_MS,
} from '../parsers/starterItemClassification.js'

export type ItemMeta = {
  id: string
  name: string
  tags?: string[]
  from?: string[]
  into?: string[]
  isMasterwork?: boolean
}

type TimelineLikeItemEvent = {
  type: string
  timestamp?: number
  participantId?: number
  itemId?: number
  beforeId?: number
  afterId?: number
}

export type MatchPlayerItemRowInput = {
  itemId: number
  starter: boolean
  core: boolean
  order: number
  timestampMs: number
}

const FORCED_LEGENDARY_IDS = new Set(['2526'])
const TRINKET_IDS = new Set(['3340', '3363', '3364'])

let itemMetaCache: Map<number, ItemMeta> | null = null
let itemMetaLoadPromise: Promise<Map<number, ItemMeta>> | null = null

export async function loadItemMeta(): Promise<Map<number, ItemMeta>> {
  if (itemMetaCache) return itemMetaCache
  if (itemMetaLoadPromise) return itemMetaLoadPromise
  itemMetaLoadPromise = (async () => {
    const versionPath = join(process.cwd(), 'data', 'game', 'version.json')
    let currentVersion = ''
    try {
      const raw = JSON.parse(await readFile(versionPath, 'utf-8')) as { currentVersion?: string }
      currentVersion = String(raw.currentVersion ?? '')
    } catch {
      itemMetaCache = new Map()
      return itemMetaCache
    }
    if (!currentVersion) {
      itemMetaCache = new Map()
      return itemMetaCache
    }
    const candidatePaths = [
      join(process.cwd(), 'data', 'game', currentVersion, 'fr_FR', 'item.json'),
      join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', currentVersion, 'fr_FR', 'item.json'),
      join(process.cwd(), 'data', 'game', currentVersion, 'en_US', 'item.json'),
      join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', currentVersion, 'en_US', 'item.json'),
    ]
    for (const path of candidatePaths) {
      try {
        const raw = JSON.parse(await readFile(path, 'utf-8')) as { data?: Record<string, Omit<ItemMeta, 'id'>> }
        const data = raw.data ?? {}
        const map = new Map<number, ItemMeta>()
        for (const [id, item] of Object.entries(data)) {
          const numId = Number(id)
          if (!Number.isFinite(numId)) continue
          map.set(numId, { id, ...item })
        }
        itemMetaCache = map
        return map
      } catch {
        // try next path
      }
    }
    itemMetaCache = new Map()
    return itemMetaCache
  })()
  return itemMetaLoadPromise
}

function isBoots(item: ItemMeta | undefined, itemId: number): boolean {
  if (isBootsItemId(itemId)) return true
  if (item?.tags?.includes('Boots')) return true
  if (item?.from?.some((parentId) => isBootsItemId(Number(parentId)))) return true
  return false
}

/** Bottes (tags / arbre d’objets) — pour stats overview hors agrégat solo général. */
export function isBootsItem(item: ItemMeta | undefined, itemId: number): boolean {
  return isBoots(item, itemId)
}

function isLegendary(item: ItemMeta | undefined, itemId: number): boolean {
  const id = String(itemId)
  if (FORCED_LEGENDARY_IDS.has(id)) return true
  if (item?.isMasterwork) return true
  if (!item) return false
  const hasFrom = Array.isArray(item.from) && item.from.length > 0
  const hasInto = Array.isArray(item.into) && item.into.length > 0
  return hasFrom && !hasInto
}

function firstTimestampByItem(events: TimelineLikeItemEvent[], participantId: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const ev of events) {
    if (ev.type !== 'ITEM_PURCHASED') continue
    if (ev.participantId !== participantId) continue
    const itemId = Number(ev.itemId ?? 0)
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    if (TRINKET_IDS.has(String(itemId))) continue
    const ts = Number(ev.timestamp ?? 0)
    if (!out.has(itemId)) out.set(itemId, Number.isFinite(ts) ? Math.max(0, Math.trunc(ts)) : 0)
  }
  return out
}

function uniqueStable(items: number[]): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of items) {
    if (!Number.isFinite(id) || id <= 0) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export async function selectMatchPlayerItems(params: {
  participant: Record<string, unknown>
  participantId: number
  events: TimelineLikeItemEvent[]
}): Promise<MatchPlayerItemRowInput[]> {
  const itemMeta = await loadItemMeta()
  const firstTs = firstTimestampByItem(params.events, params.participantId)

  const starterCandidates = Array.from(firstTs.keys())
    .filter((itemId) => {
      const ts = firstTs.get(itemId) ?? Number.MAX_SAFE_INTEGER
      return ts <= STARTER_PURCHASE_WINDOW_MS && isStarterItemId(itemId, itemMeta.get(itemId))
    })
    .sort((a, b) => (firstTs.get(a) ?? 0) - (firstTs.get(b) ?? 0))
  const starters = uniqueStable(starterCandidates).slice(0, 2)

  const finalInventory = uniqueStable([
    Number(params.participant.item0 ?? 0),
    Number(params.participant.item1 ?? 0),
    Number(params.participant.item2 ?? 0),
    Number(params.participant.item3 ?? 0),
    Number(params.participant.item4 ?? 0),
    Number(params.participant.item5 ?? 0),
  ]).filter((id) => id > 0 && !TRINKET_IDS.has(String(id)))

  const boot = finalInventory.find((itemId) => !starters.includes(itemId) && isBoots(itemMeta.get(itemId), itemId)) ?? null

  const legendaryCandidates = finalInventory
    .filter(
      (itemId) =>
        !starters.includes(itemId) && itemId !== boot && !isStarterItemId(itemId, itemMeta.get(itemId)),
    )
    .filter((itemId) => isLegendary(itemMeta.get(itemId), itemId))
    .sort((a, b) => (firstTs.get(a) ?? Number.MAX_SAFE_INTEGER) - (firstTs.get(b) ?? Number.MAX_SAFE_INTEGER))
  const legendaries = legendaryCandidates.slice(0, 3)
  const legendarySet = new Set<number>(legendaries)

  /** Slots finaux hors starters / bottes / top-3 légendaires (épiques, 4e légendaire, etc.) — sinon `count_final` reste 0 et l’overview « objets finaux » est vide. */
  const finalOthers = finalInventory.filter(
    (itemId) =>
      !starters.includes(itemId) &&
      itemId !== boot &&
      !legendarySet.has(itemId) &&
      !isStarterItemId(itemId, itemMeta.get(itemId)) &&
      !isBoots(itemMeta.get(itemId), itemId)
  )

  const selected = uniqueStable([
    ...starters,
    ...(boot != null ? [boot] : []),
    ...legendaries,
    ...finalOthers,
  ])

  const coreSet = new Set<number>([...legendaries])
  const starterSet = new Set<number>(starters)

  return selected.map((itemId, idx) => ({
    itemId,
    starter: starterSet.has(itemId),
    core: coreSet.has(itemId),
    order: idx,
    timestampMs: firstTs.get(itemId) ?? 0,
  }))
}
