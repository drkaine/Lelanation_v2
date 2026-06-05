/**
 * File utilities for writing patch JSON files
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';
import type { PatchJson } from '../scraper/types.js';

/**
 * Write patch data to JSON file
 */
export async function writePatchJson(
  dir: string,
  filename: string,
  data: PatchJson
): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);

  logger.info({ filePath, patchVersion: data.patchVersion, locale: data.locale }, 'Writing patch JSON');

  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    'utf-8'
  );

  logger.info({ filePath }, 'Patch JSON written successfully');
}

/**
 * Write patch summary infographic to disk
 */
export async function writePatchImage(
  dir: string,
  filename: string,
  data: Buffer
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);

  logger.info({ filePath, size: data.length }, 'Writing patch summary image');

  await fs.writeFile(filePath, data);

  logger.info({ filePath }, 'Patch summary image written successfully');
  return filePath;
}

/**
 * Read existing patch JSON file
 */
export async function readPatchJson(filePath: string): Promise<PatchJson | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as PatchJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * List all patch files in a directory
 */
export async function listPatchFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Check if a patch file already exists
 */
export async function patchFileExists(
  dir: string,
  patchVersion: string,
  locale: string
): Promise<boolean> {
  const filename = `patch-${patchVersion}-${locale}.json`;
  const filePath = path.join(dir, filename);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
