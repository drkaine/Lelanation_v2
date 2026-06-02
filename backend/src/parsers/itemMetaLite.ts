import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type ItemMetaLite = {
  id: string
  tags?: string[]
  from?: string[]
  into?: string[]
  isMasterwork?: boolean
}

let itemMetaLiteCache: Map<number, ItemMetaLite> | null = null

export function getItemMetaLiteMap(): Map<number, ItemMetaLite> {
  if (itemMetaLiteCache) return itemMetaLiteCache
  const candidates = [
    join(process.cwd(), 'data', 'game', 'version.json'),
    join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', 'version.json'),
  ]
  let version = ''
  for (const path of candidates) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as { currentVersion?: string }
      if (raw.currentVersion) {
        version = String(raw.currentVersion)
        break
      }
    } catch {
      // try next path
    }
  }
  if (!version) {
    itemMetaLiteCache = new Map()
    return itemMetaLiteCache
  }
  const itemPaths = [
    join(process.cwd(), 'data', 'game', version, 'fr_FR', 'item.json'),
    join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', version, 'fr_FR', 'item.json'),
    join(process.cwd(), 'data', 'game', version, 'en_US', 'item.json'),
    join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', version, 'en_US', 'item.json'),
  ]
  for (const path of itemPaths) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
        data?: Record<string, Omit<ItemMetaLite, 'id'>>
      }
      const out = new Map<number, ItemMetaLite>()
      for (const [id, item] of Object.entries(raw.data ?? {})) {
        const num = Number(id)
        if (!Number.isFinite(num)) continue
        out.set(num, { id, ...item })
      }
      itemMetaLiteCache = out
      return out
    } catch {
      // try next path
    }
  }
  itemMetaLiteCache = new Map()
  return itemMetaLiteCache
}

export function hasItemMetaLite(): boolean {
  return getItemMetaLiteMap().size > 0
}
