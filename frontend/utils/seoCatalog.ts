/**
 * Catalogue SEO build-time : routes prerender + entrées sitemap.
 * Builds : backend/data/builds/*.json (pas *_priv.json)
 * Champions : public/data/game/{version}/fr_FR/champions/index.json
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeChampionSlug } from './championSlug'

export type SeoCatalogEntry = {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  _i18nTransform?: boolean
}

const BUILD_FILE_REGEX = /^[0-9a-f-]{36}\.json$/i

const STATIC_ROUTES: string[] = [
  // Homepage: SWR at runtime only (see nuxt.config routeRules '/') — not prerendered.
  '/builds/discover',
  '/builds/my-builds',
  '/builds/favoris',
  '/builds/create',
  '/videos',
  '/statistics',
  '/statistics/tier-list',
  '/statistics/recap',
  '/patch-notes',
  '/app',
  '/privacy',
  '/legal',
  '/lelanation-app',
]

export function resolveFrontendRoot(cwd = process.cwd()): string {
  const candidates = [
    cwd,
    join(cwd, 'frontend'),
    join(cwd, '..'),
    join(cwd, '../..'),
    join(cwd, '../frontend'),
    join(cwd, '../../frontend'),
  ]
  for (const root of candidates) {
    if (existsSync(join(root, 'nuxt.config.ts'))) return root
  }
  for (const root of candidates) {
    if (existsSync(join(root, 'public/data/game/version.json'))) return root
  }
  // Nitro bundle: `.output/server` + `.output/public`
  if (existsSync(join(cwd, '../public/data/game/version.json'))) return join(cwd, '..')
  return cwd
}

function resolvePublicRoot(frontendRoot: string): string {
  const nested = join(frontendRoot, 'public')
  if (existsSync(join(nested, 'data/game/version.json'))) return nested
  const outputPublic = join(frontendRoot, 'public')
  return outputPublic
}

function resolveBackendRoot(frontendRoot: string): string {
  const candidates = [
    join(frontendRoot, 'backend'),
    join(frontendRoot, '..', 'backend'),
    join(frontendRoot, '../backend'),
  ]
  for (const root of candidates) {
    if (existsSync(join(root, 'data/builds'))) return root
  }
  return join(frontendRoot, '..', 'backend')
}

export function readCurrentGameVersion(frontendRoot: string): string {
  const versionPath = join(resolvePublicRoot(frontendRoot), 'data/game/version.json')
  if (!existsSync(versionPath)) return '16.12.1'
  try {
    const data = JSON.parse(readFileSync(versionPath, 'utf-8')) as { currentVersion?: string }
    return data.currentVersion || '16.12.1'
  } catch {
    return '16.12.1'
  }
}

type ChampionIndexRow = {
  id?: string
  key?: number
  name?: string
  image?: { full?: string }
}

export function listChampionsFromIndex(frontendRoot: string, version: string): ChampionIndexRow[] {
  const indexPath = join(
    resolvePublicRoot(frontendRoot),
    `data/game/${version}/fr_FR/champions/index.json`
  )
  if (!existsSync(indexPath)) return []
  try {
    const data = JSON.parse(readFileSync(indexPath, 'utf-8')) as { champions?: ChampionIndexRow[] }
    return Array.isArray(data.champions) ? data.champions : []
  } catch {
    return []
  }
}

export function listPatchNoteVersions(frontendRoot: string): string[] {
  return listPatchNoteEntries(frontendRoot).map(p => p.version)
}

export function listPatchNoteEntries(
  frontendRoot: string
): Array<{ version: string; scrapedAt?: string }> {
  const indexPath = join(resolvePublicRoot(frontendRoot), 'data/patch-notes/index.json')
  if (!existsSync(indexPath)) return []
  try {
    const data = JSON.parse(readFileSync(indexPath, 'utf-8')) as {
      patches?: Array<{ version?: string; scrapedAt?: string }>
    }
    return (data.patches ?? [])
      .map(p => ({
        version: String(p.version ?? '').trim(),
        scrapedAt: p.scrapedAt,
      }))
      .filter(p => p.version)
  } catch {
    return []
  }
}

export type PublicBuildRef = { id: string; updatedAt?: string; name?: string }

export function listPublicBuilds(backendRoot: string): PublicBuildRef[] {
  const buildsDir = join(backendRoot, 'data/builds')
  if (!existsSync(buildsDir)) return []
  try {
    const files = readdirSync(buildsDir).filter(f => BUILD_FILE_REGEX.test(f))
    const out: PublicBuildRef[] = []
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(buildsDir, file), 'utf-8')) as {
          id?: string
          updatedAt?: string
          name?: string
        }
        const id = String(raw.id ?? file.replace(/\.json$/i, ''))
        out.push({ id, updatedAt: raw.updatedAt, name: raw.name })
      } catch {
        // skip invalid file
      }
    }
    return out
  } catch {
    return []
  }
}

export function collectPrerenderRoutes(cwd = process.cwd()): string[] {
  const frontendRoot = resolveFrontendRoot(cwd)
  const backendRoot = join(frontendRoot, '..', 'backend')
  const version = readCurrentGameVersion(frontendRoot)
  const champions = listChampionsFromIndex(frontendRoot, version)
  const builds = listPublicBuilds(backendRoot)
  const patchNotes = listPatchNoteEntries(frontendRoot)

  const routes = new Set<string>(STATIC_ROUTES)

  for (const patch of patchNotes) {
    routes.add(`/patch-notes/${patch.version}`)
  }

  for (const build of builds) {
    routes.add(`/builds/${build.id}`)
    routes.add(`/builds/view/${build.id}`)
  }

  for (const champ of champions) {
    const slug = String(champ.id ?? '').toLowerCase()
    if (slug) {
      routes.add(`/champion/${slug}/builds`)
      routes.add(`/champions/${slug}`)
      routes.add(`/builds/champion/${slug}`)
    }
  }

  return [...routes]
}

export function collectSitemapEntries(cwd = process.cwd()): SeoCatalogEntry[] {
  const frontendRoot = resolveFrontendRoot(cwd)
  const backendRoot = resolveBackendRoot(frontendRoot)
  const version = readCurrentGameVersion(frontendRoot)
  const champions = listChampionsFromIndex(frontendRoot, version)
  const builds = listPublicBuilds(backendRoot)
  const patchNotes = listPatchNoteEntries(frontendRoot)

  const entries: SeoCatalogEntry[] = STATIC_ROUTES.map(loc => ({
    loc,
    changefreq: loc === '/' ? 'daily' : 'weekly',
    priority: loc === '/' ? 1 : 0.7,
    _i18nTransform: true,
  }))

  for (const build of builds) {
    entries.push({
      loc: `/builds/${build.id}`,
      lastmod: build.updatedAt,
      changefreq: 'weekly',
      priority: 0.8,
      _i18nTransform: true,
    })
  }

  for (const patch of patchNotes) {
    entries.push({
      loc: `/patch-notes/${patch.version}`,
      lastmod: patch.scrapedAt,
      changefreq: 'monthly',
      priority: 0.75,
      _i18nTransform: true,
    })
  }

  for (const champ of champions) {
    const slug = String(champ.id ?? '').toLowerCase()
    if (slug) {
      entries.push({
        loc: `/champion/${slug}/builds`,
        changefreq: 'weekly',
        priority: 0.85,
        _i18nTransform: true,
      })
      entries.push({
        loc: `/champions/${slug}`,
        changefreq: 'weekly',
        priority: 0.5,
        _i18nTransform: true,
      })
      entries.push({
        loc: `/builds/champion/${slug}`,
        changefreq: 'weekly',
        priority: 0.5,
        _i18nTransform: true,
      })
      entries.push({
        loc: `/statistics/champion/${normalizeChampionSlug(slug)}`,
        changefreq: 'daily',
        priority: 0.9,
        _i18nTransform: true,
      })
    }
  }

  return entries
}
