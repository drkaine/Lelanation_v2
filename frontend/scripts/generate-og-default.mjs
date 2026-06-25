#!/usr/bin/env node
/**
 * Generate public/og/default.png (1200×630) for social previews fallback.
 * Run: node scripts/generate-og-default.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'og')
const outPath = join(outDir, 'default.png')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('generate-og-default: sharp not installed, skip.')
  process.exit(0)
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08101f"/>
      <stop offset="100%" stop-color="#0f1f3d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="56" y="56" width="1088" height="518" rx="24" fill="#0c1628" stroke="#c9a227" stroke-width="2" opacity="0.9"/>
  <text x="96" y="300" fill="#c9a227" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">Lelanation</text>
  <text x="96" y="380" fill="#d6e4ff" font-family="Arial, Helvetica, sans-serif" font-size="36">Builds, stats &amp; tier list League of Legends</text>
  <text x="96" y="500" fill="#8fa8d8" font-family="Arial, Helvetica, sans-serif" font-size="28">www.lelanation.fr</text>
</svg>`

const png = await sharp(Buffer.from(svg)).png().toBuffer()
mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes)`)
