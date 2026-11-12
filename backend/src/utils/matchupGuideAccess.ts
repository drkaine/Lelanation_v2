import { resolve, sep } from 'path'

export const GUIDE_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidGuideId(value: unknown): value is string {
  return typeof value === 'string' && GUIDE_UUID_REGEX.test(value)
}

/** Resolve a guide JSON path; null unless the id is a UUID and the path stays under guidesDir. */
export function resolveGuideFilePath(guidesDir: string, guideId: unknown): string | null {
  if (!isValidGuideId(guideId)) return null
  const root = resolve(guidesDir)
  const filePath = resolve(root, `${guideId}.json`)
  return filePath.startsWith(root + sep) ? filePath : null
}
