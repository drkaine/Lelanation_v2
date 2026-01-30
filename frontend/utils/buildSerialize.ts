/**
 * Sérialisation / hydratation des builds pour alléger le stockage (locale et serveur).
 * On ne garde que id, nom et image pour retrouver les données complètes à l'hydratation.
 */

import type {
  Build,
  StoredBuild,
  SummonerSpellRef,
  Champion,
  Item,
  SummonerSpell,
} from '~/types/build'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'

/** Réduit un build complet en format léger pour sauvegarde */
export function serializeBuild(build: Build): StoredBuild {
  return {
    id: build.id,
    name: build.name,
    author: build.author,
    description: build.description,
    visibility: build.visibility,
    champion: build.champion
      ? {
          id: build.champion.id,
          name: build.champion.name,
          image: build.champion.image,
        }
      : null,
    items: build.items.map(item => ({
      id: item.id,
      image: item.image,
    })),
    runes: build.runes,
    shards: build.shards,
    summonerSpells: build.summonerSpells.map(spell =>
      spell
        ? {
            id: spell.id,
            key: spell.key,
            image: spell.image,
          }
        : null
    ) as [SummonerSpellRef | null, SummonerSpellRef | null],
    skillOrder: build.skillOrder,
    roles: build.roles ?? [],
    upvote: build.upvote ?? 0,
    downvote: build.downvote ?? 0,
    gameVersion: build.gameVersion,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
  }
}

/** Reconstruit un build complet à partir du format léger (utilise les stores pour les données complètes) */
export function hydrateBuild(stored: StoredBuild): Build {
  const championsStore = useChampionsStore()
  const itemsStore = useItemsStore()
  const spellsStore = useSummonerSpellsStore()

  const champion: Champion | null = stored.champion
    ? (championsStore.champions.find(c => c.id === stored.champion!.id) ??
      ({
        id: stored.champion.id,
        key: stored.champion.id,
        name: stored.champion.name,
        title: '',
        image: stored.champion.image,
        stats: {} as Champion['stats'],
        spells: [],
        passive: { name: '', description: '', image: stored.champion.image },
        tags: [],
      } as Champion))
    : null

  const items: Item[] = stored.items.map(ref => {
    const full = itemsStore.items.find(i => i.id === ref.id)
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
      const full = spellsStore.getSpellById(ref.id) ?? spellsStore.getSpellById(ref.key ?? '')
      if (full) return full
      return {
        id: ref.id,
        key: ref.key ?? ref.id,
        name: ref.id,
        description: '',
        tooltip: '',
        maxrank: 1,
        cooldown: [],
        cooldownBurn: '',
        cost: [],
        costBurn: '',
        datavalues: {},
        effect: [],
        effectBurn: [],
        vars: [],
        summonerLevel: 1,
        modes: [],
        costType: '',
        maxammo: '',
        range: [],
        rangeBurn: '',
        image: ref.image ?? { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
        resource: '',
      } as SummonerSpell
    }
  ) as [SummonerSpell | null, SummonerSpell | null]

  return {
    id: stored.id,
    name: stored.name,
    author: stored.author,
    description: stored.description,
    visibility: stored.visibility,
    champion,
    items,
    runes: stored.runes,
    shards: stored.shards,
    summonerSpells,
    skillOrder: stored.skillOrder,
    roles: stored.roles,
    upvote: stored.upvote,
    downvote: stored.downvote,
    gameVersion: stored.gameVersion,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  }
}

/** Indique si un objet parsé est un StoredBuild (format léger). Les items en format léger n'ont pas "gold". */
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
