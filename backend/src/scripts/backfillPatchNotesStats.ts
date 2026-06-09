#!/usr/bin/env node
/**
 * Backfill patch_notes_stats from existing patch-notes JSON (frontend public dir).
 * Manual run only — not invoked by cron or scrape pipeline.
 *
 * Usage:
 *   tsx src/scripts/backfillPatchNotesStats.ts
 *   tsx src/scripts/backfillPatchNotesStats.ts --version 16.11
 *   tsx src/scripts/backfillPatchNotesStats.ts --dry-run
 */

import 'dotenv/config'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { PatchJson } from '../scraper/types.js'
import { buildPatchNotesStats } from '../services/patchNotesStatsBuilder.js'
import { upsertPatchNotesStatsRows } from '../services/PatchNotesStatsService.js'
import { isDatabaseConfigured } from '../db/query.js'

function getFrontendPatchNotesDir(): string {
  const fromEnv = process.env.PATCH_FRONTEND_DIR?.trim()
  if (fromEnv) return fromEnv
  return join(process.cwd(), '..', 'frontend', 'public', 'data', 'patch-notes')
}

function parseArgs(argv: string[]): { dryRun: boolean; versions: string[] } {
  const dryRun = argv.includes('--dry-run')
  const versions: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version' && argv[i + 1]) {
      versions.push(argv[i + 1]!)
      i++
    }
  }
  return { dryRun, versions }
}

async function listPatchVersions(rootDir: string): Promise<string[]> {
  const indexPath = join(rootDir, 'index.json')
  try {
    const raw = await fs.readFile(indexPath, 'utf-8')
    const index = JSON.parse(raw) as { patches?: Array<{ version?: string }> }
    const fromIndex = (index.patches ?? [])
      .map(p => String(p.version ?? '').trim())
      .filter(Boolean)
    if (fromIndex.length) return fromIndex
  } catch {
    // fall through to directory scan
  }

  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory() && /^\d+\.\d+$/.test(e.name))
    .map(e => e.name)
    .sort((a, b) => {
      const [aM, aN] = a.split('.').map(Number)
      const [bM, bN] = b.split('.').map(Number)
      return aM !== bM ? aM - bM : aN - bN
    })
}

async function loadEnPatchJson(rootDir: string, version: string): Promise<PatchJson | null> {
  const filePath = join(rootDir, version, `patch-${version}-en-GB.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as PatchJson
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const { dryRun, versions: filterVersions } = parseArgs(process.argv.slice(2))
  const rootDir = getFrontendPatchNotesDir()

  if (!dryRun && !isDatabaseConfigured()) {
    console.error('✗ DATABASE_URL is required for backfill (use --dry-run to preview)')
    process.exit(1)
  }

  let versions = await listPatchVersions(rootDir)
  if (filterVersions.length) {
    const wanted = new Set(filterVersions)
    versions = versions.filter(v => wanted.has(v))
  }

  if (!versions.length) {
    console.error(`✗ No patch versions found under ${rootDir}`)
    process.exit(1)
  }

  console.log(`Patch notes dir: ${rootDir}`)
  console.log(`Versions: ${versions.join(', ')}`)
  if (dryRun) console.log('Mode: dry-run (no DB writes)')

  let totalRows = 0
  let totalWritten = 0
  let skipped = 0

  for (const version of versions) {
    const patch = await loadEnPatchJson(rootDir, version)
    if (!patch) {
      console.warn(`  ⚠ ${version}: patch-${version}-en-GB.json missing — skipped`)
      skipped++
      continue
    }

    const rows = buildPatchNotesStats(patch)
    totalRows += rows.length

    if (dryRun) {
      const nerfs = rows.reduce((s, r) => s + r.countNerf, 0)
      const ups = rows.reduce((s, r) => s + r.countUp, 0)
      const ajusts = rows.reduce((s, r) => s + r.countAjust, 0)
      console.log(
        `  ${version}: ${rows.length} entities — nerf:${nerfs} up:${ups} ajust:${ajusts}`
      )
      continue
    }

    const written = await upsertPatchNotesStatsRows(rows)
    totalWritten += written
    console.log(`  ✓ ${version}: ${written} rows upserted`)
  }

  if (dryRun) {
    console.log(`\nDry-run total: ${totalRows} entity rows across ${versions.length - skipped} patches`)
  } else {
    console.log(`\n✓ Done: ${totalWritten} rows upserted (${skipped} versions skipped)`)
  }
}

main().catch(error => {
  console.error('✗ Backfill failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
