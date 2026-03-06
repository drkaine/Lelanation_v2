#!/usr/bin/env node
/**
 * Generate WebP and responsive sizes for the home LCP image (Lighthouse).
 * Run: npm run generate:webp
 * Requires: npm install -D sharp
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public', 'images')
const srcPath = join(publicDir, 'lelariva.png')

if (!existsSync(srcPath)) {
  console.warn('scripts/generate-lelariva-webp.mjs: lelariva.png not found in public/images, skip.')
  process.exit(0)
}

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('scripts/generate-lelariva-webp.mjs: optional dependency "sharp" not installed. Run: npm install -D sharp')
  process.exit(0)
}

const buffer = readFileSync(srcPath)
const image = sharp(buffer)
const meta = await image.metadata()
const w = meta.width || 400
const h = meta.height || 400

// Full size WebP (same as PNG, smaller bytes)
await image
  .webp({ quality: 85, effort: 4 })
  .toFile(join(publicDir, 'lelariva.webp'))
console.log('Wrote public/images/lelariva.webp')

// Display-sized 1x (320px desktop / 240px mobile max) and 2x for retina
const sizes = [400, 800] // 400 ≈ max display, 800 for 2x
for (const size of sizes) {
  const outName = size === 400 ? 'lelariva-400.webp' : 'lelariva-800.webp'
  await sharp(buffer)
    .resize(size, size)
    .webp({ quality: 85, effort: 4 })
    .toFile(join(publicDir, outName))
  console.log(`Wrote public/images/${outName}`)
}
