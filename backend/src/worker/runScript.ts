/**
 * CLI entry point to run Riot scripts standalone (without starting the HTTP server).
 * Usage: tsx src/worker/runScript.ts <script>
 *   script: puuid-migration | league-xp
 *
 * League XP options (env): QUEUE, TIER, DIVISION, REGION, MAX_PAGES
 * Example: TIER=PLATINUM DIVISION=II REGION=euw1 tsx src/worker/runScript.ts league-xp
 *
 * SIGINT/SIGTERM triggers graceful stop (finish current batch/page then exit).
 */
import 'dotenv/config'
import { runPuuidMigrationScript } from './puuidMigrationScript.js'
import { runLeagueXpScript, type LeagueXpOptions } from './leagueXpScript.js'
import { runDataEnrichScript } from './dataEnrichScript.js'

const VALID_SCRIPTS = ['puuid-migration', 'league-xp', 'data-enrich'] as const
type ScriptName = (typeof VALID_SCRIPTS)[number]

function parseArgs(): ScriptName | null {
  const arg = process.argv[2]
  if (arg && VALID_SCRIPTS.includes(arg as ScriptName)) return arg as ScriptName
  return null
}

function leagueXpOptionsFromEnv(): LeagueXpOptions {
  const opts: LeagueXpOptions = {}
  if (process.env.QUEUE) opts.queue = process.env.QUEUE
  if (process.env.TIER) opts.tier = process.env.TIER.toUpperCase()
  if (process.env.DIVISION) opts.division = process.env.DIVISION.toUpperCase()
  if (process.env.REGION) opts.region = process.env.REGION.toLowerCase()
  if (process.env.MAX_PAGES != null) {
    const n = parseInt(process.env.MAX_PAGES, 10)
    if (Number.isFinite(n) && n >= 1) opts.maxPages = Math.min(100, n)
  }
  return opts
}

async function main(): Promise<void> {
  const script = parseArgs()
  if (!script) {
    console.error('Usage: tsx src/worker/runScript.ts <script>')
    console.error('  script: puuid-migration | league-xp | data-enrich')
    console.error('  League XP env: QUEUE, TIER, DIVISION, REGION, MAX_PAGES')
    process.exit(1)
  }

  let shouldStop = false
  const onSignal = (): void => {
    shouldStop = true
    console.log('[runScript] Stop requested — finishing current task then exiting.')
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  const isShouldStop = (): boolean => shouldStop

  try {
    if (script === 'puuid-migration') {
      await runPuuidMigrationScript(isShouldStop, (s) => {
        if (s.phase === 'running' && s.requestCount > 0 && s.requestCount % 50 === 0) {
          console.log(`[puuid-migration] requestCount=${s.requestCount}`)
        }
      })
      console.log('[runScript] puuid-migration finished.')
    } else if (script === 'league-xp') {
      const options = leagueXpOptionsFromEnv()
      await runLeagueXpScript(options, isShouldStop, (s) => {
        if (s.phase === 'running' && s.pagesProcessed > 0) {
          console.log(
            `[league-xp] pagesProcessed=${s.pagesProcessed} playersFound=${s.playersFound} playersCreated=${s.playersCreated}`
          )
        }
      })
      console.log('[runScript] league-xp finished.')
    } else {
      await runDataEnrichScript(isShouldStop, (s) => {
        if (s.phase === 'running' && s.matchesScanned > 0 && s.matchesScanned % 20 === 0) {
          console.log(
            `[data-enrich] scanned=${s.matchesScanned} enriched=${s.matchesEnriched} missingMatches=${s.missingMatches} items=${s.rowsItems} runes=${s.rowsRunes} buckets=${s.rowsBuckets} ranks=${s.rowsRanks}`
          )
        }
      })
      console.log('[runScript] data-enrich finished.')
    }
    process.exit(0)
  } catch (err) {
    console.error('[runScript] Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

void main()
