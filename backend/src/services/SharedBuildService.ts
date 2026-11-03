import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { generateEditSecret, isValidBuildUuid, stripEditSecret, verifyEditSecret } from '../utils/buildEditAuth.js'
import type { PublicUser } from './users/UserAuthService.js'
import { canManageSharedBuilds } from './users/userRoles.js'

/**
 * Shared workspace: builds every logged-in role can create / edit.
 * Stored apart from public builds (`{sharedDir}/{uuid}.json`) so they never reach the public index.
 * A public team build also has a copy in `{buildsDir}/{uuid}.json`; the team copy stays until deleted.
 */
export interface SharedBuildDirs {
  sharedDir: string
  buildsDir: string
  /** Public matchup guides (`{guidesDir}/{guideId}.json`); the guide of a team build is published there. */
  guidesDir?: string
}

export interface SharedMeta {
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export type SharedBuild = Record<string, unknown> & { id: string; sharedMeta: SharedMeta }

function sharedPath(dirs: SharedBuildDirs, id: string): string {
  return join(dirs.sharedDir, `${id}.json`)
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  const res = await FileManager.readJson<Record<string, unknown>>(path)
  return res.isOk() ? res.unwrap() : null
}

function isSharedBuild(value: Record<string, unknown> | null): value is SharedBuild {
  return !!value && typeof value.id === 'string' && typeof value.sharedMeta === 'object' && value.sharedMeta !== null
}

export async function getSharedBuild(dirs: SharedBuildDirs, id: string): Promise<SharedBuild | null> {
  if (!isValidBuildUuid(id)) return null
  const data = await readJson(sharedPath(dirs, id))
  return isSharedBuild(data) ? data : null
}

export async function listSharedBuilds(dirs: SharedBuildDirs): Promise<SharedBuild[]> {
  let files: string[]
  try {
    files = await fs.readdir(dirs.sharedDir)
  } catch {
    return []
  }
  const ids = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  const builds = await Promise.all(ids.map(id => getSharedBuild(dirs, id)))
  return builds
    .filter((b): b is SharedBuild => b !== null)
    .sort((a, b) => b.sharedMeta.updatedAt.localeCompare(a.sharedMeta.updatedAt))
}

/** Public or private copy of the same id (the build is being moved into the shared space). */
async function findOwnBuild(dirs: SharedBuildDirs, id: string) {
  for (const suffix of ['', '_priv']) {
    const path = join(dirs.buildsDir, `${id}${suffix}.json`)
    const data = await readJson(path)
    if (data) return { path, data }
  }
  return null
}

function publicPath(dirs: SharedBuildDirs, id: string): string {
  return join(dirs.buildsDir, `${id}.json`)
}

const SAFE_GUIDE_ID = /^[A-Za-z0-9-]{1,80}$/

/** Guide linked to the team build (saved with it from the builder); `null` if absent or malformed. */
function linkedGuide(value: unknown): (Record<string, unknown> & { id: string }) | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const guide = value as Record<string, unknown>
  return typeof guide.id === 'string' && SAFE_GUIDE_ID.test(guide.id)
    ? (guide as Record<string, unknown> & { id: string })
    : null
}

function guidePath(dirs: SharedBuildDirs, guideId: string): string | null {
  return dirs.guidesDir ? join(dirs.guidesDir, `${guideId}.json`) : null
}

/** Publishes the linked guide, referencing the public build copy (no embedded snapshot). */
async function writePublicGuide(dirs: SharedBuildDirs, shared: SharedBuild, now: Date): Promise<void> {
  const guide = linkedGuide(shared.matchupGuide)
  const path = guide && guidePath(dirs, guide.id)
  if (!guide || !path) return
  const { build: _snapshot, patchStale: _stale, ...rest } = guide
  const dir = await FileManager.ensureDir(dirs.guidesDir!)
  if (dir.isErr()) throw dir.unwrapErr()
  const written = await FileManager.writeJson(path, {
    ...rest,
    buildId: shared.id,
    visibility: 'public',
    fileName: `${guide.id}.json`,
    savedAt: now.toISOString(),
  })
  if (written.isErr()) throw written.unwrapErr()
}

async function removePublicGuide(dirs: SharedBuildDirs, shared: SharedBuild | null): Promise<void> {
  const guide = linkedGuide(shared?.matchupGuide)
  const path = guide && guidePath(dirs, guide.id)
  if (path) await fs.unlink(path).catch(() => undefined)
}

/** Writes (or rewrites) the public copy, keeping the edit secret already in place. */
async function writePublicCopy(
  dirs: SharedBuildDirs,
  shared: SharedBuild,
  now: Date
): Promise<string> {
  const { sharedMeta: _meta, teamShared: _team, matchupGuide: _guide, ...build } = shared
  const existing = await readJson(publicPath(dirs, shared.id))
  const previous = typeof existing?.editSecret === 'string' ? existing.editSecret : ''
  const editSecret = previous || generateEditSecret()
  const fileName = `${shared.id}.json`
  const dir = await FileManager.ensureDir(dirs.buildsDir)
  if (dir.isErr()) throw dir.unwrapErr()
  const written = await FileManager.writeJson(publicPath(dirs, shared.id), {
    ...build,
    id: shared.id,
    visibility: 'public',
    lelarivaBadge: true,
    fileName,
    savedAt: now.toISOString(),
    editSecret,
  })
  if (written.isErr()) throw written.unwrapErr()
  await writePublicGuide(dirs, shared, now)
  return editSecret
}

async function writeShared(dirs: SharedBuildDirs, record: SharedBuild): Promise<void> {
  const dir = await FileManager.ensureDir(dirs.sharedDir)
  if (dir.isErr()) throw dir.unwrapErr()
  const written = await FileManager.writeJson(sharedPath(dirs, record.id), record)
  if (written.isErr()) throw written.unwrapErr()
}

/**
 * A team build is always private unless a manager (admin / lelariva) makes it public.
 * Other roles keep the visibility already set on the team copy.
 */
function teamVisibility(
  requested: unknown,
  previous: SharedBuild | null,
  actor: PublicUser
): 'public' | 'private' {
  if (canManageSharedBuilds(actor.role)) return requested === 'public' ? 'public' : 'private'
  return previous?.visibility === 'public' ? 'public' : 'private'
}

export async function saveSharedBuild(
  dirs: SharedBuildDirs,
  build: Record<string, unknown>,
  actor: PublicUser,
  now: Date = new Date(),
  editSecret?: string
): Promise<
  { ok: true; id: string; editSecret?: string } | { ok: false; error: 'INVALID_ID' | 'FORBIDDEN' }
> {
  const id = typeof build.id === 'string' && build.id.trim() ? build.id.trim() : randomUUID()
  if (!isValidBuildUuid(id)) return { ok: false, error: 'INVALID_ID' }

  const previous = await getSharedBuild(dirs, id)
  const own = previous ? null : await findOwnBuild(dirs, id)
  if (own && !verifyEditSecret(own.data, editSecret).ok) return { ok: false, error: 'FORBIDDEN' }

  const at = now.toISOString()
  const visibility = teamVisibility(build.visibility, previous, actor)
  const { patchStale: _stale, fileName: _file, matchupGuide: rawGuide, ...rest } = stripEditSecret(build)
  const guide = linkedGuide(rawGuide)
  const record: SharedBuild = {
    ...rest,
    ...(guide ? { matchupGuide: guide } : {}),
    id,
    visibility,
    teamShared: true,
    sharedMeta: {
      createdBy: previous?.sharedMeta.createdBy ?? actor.username,
      createdAt: previous?.sharedMeta.createdAt ?? at,
      updatedBy: actor.username,
      updatedAt: at,
    },
  }
  await writeShared(dirs, record)

  if (own && own.path !== publicPath(dirs, id)) await fs.unlink(own.path).catch(() => undefined)
  if (visibility === 'public') {
    return { ok: true, id, editSecret: await writePublicCopy(dirs, record, now) }
  }
  await fs.unlink(publicPath(dirs, id)).catch(() => undefined)
  await removePublicGuide(dirs, record)
  return { ok: true, id }
}

/** Removes the team copy and its public copy, if any. */
export async function deleteSharedBuild(dirs: SharedBuildDirs, id: string): Promise<boolean> {
  const shared = await getSharedBuild(dirs, id)
  if (!shared) return false
  await fs.unlink(sharedPath(dirs, id))
  await fs.unlink(publicPath(dirs, id)).catch(() => undefined)
  await removePublicGuide(dirs, shared)
  return true
}

/** Publishes the team build; the team copy stays. The edit secret is kept across publishes. */
export async function publishSharedBuild(
  dirs: SharedBuildDirs,
  id: string,
  now: Date = new Date()
): Promise<{ id: string; editSecret: string } | null> {
  const shared = await getSharedBuild(dirs, id)
  if (!shared) return null
  const record: SharedBuild = { ...shared, visibility: 'public', teamShared: true }
  await writeShared(dirs, record)
  return { id, editSecret: await writePublicCopy(dirs, record, now) }
}

/** Back to private: the team copy stays, the public copy is removed. */
export async function unpublishSharedBuild(dirs: SharedBuildDirs, id: string): Promise<boolean> {
  const shared = await getSharedBuild(dirs, id)
  if (!shared) return false
  await writeShared(dirs, { ...shared, visibility: 'private', teamShared: true })
  await fs.unlink(publicPath(dirs, id)).catch(() => undefined)
  await removePublicGuide(dirs, shared)
  return true
}
