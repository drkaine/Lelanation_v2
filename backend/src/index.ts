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
import { setupDataDragonSync } from './cron/dataDragonSync.js'
import { setupYouTubeSync } from './cron/youtubeSync.js'
import { setupCommunityDragonSync } from './cron/communityDragonSync.js'
import { setupMaterializedViewStaggeredRefresh } from './cron/materializedViewRefresh.js'
// import { runStatsPrecomputedRefreshOnce } from './cron/statsPrecomputedRefresh.js'
import { MetricsService } from './services/MetricsService.js'
// import { getOverviewDetailStats } from './services/StatsOverviewService.js'
// import { scheduleStatsPrewarm } from './services/StatsPrewarmService.js'
import { startDefaultScript, requestStop, isAnyScriptRunning } from './worker/scriptOrchestrator.js'
import { ensureMaterializedViewsPopulated } from './services/MaterializedViewService.js'

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
app.use('/api/builds', buildsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/images', imageRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/app', appRoutes)
app.use('/api/share-builds', shareBuildsRoutes)

// Initialize cron jobs
try {
  setupDataDragonSync()
  setupYouTubeSync()
  setupCommunityDragonSync()
  setupMaterializedViewStaggeredRefresh()
} catch (error) {
  console.error('[Server] ❌ Failed to initialize cron jobs:', error)
  // Don't exit - server can still run without cron
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
// PM2 (and Docker) sends SIGTERM before killing the process.
// We stop the poller loop and wait for it to finish its current operation.
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
  // Après migrate (WITH NO DATA), les VM sont illisibles (55000) jusqu’au premier REFRESH.
  void ensureMaterializedViewsPopulated().catch((e) =>
    console.warn('[Server] ensureMaterializedViewsPopulated:', e instanceof Error ? e.message : e)
  )
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
  // Poller Riot (ingestion) — lance le script `poller` après RIOT_POLLER_STARTUP_DELAY_MS (défaut 2 min).
  // Quand POLLER_EXTERNAL=1 (ecosystem.config.js), le poller tourne dans son propre process PM2 (lelanation-poller).
  if (!process.env.POLLER_EXTERNAL) {
    startDefaultScript()
  } else {
    console.log('[Server] POLLER_EXTERNAL=1 — poller runs in separate PM2 process (lelanation-poller)')
  }
})

export default app
