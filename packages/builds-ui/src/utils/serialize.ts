/**
 * Framework-agnostic build serialization.
 * Pure functions — no store or side-effect dependency.
 */

import type {
  Build,
  StoredBuild,
  SubBuild,
  StoredSubBuild,
  SummonerSpellRef,
  ItemRef,
  Champion,
  Item,
  SummonerSpell,
} from '@lelanation/shared-types'

function serializeSubBuild(sub: SubBuild): StoredSubBuild {
  return {
    title: sub.title,
    description: sub.description,
    champion: sub.champion
      ? { id: sub.champion.id, name: sub.champion.name, image: sub.champion.image }
      : null,
    items: sub.items.map((item: Item) => ({ id: item.id, image: item.image })),
    runes: sub.runes,
    shards: sub.shards,
    summonerSpells: sub.summonerSpells.map((spell: SummonerSpell | null) =>
      spell ? { id: spell.id, key: spell.key, image: spell.image } : null
    ) as [SummonerSpellRef | null, SummonerSpellRef | null],
    skillOrder: sub.skillOrder
      ? { firstThreeUps: sub.skillOrder.firstThreeUps, skillUpOrder: sub.skillOrder.skillUpOrder }
      : null,
    roles: sub.roles ?? [],
    gameVersion: sub.gameVersion,
  }
}

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
    subBuilds: build.subBuilds ? build.subBuilds.map(serializeSubBuild) : undefined,
    descriptionMode: build.descriptionMode,
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

function resolveChampion(ref: { id: string; name: string; image: { full: string } } | null, catalogs: HydrationCatalogs): Champion | null {
  if (!ref) return null
  return catalogs.champions.find(c => c.id === ref.id) ?? {
    id: ref.id,
    key: ref.id,
    name: ref.name,
    title: '',
    image: { full: ref.image.full, sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
    stats: {} as Champion['stats'],
    spells: [],
    passive: { name: '', description: '', image: { full: ref.image.full, sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 } },
    tags: [],
  } as Champion
}

function resolveItems(refs: ItemRef[], catalogs: HydrationCatalogs): Item[] {
  return refs.map((ref: ItemRef) => {
    const full = catalogs.items.find(i => i.id === ref.id)
    if (full) return full
    const img = ref.image as { full: string; sprite?: string; group?: string; x?: number; y?: number; w?: number; h?: number } | undefined
    return {
      id: ref.id,
      name: ref.id,
      description: '',
      colloq: '',
      plaintext: '',
      image: img
        ? { full: img.full, sprite: img.sprite ?? '', group: img.group ?? '', x: img.x ?? 0, y: img.y ?? 0, w: img.w ?? 0, h: img.h ?? 0 }
        : { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
      gold: { base: 0, total: 0, sell: 0, purchasable: false },
      tags: [],
      depth: 0,
    } as Item
  })
}

function resolveSpells(refs: [SummonerSpellRef | null, SummonerSpellRef | null], catalogs: HydrationCatalogs): [SummonerSpell | null, SummonerSpell | null] {
  return refs.map(ref => {
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
  }) as [SummonerSpell | null, SummonerSpell | null]
}

function hydrateSubBuild(stored: StoredSubBuild, catalogs: HydrationCatalogs): SubBuild {
  return {
    title: stored.title,
    description: stored.description,
    champion: resolveChampion(stored.champion, catalogs),
    items: resolveItems(stored.items, catalogs),
    runes: stored.runes,
    shards: stored.shards,
    summonerSpells: resolveSpells(stored.summonerSpells, catalogs),
    skillOrder: normalizeSkillOrder(stored.skillOrder),
    roles: stored.roles ?? [],
    gameVersion: stored.gameVersion,
  }
}

/** Reconstruct a full build from lightweight storage, using provided catalogs */
export function hydrateBuild(stored: StoredBuild, catalogs: HydrationCatalogs): Build {
  const champion = resolveChampion(stored.champion, catalogs)
  const items = resolveItems(stored.items, catalogs)
  const summonerSpells = resolveSpells(stored.summonerSpells, catalogs)

  return {
    id: stored.id, name: stored.name, author: stored.author, description: stored.description,
    visibility: stored.visibility, champion, items, runes: stored.runes, shards: stored.shards,
    summonerSpells, skillOrder: normalizeSkillOrder(stored.skillOrder),
    roles: stored.roles, upvote: stored.upvote, downvote: stored.downvote,
    gameVersion: stored.gameVersion, createdAt: stored.createdAt, updatedAt: stored.updatedAt,
    subBuilds: stored.subBuilds ? stored.subBuilds.map(s => hydrateSubBuild(s, catalogs)) : undefined,
    descriptionMode: stored.descriptionMode,
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
