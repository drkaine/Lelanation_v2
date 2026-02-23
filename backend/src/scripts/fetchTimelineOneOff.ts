/**
 * One-off: fetch Riot match timeline and write raw JSON to data/game/.
 * Uses getRiotApiKeyAsync (file or env). Deleted after run.
 */
import axios from 'axios'
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getRiotApiKeyAsync } from '../utils/riotApiKey.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const URL = 'https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_7744326358/timeline'
const OUT_PATH = join(__dirname, '..', '..', 'data', 'game', 'timeline_EUW1_7744326358.json')

async function main(): Promise<void> {
  const key = await getRiotApiKeyAsync()
  if (!key) {
    const err = { ok: false, error: 'No Riot API key (file or RIOT_API_KEY env)' }
    writeFileSync(OUT_PATH, JSON.stringify(err, null, 2))
    console.log(JSON.stringify({ written: true, ...err }))
    process.exit(1)
  }

  try {
    const res = await axios.get(URL, {
      headers: { 'X-Riot-Token': key, Accept: 'application/json' },
      timeout: 15000,
    })
    const data = res.data as Record<string, unknown>
    writeFileSync(OUT_PATH, JSON.stringify(data, null, 2))
    const keys = Object.keys(data).slice(0, 3)
    console.log(
      JSON.stringify({
        written: true,
        httpStatus: res.status,
        apiStatus: (data as { status?: { status_code?: number } }).status?.status_code ?? 'N/A',
        first3Keys: keys,
      })
    )
  } catch (e) {
    const errObj = axios.isAxiosError(e)
      ? {
          ok: false,
          httpStatus: e.response?.status,
          apiStatus: (e.response?.data as { status?: { status_code?: number } })?.status?.status_code ?? 'N/A',
          message: e.message,
          data: e.response?.data,
        }
      : { ok: false, error: String(e) }
    writeFileSync(OUT_PATH, JSON.stringify(errObj, null, 2))
    console.log(JSON.stringify({ written: true, ...errObj }))
    process.exit(1)
  }
}

main()
