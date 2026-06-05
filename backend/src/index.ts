import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import syncRoutes from './routes/sync.js'
import gameDataRoutes from './routes/gameData.js'
import youtubeRoutes from './routes/youtube.js'
import buildsRoutes from './routes/builds.js'
import adminRoutes from './routes/admin.js'
import imageRoutes from './routes/images.js'
import contactRoutes from './routes/contact.js'
import statsRoutes from './routes/stats.js'
import appRoutes from './routes/app.js'
import shareBuildsRoutes from './routes/shareBuilds.js'
// import patchNotesRoutes from './routes/patchNotes.js'
import { setupDataDragonSync } from './cron/dataDragonSync.js'
import { setupYouTubeSync } from './cron/youtubeSync.js'
import { setupCommunityDragonSync } from './cron/communityDragonSync.js'
import { setupSocialLinksHealthCheck } from './cron/socialLinksHealthCheck.js'
import { setupLiveAggArchiveCheckpoint } from './cron/liveAggArchiveCheckpoint.js'
// import { runStatsPrecomputedRefreshOnce } from './cron/statsPrecomputedRefresh.js'
import { MetricsService } from './services/MetricsService.js'
// import { getOverviewDetailStats } from './services/StatsOverviewService.js'
// import { scheduleStatsPrewarm } from './services/StatsPrewarmService.js'
import { requestStop, isAnyScriptRunning } from './worker/scriptOrchestrator.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(compression())
app.use(express.json({ limit: '12mb' }))

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
app.use('/api/builds', buildsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/images', imageRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/app', appRoutes)
app.use('/api/share-builds', shareBuildsRoutes)
// app.use('/api/patch-notes', patchNotesRoutes)

// Initialize cron jobs
try {
  setupDataDragonSync()
  setupYouTubeSync()
  setupCommunityDragonSync()
  setupSocialLinksHealthCheck()
  setupLiveAggArchiveCheckpoint()
} catch (error) {
  console.error('[Server] ❌ Failed to initialize cron jobs:', error)
  // Don't exit - server can still run without cron
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
// PM2 (and Docker) sends SIGTERM before killing the process.
// We stop any active admin script (e.g. puuid-migration) and wait briefly.
const SHUTDOWN_TIMEOUT_MS = 10_000

function gracefulShutdown(signal: string): void {
  console.log(`[Server] ${signal} received — stopping active script and shutting down…`)
  requestStop()

  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS
  const wait = setInterval(() => {
    if (!isAnyScriptRunning() || Date.now() >= deadline) {
      clearInterval(wait)
      if (Date.now() >= deadline) console.warn('[Server] Shutdown timeout — forcing exit')
      else console.log('[Server] Script stopped — exiting cleanly')
      process.exit(0)
    }
  }, 300)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  // Précharger le cache overview-detail (sans filtre) pour limiter les 504
  // setTimeout(() => {
  //   Promise.all([
  //     getOverviewDetailStats(null, null, false),
  //     getOverviewDetailStats(null, null, true),
  //   ]).then(
  //     ([a, b]) => console.log('[Server] Overview-detail cache warmed (includeSmite=false:', !!a, ', includeSmite=true:', !!b, ')'),
  //     (e) => console.warn('[Server] Overview-detail cache warm failed:', e)
  //   )
  // }, 15_000)
  // Préchargement étendu en arrière-plan (rankTiers, champions par rank, duration/abandons/sides) pour éviter 504 et premières requêtes lentes
  // scheduleStatsPrewarm()
  // Remplir les tables pré-calculées tout de suite (champions par rôle en premier dans le refresh)
  // runStatsPrecomputedRefreshOnce().then(
  //   (r) => r.ok && r.refreshed?.length && console.log('[Server] Precomputed stats initial fill:', r.refreshed.length, 'entries'),
  //   (e) => console.warn('[Server] Precomputed stats initial fill failed:', e instanceof Error ? e.message : e)
  // )
  console.log('[Server] Match ingestion runs in PM2 as lelanation-poller-v2 (not in this API process).')
})

export default app
