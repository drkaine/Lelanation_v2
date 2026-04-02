import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { createError, getQuery, getRequestURL, setHeader, type H3Event } from 'h3'
import { screenshotBuildCardPng } from '../../utils/screenshotBuildCard'
import { useRuntimeConfig } from '#imports'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function apiBuildJsonUrl(event: H3Event): string {
  const cfg = useRuntimeConfig(event)
  const fromEnv = (process.env.NUXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '')
  const fromCfg = (cfg.public.apiBase as string | undefined)?.trim().replace(/\/$/, '') || ''
  const base = fromEnv || fromCfg
  if (base) return base
  const site =
    (cfg.public.siteUrl as string | undefined)?.trim().replace(/\/$/, '') || 'http://127.0.0.1:3000'
  return site
}

async function fetchBuildForCacheRevision(
  event: H3Event,
  buildId: string
): Promise<{ cacheRev: string; subBuildsLen: number } | null> {
  const root = apiBuildJsonUrl(event)
  const url = `${root}/api/builds/${encodeURIComponent(buildId)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      updatedAt?: string
      savedAt?: string
      id?: string
      subBuilds?: unknown[]
    }
    const rev = String(json.updatedAt || json.savedAt || json.id || buildId)
    const subBuildsLen = Array.isArray(json.subBuilds) ? json.subBuilds.length : 0
    return { cacheRev: rev, subBuildsLen }
  } catch {
    return null
  }
}

/** Incrémenter après changement de rendu capture (splash, flèches, etc.) pour invalider le cache disque. */
const SCREENSHOT_CACHE_SALT = 'v6'

function cacheFileName(
  buildId: string,
  sub: number | null,
  meta: boolean,
  locale: string,
  splash: boolean,
  rev: string
): string {
  const h = createHash('sha256')
  h.update(
    `${SCREENSHOT_CACHE_SALT}|${buildId}|${sub ?? ''}|${meta ? 1 : 0}|${locale}|${splash ? 1 : 0}|${rev}`
  )
  return `${h.digest('hex').slice(0, 40)}.png`
}

export default defineEventHandler(async event => {
  const q = getQuery(event)
  const id = typeof q.id === 'string' ? q.id.trim() : ''
  if (!id || !UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid build id' })
  }

  const locale = q.locale === 'en' ? 'en' : 'fr'
  const meta = q.meta === '1' || q.meta === 'true' || q.meta === true
  const splash = q.splash === '1' || q.splash === 'true' || q.splash === true

  let sub: number | null = null
  if (q.sub !== undefined && q.sub !== null && String(q.sub).trim() !== '') {
    const n = Number.parseInt(String(q.sub), 10)
    if (!Number.isFinite(n) || n < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sub index' })
    }
    sub = n
  }

  const metaBuild = await fetchBuildForCacheRevision(event, id)
  if (!metaBuild) {
    throw createError({ statusCode: 404, statusMessage: 'Build not found' })
  }
  if (sub !== null && sub >= metaBuild.subBuildsLen) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid sub index' })
  }

  const cacheDir = join(tmpdir(), 'lelanation-card-screenshots')
  await mkdir(cacheDir, { recursive: true })
  const cacheName = cacheFileName(id, sub, meta, locale, splash, metaBuild.cacheRev)
  const cachePath = join(cacheDir, cacheName)

  try {
    const cached = await readFile(cachePath)
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    return cached
  } catch {
    // miss
  }

  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const renderPath = locale === 'fr' ? '/render/build-card' : '/en/render/build-card'
  const params = new URLSearchParams()
  params.set('id', id)
  params.set('locale', locale)
  if (meta) params.set('meta', '1')
  if (sub !== null) params.set('sub', String(sub))
  params.set('splash', splash ? '1' : '0')
  const pageUrl = `${origin}${renderPath}?${params.toString()}`

  let png: Buffer
  try {
    png = await screenshotBuildCardPng({ pageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[build-card-image] Playwright failed:', msg)
    throw createError({
      statusCode: 503,
      statusMessage: 'Screenshot failed (install Chromium: npx playwright install chromium)',
    })
  }

  await writeFile(cachePath, png).catch(() => undefined)

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return png
})
