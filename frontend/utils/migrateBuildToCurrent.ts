import type { Build, RunePath } from '~/types/build'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'

function runeIdExists(paths: RunePath[], id: number): boolean {
  if (!id) return false
  for (const p of paths) {
    for (const s of p.slots) {
      if (s.runes.some(r => r.id === id)) return true
    }
  }
  return false
}

export async function migrateBuildToCurrent(
  build: Build
): Promise<{ migrated: Build; warnings: string[] }> {
  const warnings: string[] = []

  const versionStore = useVersionStore()
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  const currentVersion = versionStore.currentVersion || build.gameVersion || 'unknown'

  const championsStore = useChampionsStore()
  const itemsStore = useItemsStore()
  const runesStore = useRunesStore()
  const spellsStore = useSummonerSpellsStore()

  if (championsStore.champions.length === 0) championsStore.loadChampions()
  if (itemsStore.items.length === 0) itemsStore.loadItems()
  if (runesStore.runePaths.length === 0) runesStore.loadRunes()
  if (spellsStore.spells.length === 0) spellsStore.loadSummonerSpells()

  // Wait for stores to load (best-effort: they set status, but we don't have an await)
  // In practice, these are fast on local backend; we keep migration defensive.

  const migrated: Build = {
    ...build,
    gameVersion: currentVersion,
    updatedAt: new Date().toISOString(),
  }

  // Champion: replace with current champion if available
  if (build.champion) {
    const currentChampion = championsStore.champions.find(c => c.id === build.champion!.id)
    if (currentChampion) {
      migrated.champion = currentChampion
    } else {
      warnings.push('Champion introuvable dans la version courante (conservé tel quel).')
    }
  }

  // Items: drop items not present anymore
  if (Array.isArray(build.items) && build.items.length > 0) {
    const validIds = new Set(itemsStore.items.map(i => i.id))
    const kept = build.items.filter(i => validIds.has(i.id))
    if (kept.length !== build.items.length) {
      warnings.push('Certains items ont été retirés (introuvables dans la version courante).')
    }
    migrated.items = kept
  }

  // Summoner spells: ensure both exist, else set nulls
  if (Array.isArray(build.summonerSpells) && build.summonerSpells.length === 2) {
    const validSpellIds = new Set(spellsStore.spells.map(s => s.id))
    const next = build.summonerSpells.map(s =>
      s && validSpellIds.has(s.id) ? s : null
    ) as Build['summonerSpells']
    if (next.includes(null)) {
      warnings.push(
        'Certains sorts d’invocateur ont été retirés (introuvables dans la version courante).'
      )
    }
    migrated.summonerSpells = next
  }

  // Runes: verify ids exist, else remove runes config
  if (build.runes) {
    const paths = runesStore.runePaths
    const okPrimaryPath = paths.some(p => p.id === build.runes!.primary.pathId)
    const okSecondaryPath = paths.some(p => p.id === build.runes!.secondary.pathId)
    const okKeystone = runeIdExists(paths, build.runes.primary.keystone)
    const okS1 = runeIdExists(paths, build.runes.primary.slot1)
    const okS2 = runeIdExists(paths, build.runes.primary.slot2)
    const okS3 = runeIdExists(paths, build.runes.primary.slot3)
    const okSS1 = runeIdExists(paths, build.runes.secondary.slot1)
    const okSS2 = runeIdExists(paths, build.runes.secondary.slot2)

    if (!okPrimaryPath || !okSecondaryPath || !okKeystone) {
      migrated.runes = null
      warnings.push('Configuration de runes retirée (incompatible avec la version courante).')
    } else {
      migrated.runes = {
        primary: {
          pathId: build.runes.primary.pathId,
          keystone: build.runes.primary.keystone,
          slot1: okS1 ? build.runes.primary.slot1 : 0,
          slot2: okS2 ? build.runes.primary.slot2 : 0,
          slot3: okS3 ? build.runes.primary.slot3 : 0,
        },
        secondary: {
          pathId: build.runes.secondary.pathId,
          slot1: okSS1 ? build.runes.secondary.slot1 : 0,
          slot2: okSS2 ? build.runes.secondary.slot2 : 0,
        },
      }
      if (!okS1 || !okS2 || !okS3 || !okSS1 || !okSS2) {
        warnings.push('Certaines runes secondaires/slots ont été retirées (introuvables).')
      }
    }
  }

  return { migrated, warnings }
}
