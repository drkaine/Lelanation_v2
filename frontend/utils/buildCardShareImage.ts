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

export async function copyPngBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
