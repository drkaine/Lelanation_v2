/**
 * Extract and resolve entity IDs (champions, items, runes) from patch notes HTML.
 */

import type { EntityCategory, EntityChanges } from './types.js';

const D_DRAGON_ITEM_RE = /\/img\/item\/(\d+)\.png/i;
const D_DRAGON_CHAMPION_RE = /\/img\/champion\/([^/.]+)\.png/i;
const CHAMPION_PAGE_RE = /\/champions\/([^/]+)\/?$/i;
const AKAMAI_PROXY_RE = /[?&]f=(https?%3A%2F%2F[^&]+|https?:\/\/[^&]+)/i;

/** Champions whose Riot URL slug does not match a simple capitalized id. */
const CHAMPION_SLUG_OVERRIDES: Record<string, string> = {
  aurelionsol: 'AurelionSol',
  belveth: 'Belveth',
  chogath: 'Chogath',
  drmundo: 'DrMundo',
  jarvaniv: 'JarvanIV',
  kaisa: 'Kaisa',
  khazix: 'Khazix',
  kogmaw: 'KogMaw',
  leblanc: 'Leblanc',
  leesin: 'LeeSin',
  masteryi: 'MasterYi',
  missfortune: 'MissFortune',
  monkeyking: 'MonkeyKing',
  naafiri: 'Naafiri',
  nidalee: 'Nidalee',
  reksai: 'RekSai',
  renataglasc: 'Renata',
  tahmkench: 'TahmKench',
  twistedfate: 'TwistedFate',
  velkoz: 'Velkoz',
  xinzhao: 'XinZhao',
  yuumi: 'Yuumi',
};

/** Items whose patch slug does not directly map to game data name (apostrophe issues). */
const ITEM_SLUG_OVERRIDES: Record<string, string> = {
  'zekes-convergence': '3050',
  'knights-vow': '3109',
  'moonstone-renewer': '6617',
  'dream-maker': '3870',
  'locket-of-the-iron-solari': '3190',
  'echoes-of-helia': '6620',
  'hexplaque-experimentale': '3073',
  'experimental-hexplate': '3073',
};

export interface EntityIdExtraction {
  id?: string;
  imageUrl?: string;
}

function decodeProxyUrl(href: string): string {
  const match = href.match(AKAMAI_PROXY_RE);
  if (!match) return href;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function extractDdragonFromHref(href: string): EntityIdExtraction | null {
  const decoded = decodeProxyUrl(href);

  const itemMatch = decoded.match(D_DRAGON_ITEM_RE);
  if (itemMatch) {
    // Only return the ID, not the full Data Dragon URL
    // Frontend will use local images
    return { id: itemMatch[1] };
  }

  const championMatch = decoded.match(D_DRAGON_CHAMPION_RE);
  if (championMatch) {
    // Only return the ID, not the full Data Dragon URL
    // Frontend will use local images
    return { id: championMatch[1] };
  }

  return null;
}

export function championSlugToId(slug: string): string | undefined {
  const normalized = slug.toLowerCase().trim();
  if (!normalized) return undefined;

  if (CHAMPION_SLUG_OVERRIDES[normalized]) {
    return CHAMPION_SLUG_OVERRIDES[normalized];
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function patchHeaderIdToSlug(headerId: string): string | undefined {
  if (!headerId.startsWith('patch-')) return undefined;
  return headerId.slice('patch-'.length);
}

export function patchSlugToRuneKey(patchSlug: string): string {
  return patchSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function patchSlugToEnglishName(patchSlug: string): string {
  return patchSlug.replace(/-/g, ' ');
}

function normalizeImageUrl(href: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed || trimmed.includes('how-to-play') || CHAMPION_PAGE_RE.test(trimmed)) {
    return undefined;
  }
  // Don't store Data Dragon or external URLs - frontend uses local images
  if (trimmed.includes('ddragon.leagueoflegends.com')) {
    return undefined;
  }
  // Only keep cmsassets.rgpub.io images (Riot's CDN for non-game assets like runes)
  if (!trimmed.includes('cmsassets.rgpub.io') && !trimmed.includes('akamaihd.net')) {
    return undefined;
  }
  const imageMatch = trimmed.match(
    /(https:\/\/cmsassets\.rgpub\.io[^\s"'<>]+?\.(?:png|jpe?g|webp|svg))/i
  );
  if (imageMatch) {
    return imageMatch[1];
  }
  return trimmed.split('?')[0];
}

/**
 * Extract entity id and icon URL from patch note entity header markup.
 */
export function extractEntityIdFromHtml(
  href: string,
  headerId: string,
  category: EntityCategory
): EntityIdExtraction {
  const ddragon = extractDdragonFromHref(href);
  if (ddragon?.id) {
    return ddragon;
  }

  const imageUrl = normalizeImageUrl(href);

  const championPageMatch = href.match(CHAMPION_PAGE_RE);
  if (championPageMatch) {
    const id = championSlugToId(championPageMatch[1]);
    return id ? { id, imageUrl } : { imageUrl };
  }

  const patchSlug = patchHeaderIdToSlug(headerId);
  if (!patchSlug) {
    return imageUrl ? { imageUrl } : {};
  }

  if (category === 'champion') {
    const id = championSlugToId(patchSlug);
    return id ? { id, imageUrl } : { imageUrl };
  }

  if (category === 'rune') {
    const runeKey = patchSlugToRuneKey(patchSlug);
    // Numeric id resolved later from game data; frontend uses local rune images
    return runeKey ? { id: runeKey } : {};
  }

  if (category === 'item') {
    // Numeric id resolved later from game data using the English patch slug.
    return { imageUrl };
  }

  return imageUrl ? { imageUrl } : {};
}

export interface GameDataIndexes {
  championIds: Set<string>;
  championSlugToId: Map<string, string>;
  itemNameToId: Map<string, string>;
  itemPatchSlugToId: Map<string, string>;
  runeKeyToId: Map<string, string>;
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGameDataIndexes(
  champions: Array<{ id: string; name?: string }>,
  items: Record<string, { name?: string }>,
  runesReforged: Array<{ slots: Array<{ runes: Array<{ id: number; key: string; name?: string }> }> }>
): GameDataIndexes {
  const championIds = new Set<string>();
  const championSlugToId = new Map<string, string>();

  for (const champion of champions) {
    championIds.add(champion.id);
    championSlugToId.set(champion.id.toLowerCase(), champion.id);
    if (champion.name) {
      championSlugToId.set(normalizeLookupKey(champion.name), champion.id);
    }
  }

  const itemNameToId = new Map<string, string>();
  const itemPatchSlugToId = new Map<string, string>();

  for (const [itemId, item] of Object.entries(items)) {
    if (!item?.name) continue;
    const normalizedName = normalizeLookupKey(item.name);
    itemNameToId.set(normalizedName, itemId);

    const patchSlug = item.name.replace(/\s+/g, '-');
    itemPatchSlugToId.set(patchSlug.toLowerCase(), itemId);
    itemPatchSlugToId.set(normalizeLookupKey(patchSlug), itemId);
  }

  const runeKeyToId = new Map<string, string>();
  for (const path of runesReforged) {
    for (const slot of path.slots ?? []) {
      for (const rune of slot.runes ?? []) {
        runeKeyToId.set(rune.key, String(rune.id));
        if (rune.name) {
          runeKeyToId.set(normalizeLookupKey(rune.name), String(rune.id));
        }
      }
    }
  }

  return {
    championIds,
    championSlugToId,
    itemNameToId,
    itemPatchSlugToId,
    runeKeyToId,
  };
}

/**
 * Fill missing entity ids using local game data indexes.
 */
export function enrichEntityIds(
  entities: EntityChanges[],
  indexes: GameDataIndexes,
  headerIdsByName?: Map<string, string>
): EntityChanges[] {
  return entities.map((entity) => {
    if (entity.category === 'system') {
      return entity;
    }

    const headerId = headerIdsByName?.get(entity.name);
    const patchSlug =
      entity.patchSlug ??
      (headerId ? patchHeaderIdToSlug(headerId) : undefined);

    if (entity.category === 'champion') {
      if (entity.id && indexes.championIds.has(entity.id)) {
        return entity;
      }

      const slug = patchSlug?.toLowerCase();
      const resolved =
        (slug && indexes.championSlugToId.get(slug)) ||
        (slug ? championSlugToId(slug) : undefined);

      if (resolved) {
        return { ...entity, id: resolved };
      }
      return entity;
    }

    if (entity.category === 'aram' || entity.category === 'aram-chaos' || entity.category === 'arena') {
      if (entity.id && indexes.championIds.has(entity.id)) {
        return entity;
      }

      const fromName = indexes.championSlugToId.get(normalizeLookupKey(entity.name));
      if (fromName) {
        return { ...entity, id: fromName };
      }
      return entity;
    }

    if (entity.category === 'item') {
      if (entity.id) {
        return entity;
      }

      // Check direct slug overrides first (for apostrophe issues like Zeke's, Knight's)
      if (patchSlug && ITEM_SLUG_OVERRIDES[patchSlug.toLowerCase()]) {
        return { ...entity, id: ITEM_SLUG_OVERRIDES[patchSlug.toLowerCase()] };
      }

      if (patchSlug) {
        const fromSlug =
          indexes.itemPatchSlugToId.get(patchSlug.toLowerCase()) ||
          indexes.itemPatchSlugToId.get(normalizeLookupKey(patchSlugToEnglishName(patchSlug)));
        if (fromSlug) {
          return { ...entity, id: fromSlug };
        }
      }
      return entity;
    }

    if (entity.category === 'rune') {
      const runeKey =
        entity.id && !/^\d+$/.test(entity.id)
          ? entity.id
          : patchSlug
            ? patchSlugToRuneKey(patchSlug)
            : undefined;

      if (runeKey) {
        const numericId = indexes.runeKeyToId.get(runeKey);
        if (numericId) {
          return { ...entity, id: numericId };
        }
        return { ...entity, id: runeKey };
      }
    }

    return entity;
  });
}
