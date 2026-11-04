import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  MATCHUP_GUIDES_SHEET_TABS,
  matchupGuidesSheetUrl,
  mergeMatchupGuideTabs,
  parseMatchupGuidesSheet,
  withoutDeadMatchupGuides,
  type MatchupGuidesByChampion,
} from '~/utils/matchupGuidesSheet'

/** Écrit par le backend à chaque patch (npm run check:matchup-guide-links). */
const DEAD_LINKS_FILE =
  process.env.MATCHUP_GUIDES_DEAD_LINKS_FILE ||
  join(process.cwd(), '..', 'backend', 'data', 'matchup-guides', 'dead-links.json')

async function readDeadLinks(): Promise<string[]> {
  try {
    const file = JSON.parse(await readFile(DEAD_LINKS_FILE, 'utf8')) as { dead?: unknown }
    return Array.isArray(file.dead)
      ? file.dead.filter((u): u is string => typeof u === 'string')
      : []
  } catch {
    return []
  }
}

/** Guides matchups des 5 onglets de rôle du Google Sheet public, relus au plus une fois par heure. */
export default defineCachedEventHandler(
  async (): Promise<MatchupGuidesByChampion> => {
    const tabs = await Promise.all(
      MATCHUP_GUIDES_SHEET_TABS.map(async ({ role, gid }) => {
        try {
          const html = await $fetch<string>(matchupGuidesSheetUrl(gid), {
            responseType: 'text',
            timeout: 10_000,
          })
          return { role, data: parseMatchupGuidesSheet(html) }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[matchup-guides] onglet ${role} illisible`, error)
          return { role, data: {} }
        }
      })
    )
    return withoutDeadMatchupGuides(mergeMatchupGuideTabs(tabs), await readDeadLinks())
  },
  { name: 'matchup-guides', maxAge: 60 * 60, swr: true }
)
