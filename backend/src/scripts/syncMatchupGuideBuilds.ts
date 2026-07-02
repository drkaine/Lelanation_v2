/**
 * Publish embedded builds for public matchup guides into backend/data/builds/
 * Run: npm run sync:matchup-guide-builds (from backend/)
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { syncPublicBuildFromMatchupGuide } from '../services/matchupGuideBuildSync.js'

const guidesDir = join(process.cwd(), 'data', 'matchup-guides')
const GUIDE_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i

const files = await readdir(guidesDir)
const guideFiles = files.filter(file => GUIDE_FILE_REGEX.test(file))

let synced = 0
let skipped = 0

for (const file of guideFiles) {
  const raw = await readFile(join(guidesDir, file), 'utf8')
  const guide = JSON.parse(raw) as Parameters<typeof syncPublicBuildFromMatchupGuide>[0]
  const result = await syncPublicBuildFromMatchupGuide(guide)
  if (result.synced) {
    synced += 1
    console.log(`Synced build ${result.buildId} from guide ${file}`)
  } else {
    skipped += 1
    console.log(`Skipped ${file}: ${result.reason ?? 'unknown'}`)
  }
}

console.log(`Done. ${synced} build(s) synced, ${skipped} guide(s) skipped.`)
