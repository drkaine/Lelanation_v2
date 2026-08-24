import type { Item } from '../types/build'

type ItemLocale = 'fr_FR' | 'en_US'

/** Quest / stack transforms missing from Data Dragon `into` (items page only). */
export const ITEM_SHOP_EVOLUTION_INTO: Record<string, readonly string[]> = {
  '3003': ['3040'],
  '3004': ['3042'],
  '3119': ['3121'],
  '2526': ['2530'],
  '3865': ['3866'],
  '3866': ['3867'],
  '3867': ['3869', '3870', '3871', '3876', '3877'],
}

export const ITEM_SHOP_SYNTHETIC_ITEMS: Record<
  string,
  { baseItemId: string; goldTotal: number; names: Record<ItemLocale, string> }
> = {
  '2530': {
    baseItemId: '2526',
    goldTotal: 2250,
    names: { fr_FR: 'Diadème musical', en_US: 'Diadem of Songs' },
  },
  '3040': {
    baseItemId: '3003',
    goldTotal: 2900,
    names: { fr_FR: 'Étreinte du séraphin', en_US: "Seraph's Embrace" },
  },
  '3042': {
    baseItemId: '3004',
    goldTotal: 2900,
    names: { fr_FR: 'Muramana', en_US: 'Muramana' },
  },
  '3121': {
    baseItemId: '3119',
    goldTotal: 2400,
    names: { fr_FR: 'Fimbulvetr', en_US: 'Fimbulwinter' },
  },
  '3866': {
    baseItemId: '3865',
    goldTotal: 400,
    names: { fr_FR: 'Boussole runique', en_US: 'Runic Compass' },
  },
  '3867': {
    baseItemId: '3865',
    goldTotal: 400,
    names: { fr_FR: 'Trésor des mondes', en_US: 'Bounty of Worlds' },
  },
}

function normalizeItemLocale(language: string): ItemLocale {
  return language.startsWith('fr') ? 'fr_FR' : 'en_US'
}

function mergeUniqueIds(primary?: string[], extra?: readonly string[]): string[] | undefined {
  const merged = [...new Set([...(primary ?? []), ...(extra ?? [])])]
  return merged.length ? merged : undefined
}

export function getItemShopIntoIds(item: Pick<Item, 'id' | 'into'> | null | undefined): string[] {
  if (!item?.id) return []
  return mergeUniqueIds(item.into, ITEM_SHOP_EVOLUTION_INTO[item.id]) ?? []
}

function synthesizeShopEvolutionItem(base: Item, evolutionId: string, locale: ItemLocale): Item {
  const template = ITEM_SHOP_SYNTHETIC_ITEMS[evolutionId]
  const name = template?.names[locale] ?? base.name
  const goldTotal = template?.goldTotal ?? base.gold?.total ?? 0

  return {
    ...base,
    id: evolutionId,
    name,
    image: {
      ...base.image,
      full: `${evolutionId}.png`,
    },
    from: undefined,
    into: ITEM_SHOP_EVOLUTION_INTO[evolutionId]
      ? [...ITEM_SHOP_EVOLUTION_INTO[evolutionId]]
      : undefined,
    gold: base.gold
      ? {
          ...base.gold,
          total: goldTotal,
          base: goldTotal,
          purchasable: false,
        }
      : { base: goldTotal, total: goldTotal, sell: 0, purchasable: false },
    plaintext: '',
    description: base.description,
  }
}

/** Enrich catalog for /items: synthetic evolutions + merged `into` links. */
export function enrichItemShopCatalog(items: Item[], language: string = 'en_US'): Item[] {
  const locale = normalizeItemLocale(language)
  const byId = new Map(items.map(item => [item.id, { ...item }]))

  for (const item of byId.values()) {
    const mergedInto = getItemShopIntoIds(item)
    if (mergedInto.length) {
      item.into = mergedInto
    }
  }

  for (const [evolutionId, template] of Object.entries(ITEM_SHOP_SYNTHETIC_ITEMS)) {
    if (byId.has(evolutionId)) continue
    const base = byId.get(template.baseItemId)
    if (!base) continue
    byId.set(evolutionId, synthesizeShopEvolutionItem(base, evolutionId, locale))
  }

  return [...byId.values()]
}
