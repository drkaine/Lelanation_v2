import { Router } from 'express'
import { join } from 'path'
import { buildsDir, invalidateBuildIndex } from '../services/BuildIndexService.js'
import {
  deleteSharedBuild,
  getSharedBuild,
  listSharedBuilds,
  publishSharedBuild,
  saveSharedBuild,
  unpublishSharedBuild,
  type SharedBuildDirs,
} from '../services/SharedBuildService.js'
import { canManageSharedBuilds } from '../services/users/userRoles.js'
import { BUILD_EDIT_SECRET_HEADER } from '../utils/buildEditAuth.js'
import { currentUser, requireUser } from './userAuth.js'

const router = Router()

const dirs: SharedBuildDirs = {
  sharedDir: process.env.SHARED_BUILDS_DIR?.trim() || join(process.cwd(), 'data', 'shared-builds'),
  buildsDir,
  guidesDir: join(process.cwd(), 'data', 'matchup-guides'),
}

router.use(requireUser)

router.get('/', async (_req, res) => {
  return res.json({ builds: await listSharedBuilds(dirs) })
})

router.get('/:id', async (req, res) => {
  const build = await getSharedBuild(dirs, req.params.id)
  return build ? res.json(build) : res.status(404).json({ error: 'Build not found' })
})

/** Create or update. Header X-Build-Edit-Secret moves an own public / private build into the shared space. */
router.post('/', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid build payload' })
  try {
    const result = await saveSharedBuild(
      dirs,
      req.body as Record<string, unknown>,
      currentUser(res),
      new Date(),
      req.header(BUILD_EDIT_SECRET_HEADER)
    )
    if (!result.ok) return res.status(result.error === 'FORBIDDEN' ? 403 : 400).json({ error: result.error })
    invalidateBuildIndex()
    return res.json({ id: result.id, editSecret: result.editSecret })
  } catch (err) {
    console.error('[shared-builds] save failed', err)
    return res.status(500).json({ error: 'Failed to save shared build' })
  }
})

router.post('/:id/publish', async (req, res) => {
  if (!canManageSharedBuilds(currentUser(res).role)) return res.status(403).json({ error: 'FORBIDDEN' })
  try {
    const result = await publishSharedBuild(dirs, req.params.id)
    if (!result) return res.status(404).json({ error: 'Build not found' })
    invalidateBuildIndex()
    return res.json(result)
  } catch (err) {
    console.error('[shared-builds] publish failed', err)
    return res.status(500).json({ error: 'Failed to publish build' })
  }
})

router.post('/:id/unpublish', async (req, res) => {
  if (!canManageSharedBuilds(currentUser(res).role)) return res.status(403).json({ error: 'FORBIDDEN' })
  const ok = await unpublishSharedBuild(dirs, req.params.id)
  if (!ok) return res.status(404).json({ error: 'Build not found' })
  invalidateBuildIndex()
  return res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  if (!canManageSharedBuilds(currentUser(res).role)) return res.status(403).json({ error: 'FORBIDDEN' })
  const ok = await deleteSharedBuild(dirs, req.params.id)
  if (ok) invalidateBuildIndex()
  return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Build not found' })
})

export default router
