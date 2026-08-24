import { randomBytes, timingSafeEqual } from 'crypto'
import { resolve, sep } from 'path'
import { buildsDir } from '../services/BuildIndexService.js'

export const BUILD_EDIT_SECRET_HEADER = 'x-build-edit-secret'

export const BUILD_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidBuildUuid(value: string): boolean {
  return BUILD_UUID_REGEX.test(value.trim())
}

export function generateEditSecret(): string {
  return randomBytes(32).toString('hex')
}

export function readBuildEditSecret(build: Record<string, unknown> | null): string | null {
  if (!build) return null
  const raw = build.editSecret
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function stripEditSecret<T extends Record<string, unknown>>(build: T): Omit<T, 'editSecret'> {
  const { editSecret: _omit, ...rest } = build
  return rest
}

function buildsRoot(): string {
  return resolve(buildsDir)
}

/** Resolve a build JSON path and ensure it stays under buildsDir. */
export function resolveBuildFilePath(buildId: string, isPrivate: boolean): string | null {
  if (!isValidBuildUuid(buildId)) return null
  const fileName = `${buildId}${isPrivate ? '_priv' : ''}.json`
  const filePath = resolve(buildsDir, fileName)
  const root = buildsRoot()
  if (filePath !== root && !filePath.startsWith(root + sep)) return null
  return filePath
}

export function verifyEditSecret(
  existing: Record<string, unknown> | null,
  providedHeader: string | undefined
): { ok: true; editSecret: string } | { ok: false; status: number; error: string } {
  const existingSecret = readBuildEditSecret(existing)
  const provided = typeof providedHeader === 'string' ? providedHeader.trim() : ''

  if (!existing) {
    return { ok: true, editSecret: generateEditSecret() }
  }

  if (!existingSecret) {
    // Legacy builds without a secret: allow one unauthenticated mutation, then lock.
    return { ok: true, editSecret: generateEditSecret() }
  }

  if (!provided || !secretsEqual(provided, existingSecret)) {
    return { ok: false, status: 403, error: 'Edit secret required or invalid' }
  }

  return { ok: true, editSecret: existingSecret }
}

function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
