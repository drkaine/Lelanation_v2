export type CaptureElementToPngOptions = {
  pixelRatio?: number
  backgroundColor?: string
}

/** Capture un nœud DOM en PNG (client uniquement). */
export async function captureElementToPngBlob(
  element: HTMLElement,
  options?: CaptureElementToPngOptions
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  let toBlob: typeof import('html-to-image').toBlob
  try {
    ;({ toBlob } = await import('html-to-image'))
  } catch {
    return null
  }

  try {
    return await toBlob(element, {
      pixelRatio: options?.pixelRatio ?? 2,
      cacheBust: true,
      backgroundColor: options?.backgroundColor ?? '#0d1117',
    })
  } catch {
    return null
  }
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
