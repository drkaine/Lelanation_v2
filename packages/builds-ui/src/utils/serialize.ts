/**
 * Framework-agnostic build serialization.
 * Pure functions — no store or side-effect dependency.
 */

import type {
  Build,
  StoredBuild,
  SummonerSpellRef,
  Champion,
  Item,
  SummonerSpell,
} from '@lelanation/shared-types'

/** Reduce a full build to lightweight format for storage */
export function serializeBuild(build: Build): StoredBuild {
  return {
    id: build.id,
    name: build.name,
    author: build.author,
    description: build.description,
    visibility: build.visibility,
    champion: build.champion
      ? { id: build.champion.id, name: build.champion.name, image: build.champion.image }
      : null,
    items: build.items.map(item => ({ id: item.id, image: item.image })),
    runes: build.runes,
    shards: build.shards,
    summonerSpells: build.summonerSpells.map(spell =>
      spell ? { id: spell.id, key: spell.key, image: spell.image } : null
    ) as [SummonerSpellRef | null, SummonerSpellRef | null],
    skillOrder: build.skillOrder
      ? { firstThreeUps: build.skillOrder.firstThreeUps, skillUpOrder: build.skillOrder.skillUpOrder }
      : null,
    roles: build.roles ?? [],
    upvote: build.upvote ?? 0,
    downvote: build.downvote ?? 0,
    gameVersion: build.gameVersion,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
  }
}

/** Normalize skillOrder for old builds that may lack it */
function normalizeSkillOrder(so: StoredBuild['skillOrder']): Build['skillOrder'] {
  const pad3 = <T>(arr: T[] | undefined | null): (T | null)[] => {
    const a = Array.isArray(arr) ? [...arr] : []
    while (a.length < 3) a.push(null as T)
    return a.slice(0, 3) as (T | null)[]
  }
  if (!so) {
    return { firstThreeUps: pad3(null), skillUpOrder: pad3(null) } as Build['skillOrder']
  }
  return { firstThreeUps: pad3(so.firstThreeUps), skillUpOrder: pad3(so.skillUpOrder) } as Build['skillOrder']
}

export interface HydrationCatalogs {
  champions: Champion[]
  items: Item[]
  getSpellById: (id: string) => SummonerSpell | undefined
}

/** Reconstruct a full build from lightweight storage, using provided catalogs */
export function hydrateBuild(stored: StoredBuild, catalogs: HydrationCatalogs): Build {
  const champion: Champion | null = stored.champion
    ? (catalogs.champions.find(c => c.id === stored.champion!.id) ?? {
        id: stored.champion.id,
        key: stored.champion.id,
        name: stored.champion.name,
        title: '',
        image: stored.champion.image,
        stats: {} as Champion['stats'],
        spells: [],
        passive: { name: '', description: '', image: stored.champion.image },
        tags: [],
      } as Champion)
    : null

  const items: Item[] = stored.items.map(ref => {
    const full = catalogs.items.find(i => i.id === ref.id)
    if (full) return full
    return {
      id: ref.id,
      name: ref.id,
      description: '',
      colloq: '',
      plaintext: '',
      image: ref.image ?? { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
      gold: { base: 0, total: 0, sell: 0, purchasable: false },
      tags: [],
      depth: 0,
    } as Item
  })

  const summonerSpells: [SummonerSpell | null, SummonerSpell | null] = stored.summonerSpells.map(
    ref => {
      if (!ref) return null
      const full = catalogs.getSpellById(ref.id) ?? catalogs.getSpellById(ref.key ?? '')
      if (full) return full
      return {
        id: ref.id, key: ref.key ?? ref.id, name: ref.id, description: '', tooltip: '',
        maxrank: 1, cooldown: [], cooldownBurn: '', cost: [], costBurn: '', datavalues: {},
        effect: [], effectBurn: [], vars: [], summonerLevel: 1, modes: [], costType: '',
        maxammo: '', range: [], rangeBurn: '',
        image: ref.image ?? { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
        resource: '',
      } as SummonerSpell
    }
  ) as [SummonerSpell | null, SummonerSpell | null]

  return {
    id: stored.id, name: stored.name, author: stored.author, description: stored.description,
    visibility: stored.visibility, champion, items, runes: stored.runes, shards: stored.shards,
    summonerSpells, skillOrder: normalizeSkillOrder(stored.skillOrder),
    roles: stored.roles, upvote: stored.upvote, downvote: stored.downvote,
    gameVersion: stored.gameVersion, createdAt: stored.createdAt, updatedAt: stored.updatedAt,
  }
}

/** Detect if a parsed object is a StoredBuild (lightweight) vs full Build */
export function isStoredBuild(value: unknown): value is StoredBuild {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  if (!Array.isArray(o.items)) return false
  const first = o.items[0]
  if (first != null && typeof first === 'object') {
    return !('gold' in first)
  }
  return true
}
