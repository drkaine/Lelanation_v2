import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { fetchBinary } from './fetcher.js';
import { buildPatchNotesPublicPath } from '../utils/fileWriter.js';
import { logger } from '../utils/logger.js';
import type { EntityChanges, Locale, StatChange } from './types.js';
import { extractPatchImageSrc } from './entityIds.js';
import { extractPatchCdnVersion } from './patchEntityImages.js';

type SpellSlot = 'passive' | 'Q' | 'W' | 'E' | 'R';

type ChampionSpellData = {
  passive?: { name?: string; image?: { full?: string } };
  spells?: Array<{ name?: string; slot?: string; image?: { full?: string } }>;
};

const PATCH_KEY_TO_SLOT: Record<string, SpellSlot> = {
  A: 'Q',
  Q: 'Q',
  Z: 'W',
  W: 'W',
  E: 'E',
  R: 'R',
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
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

export function parseSpellSubCategory(
  subCategory?: string | null
): { slot: SpellSlot; name: string } | null {
  const raw = subCategory?.trim();
  if (!raw) return null;
  if (/^stats de base$/i.test(raw) || /^base stats$/i.test(raw)) return null;

  if (/^compétence passive\s*[-–—]/i.test(raw) || /^passif\s*[-–—]/i.test(raw)) {
    const name = raw.replace(/^compétence passive\s*[-–—]\s*/i, '').replace(/^passif\s*[-–—]\s*/i, '').trim();
    return { slot: 'passive', name };
  }

  if (/^passive ability\s*[-–—]/i.test(raw) || /^passive\s*[-–—]/i.test(raw)) {
    const name = raw.replace(/^passive ability\s*[-–—]\s*/i, '').replace(/^passive\s*[-–—]\s*/i, '').trim();
    return { slot: 'passive', name };
  }

  const match = raw.match(/^([A-Z]|Passive)\s*[-–—]\s*(.+)$/i);
  if (!match) return null;

  const slot = PATCH_KEY_TO_SLOT[match[1].toUpperCase()];
  if (!slot) return null;

  return { slot, name: match[2].trim() };
}

function isSpellCacheableEntity(entity: EntityChanges): boolean {
  if (entity.category === 'champion' || entity.category === 'classic') {
    return Boolean(entity.id?.trim());
  }
  return false;
}

async function readChampionSpellData(
  championId: string,
  langDir: string
): Promise<ChampionSpellData | null> {
  const filePath = join(langDir, 'champions', `${championId.toLowerCase()}.json`);
  if (!existsSync(filePath)) return null;

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { champion?: ChampionSpellData };
    return parsed.champion ?? null;
  } catch {
    return null;
  }
}

export function resolveSpellImageFile(
  champion: ChampionSpellData,
  parsed: { slot: SpellSlot; name: string }
): string | null {
  const key = normalizeLookupKey(parsed.name);

  if (parsed.slot === 'passive') {
    const passiveName = champion.passive?.name?.trim();
    if (passiveName && normalizeLookupKey(passiveName) === key) {
      return champion.passive?.image?.full ?? null;
    }
    return champion.passive?.image?.full ?? null;
  }

  const spells = champion.spells ?? [];
  const byName = spells.find(spell => normalizeLookupKey(spell.name ?? '') === key);
  if (byName?.image?.full) return byName.image.full;

  const bySlot = spells.find(spell => String(spell.slot ?? '').toUpperCase() === parsed.slot);
  return bySlot?.image?.full ?? null;
}

export function buildSpellRemoteImageUrl(
  cdnVersion: string,
  parsed: { slot: SpellSlot; name: string },
  imageFile: string
): string {
  if (parsed.slot === 'passive') {
    return `https://ddragon.leagueoflegends.com/cdn/${cdnVersion}/img/passive/${imageFile}`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/${cdnVersion}/img/spell/${imageFile}`;
}

function extensionFromUrl(url: string): string {
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpg';
  return 'png';
}

function buildSpellCacheKey(championId: string, subCategory: string, remoteUrl: string): string {
  const hash = createHash('sha1').update(remoteUrl).digest('hex').slice(0, 10);
  return `spell-${slugify(championId)}-${slugify(subCategory)}-${hash}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveRemoteSpellImageUrl(
  change: StatChange,
  champion: ChampionSpellData | null,
  cdnVersion: string | null
): string | undefined {
  const fromMarkup = extractPatchImageSrc(change.iconUrl);
  if (fromMarkup) return fromMarkup;

  const parsed = parseSpellSubCategory(change.subCategory);
  if (!parsed || !champion || !cdnVersion) return undefined;

  const imageFile = resolveSpellImageFile(champion, parsed);
  if (!imageFile) return undefined;

  return buildSpellRemoteImageUrl(cdnVersion, parsed, imageFile);
}

async function cacheRemoteImage(
  remoteUrl: string,
  cacheKey: string,
  patchVersion: string,
  entitiesDir: string
): Promise<string | null> {
  const ext = extensionFromUrl(remoteUrl);
  const filename = `${cacheKey}.${ext}`;
  const filePath = join(entitiesDir, filename);
  const publicPath = `/${buildPatchNotesPublicPath(patchVersion, `entities/${filename}`)}`;

  if (!(await fileExists(filePath))) {
    try {
      const buffer = await fetchBinary(remoteUrl);
      await mkdir(entitiesDir, { recursive: true });
      await writeFile(filePath, buffer);
    } catch (error) {
      logger.warn({ remoteUrl, cacheKey, error }, 'Failed to cache patch spell image');
      return remoteUrl;
    }
  }

  return publicPath;
}

/**
 * Download champion spell/passive icons referenced in patch changes.
 * Classic mode spells are usually plain text headings without inline <img>.
 */
export async function cacheSpellImages(
  entities: EntityChanges[],
  html: string,
  patchVersion: string,
  versionDir: string,
  langDir: string | null
): Promise<EntityChanges[]> {
  const cdnVersion = extractPatchCdnVersion(html);
  const entitiesDir = join(versionDir, 'entities');
  const championCache = new Map<string, ChampionSpellData | null>();

  async function getChampion(championId: string): Promise<ChampionSpellData | null> {
    if (!langDir) return null;
    if (championCache.has(championId)) {
      return championCache.get(championId) ?? null;
    }
    const data = await readChampionSpellData(championId, langDir);
    championCache.set(championId, data);
    return data;
  }

  const results: EntityChanges[] = [];

  for (const entity of entities) {
    if (!isSpellCacheableEntity(entity) || entity.changes.length === 0) {
      results.push(entity);
      continue;
    }

    const championId = entity.id!.trim();
    const champion = await getChampion(championId);
    const nextChanges: StatChange[] = [];

    for (const change of entity.changes) {
      if (change.iconUrl?.startsWith('/data/patch-notes/')) {
        nextChanges.push(change);
        continue;
      }

      const parsed = parseSpellSubCategory(change.subCategory);
      if (!parsed) {
        nextChanges.push(change);
        continue;
      }

      const remoteUrl = resolveRemoteSpellImageUrl(change, champion, cdnVersion);
      if (!remoteUrl) {
        nextChanges.push(change);
        continue;
      }

      const cacheKey = buildSpellCacheKey(championId, change.subCategory ?? parsed.name, remoteUrl);
      const localPath = await cacheRemoteImage(remoteUrl, cacheKey, patchVersion, entitiesDir);
      nextChanges.push(localPath ? { ...change, iconUrl: localPath } : change);
    }

    results.push({ ...entity, changes: nextChanges });
  }

  return results;
}

export function localeToGameLang(locale: Locale): string {
  return locale === 'fr-FR' ? 'fr_FR' : 'en_US';
}
