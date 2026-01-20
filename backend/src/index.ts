import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import syncRoutes from './routes/sync.js'
import gameDataRoutes from './routes/gameData.js'
import youtubeRoutes from './routes/youtube.js'
import { setupDataDragonSync } from './cron/dataDragonSync.js'
import { setupYouTubeSync } from './cron/youtubeSync.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(compression())
app.use(express.json())

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/sync', syncRoutes)
app.use('/api/game-data', gameDataRoutes)
app.use('/api/youtube', youtubeRoutes)

// Initialize cron jobs
setupDataDragonSync()
setupYouTubeSync()

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Cron jobs initialized`)
})

export default app
