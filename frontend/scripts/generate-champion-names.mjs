#!/usr/bin/env node
/**
 * Build champion static SEO data:
 * - public/data/champion-names.json — id (Riot key) → display name
 * - public/data/champions-lite.json — minimal index for SSR slug resolution
 * Run: node scripts/generate-champion-names.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(__dirname, '..')

function readCurrentVersion() {
  const versionPath = join(frontendRoot, 'public/data/game/version.json')
  try {
    const data = JSON.parse(readFileSync(versionPath, 'utf-8'))
    return data.currentVersion || '16.13.1'
  } catch {
    return '16.13.1'
  }
}

const version = readCurrentVersion()
const championsDir = join(frontendRoot, `public/data/game/${version}/fr_FR/champions`)
const namesPath = join(frontendRoot, 'public/data/champion-names.json')
const litePath = join(frontendRoot, 'public/data/champions-lite.json')

const names = {}
const champions = []

for (const file of readdirSync(championsDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue
  try {
    const raw = JSON.parse(readFileSync(join(championsDir, file), 'utf-8'))
    const champ = raw.champion ?? raw
    const key = champ.key ?? champ.id
    const name = champ.name
    const id = String(champ.id ?? file.replace(/\.json$/i, ''))
    if (key == null || !name) continue
    names[String(key)] = String(name)
    champions.push({
      id,
      key: Number(key),
      name: String(name),
    })
  } catch {
    // skip invalid file
  }
}

champions.sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(namesPath, `${JSON.stringify(names)}\n`)
writeFileSync(
  litePath,
  `${JSON.stringify({ schemaVersion: 1, dataVersion: version, champions }, null, 0)}\n`
)
console.log(
  `Wrote ${namesPath} + ${litePath} (${champions.length} champions, patch ${version})`
)
