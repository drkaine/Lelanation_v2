/**
 * Types for League of Legends Patch Notes Scraper
 */

export type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'removed' | 'text';
export type Locale = 'en-GB' | 'fr-FR';
export type EntityCategory = 'champion' | 'item' | 'rune' | 'system';

export interface StatChange {
  stat: string;
  before: string;
  after: string;
  type: ChangeType;
}

export interface EntityChanges {
  name: string;
  category: EntityCategory;
  /** Data Dragon id: champion "Brand", item "4005", rune "8214". */
  id?: string;
  /** Icon URL from patch notes header link (CMS or ddragon proxy). */
  imageUrl?: string;
  /** English patch header slug from h3 id (e.g. Imperial-Mandate). Locale-independent. */
  patchSlug?: string;
  subCategory?: string;
  changes: StatChange[];
}

export interface PatchSummaryImage {
  url: string;
  localPath: string;
  width?: number;
  height?: number;
}

export interface PatchJson {
  patchVersion: string;
  locale: Locale;
  scrapedAt: string;
  url: string;
  summaryImage?: PatchSummaryImage;
  entities: EntityChanges[];
}

export interface ParseContext {
  currentCategory: EntityCategory | null;
  currentEntity: string | null;
  currentSubCategory: string | null;
}
