import 'dotenv/config'
import './redis/ensure-ready.js'
import express from 'express'
import compression from 'compression'
import { createCorsMiddleware } from './utils/cors.js'
import { createRateLimit } from './utils/httpRateLimit.js'
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
import matchupGuidesRoutes from './routes/matchupGuides.js'
import lelarivaRoutes from './routes/lelariva.js'
// import patchNotesRoutes from './routes/patchNotes.js'
import { setupDataDragonSync } from './cron/dataDragonSync.js'
import { setupYouTubeSync } from './cron/youtubeSync.js'
import { setupCommunityDragonSync } from './cron/communityDragonSync.js'
import { setupSocialLinksHealthCheck } from './cron/socialLinksHealthCheck.js'
import { setupDiskSpaceAlert } from './cron/diskSpaceAlert.js'
import { MetricsService } from './services/MetricsService.js'
import { requestStop, isAnyScriptRunning } from './worker/scriptOrchestrator.js'

const app = express()
const PORT = process.env.PORT || 3001

// Only trust X-Forwarded-For from the reverse proxy (nginx on the same host by default),
// otherwise clients could spoof their IP and bypass rate limiting.
// Override with TRUST_PROXY (e.g. "1", "loopback", "10.0.0.0/8", or "false").
const trustProxyEnv = process.env.TRUST_PROXY?.trim()
app.set(
  'trust proxy',
  trustProxyEnv === undefined || trustProxyEnv === ''
    ? 'loopback'
    : trustProxyEnv === 'false'
      ? false
      : /^\d+$/.test(trustProxyEnv)
        ? Number(trustProxyEnv)
        : trustProxyEnv
)
app.disable('x-powered-by')

// Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  // This process only serves JSON/images: nothing should ever execute from it.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  next()
})
app.use(createCorsMiddleware())
app.use(compression())
// Routes that legitimately receive large payloads (shared build bundles, admin tools).
app.use(['/api/share-builds', '/api/admin', '/api/matchup-guides'], express.json({ limit: '12mb' }))
// Everything else is small JSON: cap it to limit memory/CPU abuse.
app.use(express.json({ limit: '1mb' }))
app.use(
  createRateLimit({
    windowMs: 60_000,
    max: 300,
    keyPrefix: 'api',
    loopbackMultiplier: 10,
  })
)

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
app.use('/api/matchup-guides', matchupGuidesRoutes)
app.use('/api/lelariva', lelarivaRoutes)
// app.use('/api/patch-notes', patchNotesRoutes)

// Unknown API routes / malformed bodies: JSON errors, never stack traces or HTML.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err)
  const status =
    typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500
  if (status >= 500) console.error('[Server] Unhandled error:', err)
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 413 ? 'Payload too large' : status < 500 ? 'Bad request' : 'Internal server error',
  })
})

// Initialize cron jobs
try {
  setupDataDragonSync()
  setupYouTubeSync()
  setupCommunityDragonSync()
  setupSocialLinksHealthCheck()
  setupDiskSpaceAlert()
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
  console.log('[Server] Match ingestion runs in PM2 as lelanation-poller-v2 (not in this API process).')
})

export default app
