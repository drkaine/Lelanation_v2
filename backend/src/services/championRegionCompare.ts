import { mapUniverseFactionSlug } from './championRegionFactionMap.js'

export type UniverseChampionEntry = {
  slug: string
  name: string
  factionSlug: string
}

export type ChampionRegionDiff = {
  championId: string
  name: string
  from?: string
  to: string
  kind: 'missing' | 'explicit_mismatch' | 'unaffiliated_mismatch'
}

export type ChampionRegionCompareResult = {
  diffs: ChampionRegionDiff[]
  unknownFactionSlugs: string[]
  unresolved: Array<{ slug: string; name: string }>
}

export function compareChampionRegions(
  universeChampions: UniverseChampionEntry[],
  championIdByNormKey: Map<string, string>,
  currentMapping: Record<string, string>
): ChampionRegionCompareResult {
  const diffs: ChampionRegionDiff[] = []
  const unknownFactionSlugs = new Set<string>()
  const unresolved: Array<{ slug: string; name: string }> = []

  for (const entry of universeChampions) {
    const championId =
      championIdByNormKey.get(entry.slug.toLowerCase().replace(/[^a-z0-9]/g, '')) ??
      championIdByNormKey.get(entry.name.toLowerCase().replace(/[^a-z0-9]/g, ''))

    if (!championId) {
      unresolved.push({ slug: entry.slug, name: entry.name })
      continue
    }

    const expectedRegion = mapUniverseFactionSlug(entry.factionSlug)
    if (!expectedRegion) {
      unknownFactionSlugs.add(entry.factionSlug)
      continue
    }

    const currentRegion = currentMapping[championId]
    if (!currentRegion) {
      diffs.push({
        championId,
        name: entry.name,
        to: expectedRegion,
        kind: 'missing',
      })
      continue
    }

    if (currentRegion === expectedRegion) continue

    if (entry.factionSlug === 'unaffiliated') {
      diffs.push({
        championId,
        name: entry.name,
        from: currentRegion,
        to: expectedRegion,
        kind: 'unaffiliated_mismatch',
      })
      continue
    }

    diffs.push({
      championId,
      name: entry.name,
      from: currentRegion,
      to: expectedRegion,
      kind: 'explicit_mismatch',
    })
  }

  return {
    diffs,
    unknownFactionSlugs: [...unknownFactionSlugs].sort(),
    unresolved,
  }
}

export function applyAutoChampionRegionUpdates(
  mapping: Record<string, string>,
  diffs: ChampionRegionDiff[]
): { mapping: Record<string, string>; applied: ChampionRegionDiff[] } {
  const next = { ...mapping }
  const applied: ChampionRegionDiff[] = []

  for (const diff of diffs) {
    if (diff.kind === 'missing' || diff.kind === 'explicit_mismatch') {
      next[diff.championId] = diff.to
      applied.push(diff)
    }
  }

  return { mapping: next, applied }
}

export function sortChampionMapping(mapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b, 'en'))
  )
}
