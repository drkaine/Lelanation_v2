/** Vérifie les liens des guides matchups du Google Sheet. Usage : npm run check:matchup-guide-links [version] */
import { runMatchupGuideLinkCheck, MATCHUP_GUIDES_DEAD_LINKS_FILE } from '../services/MatchupGuideLinkCheckService.js'

const file = await runMatchupGuideLinkCheck(process.argv[2] ?? null)
console.log(
  `[check-matchup-guide-links] checked=${file.checked} dead=${file.dead.length} unknown=${file.unknown.length} -> ${MATCHUP_GUIDES_DEAD_LINKS_FILE}`
)
for (const url of file.dead) console.log(`  mort : ${url}`)
