import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import syncRoutes from './routes/sync.js'
import gameDataRoutes from './routes/gameData.js'
import youtubeRoutes from './routes/youtube.js'
import sharedBuildsRoutes from './routes/sharedBuilds.js'
import buildsRoutes from './routes/builds.js'
import adminRoutes from './routes/admin.js'
import imageRoutes from './routes/images.js'
import { setupDataDragonSync } from './cron/dataDragonSync.js'
import { setupYouTubeSync } from './cron/youtubeSync.js'
import { setupCommunityDragonSync } from './cron/communityDragonSync.js'
import { MetricsService } from './services/MetricsService.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(compression())
app.use(express.json())

// Request metrics (very lightweight)
const metrics = MetricsService.getInstance()
app.use((_req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    metrics.recordRequest(Date.now() - start, res.statusCode)
  })
  next()
})

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/sync', syncRoutes)
app.use('/api/game-data', gameDataRoutes)
app.use('/api/youtube', youtubeRoutes)
app.use('/api/shared-builds', sharedBuildsRoutes)
app.use('/api/builds', buildsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/images', imageRoutes)

// Initialize cron jobs
console.log('[Server] Initializing cron jobs...')
try {
  setupDataDragonSync()
  setupYouTubeSync()
  setupCommunityDragonSync()
  console.log('[Server] ✅ All cron jobs initialized successfully')
} catch (error) {
  console.error('[Server] ❌ Failed to initialize cron jobs:', error)
  // Don't exit - server can still run without cron
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Cron jobs initialized`)
  console.log(`Current time: ${new Date().toISOString()}`)
  console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
})

export default app
