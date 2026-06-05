import { Router } from 'express'
import { PatchNotesService } from '../services/PatchNotesService.js'
import { BuildCheckerService } from '../services/BuildCheckerService.js'
import type { BuildCheckInput } from '../types/patchNotes.js'

const router = Router()
const patchNotesService = new PatchNotesService()
const buildCheckerService = new BuildCheckerService(patchNotesService)

router.get('/', async (_req, res) => {
  const index = await patchNotesService.getIndex()
  if (!index) {
    return res.status(404).json({ error: 'Patch notes index not found' })
  }
  return res.json(index)
})

router.get('/:version', async (req, res) => {
  const version = String(req.params.version)
  const patch = await patchNotesService.getPatch(version)
  if (!patch) {
    return res.status(404).json({ error: `Patch ${version} not found` })
  }
  return res.json(patch)
})

router.post('/check-build', async (req, res) => {
  const body = req.body as BuildCheckInput
  if (!body?.patch_created) {
    return res.status(400).json({ error: 'patch_created is required' })
  }

  try {
    const result = await buildCheckerService.checkBuild(body)
    return res.json(result)
  } catch (error) {
    console.error('[PatchNotes] check-build error:', error)
    return res.status(500).json({ error: 'Failed to check build' })
  }
})

export default router
