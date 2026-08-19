import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fetchBinary } from './fetcher.js';
import { buildPatchNotesPublicPath } from '../utils/fileWriter.js';
import { logger } from '../utils/logger.js';
import type { EntityChanges } from './types.js';
import {
  extractPatchImageSrc,
  resolveStructuredModeEntityId,
  type GameDataIndexes,
} from './entityIds.js';

const D_DRAGON_VERSION_RE = /ddragon\.leagueoflegends\.com\/cdn\/([\d.]+)\//i;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function extractPatchCdnVersion(html: string): string | null {
  const match = html.match(D_DRAGON_VERSION_RE);
  return match?.[1] ?? null;
}

function extensionFromUrl(url: string): string {
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpg';
  if (clean.endsWith('.svg')) return 'svg';
  return 'png';
}

function isChampionLikeEntity(entity: EntityChanges): boolean {
  if (entity.category === 'champion') return true;
  const sub = entity.subCategory?.toLowerCase() ?? '';
  return sub.includes('champion') || sub.includes('invite') || sub.includes('honor');
}

function isItemLikeEntity(entity: EntityChanges): boolean {
  if (entity.category === 'item') return true;
  const sub = entity.subCategory?.toLowerCase() ?? '';
  return sub.includes('objet') || sub.includes('item');
}

export function resolveEntityRemoteImageUrl(
  entity: EntityChanges,
  cdnVersion: string | null,
  indexes?: GameDataIndexes
): string | undefined {
  const fromMarkup = extractPatchImageSrc(entity.imageUrl);
  if (fromMarkup) return fromMarkup;

  const id = entity.id ?? (indexes ? resolveStructuredModeEntityId(entity, indexes) : undefined);
  if (!id || !cdnVersion) return undefined;

  if (isChampionLikeEntity(entity) && !/^\d+$/.test(id)) {
    return `https://ddragon.leagueoflegends.com/cdn/${cdnVersion}/img/champion/${id}.png`;
  }

  if (isItemLikeEntity(entity) && /^\d+$/.test(id)) {
    return `https://ddragon.leagueoflegends.com/cdn/${cdnVersion}/img/item/${id}.png`;
  }

  return undefined;
}

export function buildEntityImageCacheKey(entity: EntityChanges, remoteUrl: string): string {
  const base =
    entity.id ??
    entity.patchSlug ??
    slugify(entity.name || entity.subCategory || entity.category);
  const hash = createHash('sha1').update(remoteUrl).digest('hex').slice(0, 10);
  return `${entity.category}-${slugify(base)}-${hash}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download patch entity icons once and rewrite entity.imageUrl to a local public path.
 * Skips existing files so re-scrapes stay fast.
 */
export async function cacheEntityImages(
  entities: EntityChanges[],
  html: string,
  patchVersion: string,
  versionDir: string,
  indexes?: GameDataIndexes
): Promise<EntityChanges[]> {
  const cdnVersion = extractPatchCdnVersion(html);
  const entitiesDir = path.join(versionDir, 'entities');
  await fs.mkdir(entitiesDir, { recursive: true });

  const results: EntityChanges[] = [];

  for (const entity of entities) {
    const remoteUrl = resolveEntityRemoteImageUrl(entity, cdnVersion, indexes);
    if (!remoteUrl) {
      results.push(entity);
      continue;
    }

    const cacheKey = buildEntityImageCacheKey(entity, remoteUrl);
    const ext = extensionFromUrl(remoteUrl);
    const filename = `${cacheKey}.${ext}`;
    const filePath = path.join(entitiesDir, filename);
    const publicPath = `/${buildPatchNotesPublicPath(patchVersion, `entities/${filename}`)}`;

    if (!(await fileExists(filePath))) {
      try {
        const buffer = await fetchBinary(remoteUrl);
        await fs.writeFile(filePath, buffer);
        logger.debug(
          { entity: entity.name, category: entity.category, remoteUrl, filePath },
          'Cached patch entity image'
        );
      } catch (error) {
        logger.warn(
          { entity: entity.name, category: entity.category, remoteUrl, error },
          'Failed to cache patch entity image'
        );
        results.push({ ...entity, imageUrl: remoteUrl });
        continue;
      }
    }

    results.push({ ...entity, imageUrl: publicPath });
  }

  return results;
}
