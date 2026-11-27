/**
 * Images du jeu : variante WebP (`x.png.webp`, générée à la synchro) servie si le navigateur l'accepte,
 * et version de patch dans l'URL (`?v=16.1.1`) pour un cache navigateur immuable.
 */
const VARIANT_SOURCE = /\.(png|jpe?g)$/i
const PATCH = /^\d+\.\d+(\.\d+)?$/

export function acceptsWebp(accept: string | undefined): boolean {
  return typeof accept === 'string' && accept.includes('image/webp')
}

/** Fichiers à essayer, dans l'ordre. */
export function imageCandidates(path: string, accept: string | undefined): string[] {
  return VARIANT_SOURCE.test(path) && acceptsWebp(accept) ? [`${path}.webp`, path] : [path]
}

export function withImageVersion(url: string, version: string): string {
  if (!url || !PATCH.test(version)) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`
}

export function imageCacheControl(versioned: boolean): string {
  return versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=604800'
}
