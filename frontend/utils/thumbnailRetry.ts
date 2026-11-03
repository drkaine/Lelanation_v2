/** Une vignette proxifiée peut échouer (429 nginx en rafale) : on la relance avec un délai croissant. */
export const THUMBNAIL_MAX_RETRIES = 3

export function thumbnailRetryDelayMs(attempt: number): number {
  return 800 * attempt + Math.floor(Math.random() * 400)
}

/** Source à recharger pour la tentative `attempt`, ou '' quand il faut abandonner. */
export function thumbnailRetrySrc(src: string, attempt: number): string {
  if (!src || attempt > THUMBNAIL_MAX_RETRIES) return ''
  const base = src.replace(/[?&]retry=\d+$/, '')
  return `${base}${base.includes('?') ? '&' : '?'}retry=${attempt}`
}
