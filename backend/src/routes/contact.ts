import { Router, Request, Response } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { DiscordService } from '../services/DiscordService.js'
import { createRateLimit } from '../utils/httpRateLimit.js'

const contactRateLimit = createRateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'contact' })

const router = Router()
const contactFilePath = join(process.cwd(), 'data', 'contact.json')
const discord = new DiscordService()

const VALID_TYPES = ['suggestion', 'bug', 'reclamation', 'autre'] as const
type ContactType = (typeof VALID_TYPES)[number]

interface ContactEntry {
  name: string
  message: string
  date: string
  contact?: string
}

type ContactData = Record<ContactType, ContactEntry[]>

let contactQueue: Promise<unknown> = Promise.resolve()
function withContactLock<T>(task: () => Promise<T>): Promise<T> {
  const run = contactQueue.then(task, task)
  contactQueue = run.catch(() => undefined)
  return run
}

function emptyContactData(): ContactData {
  return {
    suggestion: [],
    bug: [],
    reclamation: [],
    autre: []
  }
}

router.post('/', contactRateLimit, async (req: Request, res: Response) => {
  const body =
    req.body != null && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body
      : {}
  const { type, name, message, contact } = body as {
    type?: string
    name?: string
    message?: string
    contact?: string
  }

  if (!type || !VALID_TYPES.includes(type as ContactType)) {
    return res.status(400).json({
      error: 'Invalid type',
      allowed: VALID_TYPES
    })
  }
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const trimmedMessage = typeof message === 'string' ? message.trim() : ''
  if (!trimmedName || !trimmedMessage) {
    return res.status(400).json({ error: 'Name and message are required' })
  }

  const entry: ContactEntry = {
    name: trimmedName.substring(0, 256),
    message: trimmedMessage.substring(0, 5000),
    date: new Date().toISOString(),
    contact: typeof contact === 'string' ? contact.trim().substring(0, 256) : undefined
  }

  // Read-modify-write on a single JSON file: serialize so concurrent submissions
  // cannot overwrite each other's entry.
  const saved = await withContactLock(async () => {
    const data: ContactData = emptyContactData()
    const readResult = await FileManager.readJson<ContactData>(contactFilePath)
    if (readResult.isOk()) {
      const existing = readResult.unwrap()
      for (const key of VALID_TYPES) {
        if (Array.isArray(existing[key])) {
          data[key] = existing[key]
        }
      }
    }

    data[type as ContactType].push(entry)
    return FileManager.writeJson(contactFilePath, data)
  })
  if (saved.isErr()) {
    return res.status(500).json({ error: 'Failed to save contact' })
  }

  await discord.sendContactNotification(type, entry.name, entry.message, entry.contact)

  return res.status(201).json({ ok: true })
})

export default router
