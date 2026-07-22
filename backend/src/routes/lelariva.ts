import { Router, type Request, type Response } from 'express'
import {
  addReviewColumn,
  cycleFieldReview,
  readFieldRegistry,
  reviewLabel,
} from '../services/RiotApiFieldRegistryService.js'

const router = Router()

router.get('/field-registry', async (_req: Request, res: Response) => {
  try {
    const registry = await readFieldRegistry()
    return res.json(registry)
  } catch (err) {
    console.error('[lelariva] read field-registry failed', err)
    return res.status(500).json({ error: 'Failed to read field registry' })
  }
})

router.patch('/field-registry/review', async (req: Request, res: Response) => {
  const rowId = String(req.body?.rowId ?? '').trim()
  const column = String(req.body?.column ?? '').trim()
  if (!rowId || !column) {
    return res.status(400).json({ error: 'rowId and column are required' })
  }
  try {
    const { value } = await cycleFieldReview(rowId, column)
    return res.json({
      ok: true,
      value,
      label: reviewLabel(value),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN'
    if (msg === 'UNKNOWN_ROW') return res.status(404).json({ error: 'Row not found' })
    if (msg === 'UNKNOWN_COLUMN') return res.status(404).json({ error: 'Column not found' })
    console.error('[lelariva] patch review failed', err)
    return res.status(500).json({ error: 'Failed to update review' })
  }
})

router.post('/field-registry/columns', async (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }
  try {
    const registry = await addReviewColumn(name)
    return res.json({ ok: true, reviewColumns: registry.reviewColumns })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN'
    if (msg === 'COLUMN_EXISTS') return res.status(409).json({ error: 'Column already exists' })
    console.error('[lelariva] add column failed', err)
    return res.status(500).json({ error: 'Failed to add column' })
  }
})

export default router
