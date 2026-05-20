/** Initiales champion (2 lettres) pour fallback image. */
export function championInitials(name: string, championId?: string | number): string {
  const n = (name || '').trim()
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }
  const id = String(championId ?? '')
  return id.length >= 2 ? id.slice(0, 2).toUpperCase() : '??'
}

/** Couleur de fond stable à partir de l’id champion. */
export function championFallbackColor(championId: string | number): string {
  const id = Number(championId) || 0
  const hue = Math.abs(id * 47) % 360
  return `hsl(${hue} 42% 32%)`
}

export type ChampionNamePart = { text: string; match: boolean }

/** Découpe un nom pour surligner la requête (insensible à la casse). */
export function splitChampionNameHighlight(name: string, query: string): ChampionNamePart[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text: name, match: false }]
  const lower = name.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return [{ text: name, match: false }]
  const parts: ChampionNamePart[] = []
  if (idx > 0) parts.push({ text: name.slice(0, idx), match: false })
  parts.push({ text: name.slice(idx, idx + q.length), match: true })
  if (idx + q.length < name.length) {
    parts.push({ text: name.slice(idx + q.length), match: false })
  }
  return parts
}
