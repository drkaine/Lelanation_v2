import { Router, Request, Response } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { DiscordService } from '../services/DiscordService.js'

const router = Router()
const contactFilePath = join(process.cwd(), 'data', 'contact.json')
const discord = new DiscordService()

const VALID_TYPES = ['suggestion', 'bug', 'reclamation', 'autre'] as const
type ContactType = (typeof VALID_TYPES)[number]

interface ContactEntry {
  name: string
  message: string
  date: string
}

type ContactData = Record<ContactType, ContactEntry[]>

function emptyContactData(): ContactData {
  return {
    suggestion: [],
    bug: [],
    reclamation: [],
    autre: []
  }
}

router.post('/', async (req: Request, res: Response) => {
  const { type, name, message } = req.body as {
    type?: string
    name?: string
    message?: string
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
    date: new Date().toISOString()
  }

  let data: ContactData = emptyContactData()
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

  const writeResult = await FileManager.writeJson(contactFilePath, data)
  if (writeResult.isErr()) {
    return res.status(500).json({ error: 'Failed to save contact' })
  }

  await discord.sendContactNotification(type, entry.name, entry.message)

  return res.status(201).json({ ok: true })
})

export default router
