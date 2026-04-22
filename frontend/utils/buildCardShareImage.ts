import type { Build } from '~/types/build'
import { descriptionTextForMetaShare, resolveDisplayedBuild } from '~/utils/buildDisplayVariant'

/** URL relative (same-origin) vers la capture PNG serveur (Playwright). */
export function buildCardShareImageUrl(
  buildId: string,
  localeCode: string,
  options?: { sub?: number | null; meta?: boolean; splash?: boolean }
): string {
  const params = new URLSearchParams()
  params.set('id', buildId)
  params.set('locale', localeCode === 'en' ? 'en' : 'fr')
  if (typeof options?.splash === 'boolean') {
    params.set('splash', options.splash ? '1' : '0')
  }
  if (options?.sub != null && Number.isFinite(options.sub) && options.sub >= 0) {
    params.set('sub', String(options.sub))
  }
  if (options?.meta) {
    params.set('meta', '1')
  }
  return `/internal/build-card-image?${params.toString()}`
}

export async function fetchBuildCardSharePng(urlPath: string): Promise<Blob | null> {
  try {
    const res = await fetch(urlPath)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

/**
 * Enregistre une copie éphémère du build (privé, non listé), capture PNG serveur, puis supprime le fichier.
 * Pour les builds privés jamais sync ou indisponibles sur l’API.
 */
export async function fetchBuildCardSharePngEphemeral(
  build: Build,
  localeCode: string,
  options?: { sub?: number | null; meta?: boolean; splash?: boolean }
): Promise<Blob | null> {
  const tempId = crypto.randomUUID()
  const body = { ...build, id: tempId, visibility: 'private' as const }
  try {
    const postRes = await fetch('/api/builds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!postRes.ok) return null
    const urlPath = buildCardShareImageUrl(tempId, localeCode, options)
    return await fetchBuildCardSharePng(urlPath)
  } finally {
    await fetch(`/api/builds/${encodeURIComponent(tempId)}`, { method: 'DELETE' }).catch(() => {})
  }
}

/** GET capture d’abord ; si échec (build privé local, pas sur le serveur, etc.), upload éphémère puis capture. */
export async function fetchBuildCardSharePngResilient(
  build: Build,
  localeCode: string,
  options?: { sub?: number | null; meta?: boolean; splash?: boolean }
): Promise<Blob | null> {
  const urlPath = buildCardShareImageUrl(build.id, localeCode, options)
  const direct = await fetchBuildCardSharePng(urlPath)
  if (direct) return direct
  return fetchBuildCardSharePngEphemeral(build, localeCode, options)
}

export type CaptureBuildCardDomOptions = {
  /** Bloc auteur + description (comme la route serveur meta). */
  withMeta?: boolean
  build?: Build
  locale?: 'fr' | 'en'
  subIndex?: number | null
}

/**
 * Capture le conteneur BuildCard depuis le DOM (builds privés ou API indisponible).
 * Déplace brièvement le nœud dans un conteneur hors écran pour inclure le fond #0d0d18.
 */
export async function captureBuildCardHostToPngBlob(
  cardHost: HTMLElement,
  options?: CaptureBuildCardDomOptions
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  const withMeta = Boolean(options?.withMeta && options?.build)
  const locale = options?.locale ?? 'fr'
  const sub = options?.subIndex ?? null

  let toBlob: typeof import('html-to-image').toBlob
  try {
    ;({ toBlob } = await import('html-to-image'))
  } catch {
    return null
  }

  const shell = document.createElement('div')
  shell.style.cssText =
    'position:fixed;left:-9999px;top:0;z-index:-1;background:#0d0d18;padding:16px;box-sizing:border-box;'

  const root = document.createElement('div')
  root.style.display = 'inline-block'
  root.style.verticalAlign = 'top'

  const parent = cardHost.parentElement
  if (!parent) return null
  const next = cardHost.nextSibling

  root.appendChild(cardHost)

  if (withMeta && options?.build) {
    const b = options.build
    const displayed = resolveDisplayedBuild(b, sub)
    const desc = descriptionTextForMetaShare(b, displayed)
    const authorRaw = (b.author || '').trim()
    const author = authorRaw || (locale === 'en' ? 'Anonymous' : 'Anonyme')

    const meta = document.createElement('div')
    meta.style.cssText =
      'max-width:420px;margin-top:14px;color:#e7e6e3;font-family:system-ui,sans-serif;'
    const authorEl = document.createElement('div')
    authorEl.style.cssText = 'font-weight:700;font-size:15px;line-height:1.35;'
    authorEl.textContent = `${locale === 'en' ? 'By' : 'Par'} ${author}`
    meta.appendChild(authorEl)
    if (desc) {
      const descEl = document.createElement('div')
      descEl.style.cssText =
        'margin-top:8px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word;color:#c8c4bf;'
      descEl.textContent = desc
      meta.appendChild(descEl)
    }
    root.appendChild(meta)
  }

  shell.appendChild(root)
  document.body.appendChild(shell)

  try {
    return await toBlob(shell, {
      pixelRatio: 2,
      cacheBust: true,
    })
  } catch {
    return null
  } finally {
    if (next) parent.insertBefore(cardHost, next)
    else parent.appendChild(cardHost)
    document.body.removeChild(shell)
  }
}

/** Playwright d’abord ; si échec, capture DOM (ex. build privé jamais sync). */
export async function fetchBuildCardSharePngOrDom(
  urlPath: string,
  cardHost: HTMLElement | null | undefined,
  domOptions?: CaptureBuildCardDomOptions
): Promise<Blob | null> {
  const server = await fetchBuildCardSharePng(urlPath)
  if (server) return server
  if (!cardHost) return null
  return captureBuildCardHostToPngBlob(cardHost, domOptions)
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
