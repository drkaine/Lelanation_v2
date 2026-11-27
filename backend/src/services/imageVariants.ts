/**
 * Variantes WebP des images du jeu, générées une fois à la synchro (pas de conversion à la requête).
 * `Aatrox.png` → `Aatrox.png.webp` à côté : nginx sert la variante quand le navigateur accepte WebP.
 * PNG → WebP sans perte (pixels identiques, fichier plus léger) ; JPG (splash) → WebP qualité 90.
 */
import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

const SOURCE_EXT = /\.(png|jpe?g)$/i
const JPEG_QUALITY = 90

export interface VariantReport {
  created: number
  skipped: number
  failed: number
}

export function isVariantSource(file: string): boolean {
  return SOURCE_EXT.test(file)
}

export function webpVariantPath(file: string): string {
  return `${file}.webp`
}

async function mtimeOf(file: string): Promise<number | null> {
  try {
    return (await fs.stat(file)).mtimeMs
  } catch {
    return null
  }
}

async function encode(src: string, out: string): Promise<void> {
  const lossless = /\.png$/i.test(src)
  const tmp = `${out}.tmp`
  await sharp(src)
    .webp(lossless ? { lossless: true, effort: 4 } : { quality: JPEG_QUALITY, effort: 4 })
    .toFile(tmp)
  await fs.rename(tmp, out)
}

async function listSources(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listSources(path)))
    else if (entry.isFile() && isVariantSource(entry.name)) out.push(path)
  }
  return out
}

/** Crée ou met à jour la variante WebP de chaque PNG/JPG du dossier (récursif). */
export async function generateWebpVariants(dir: string): Promise<VariantReport> {
  const report: VariantReport = { created: 0, skipped: 0, failed: 0 }
  for (const src of await listSources(dir)) {
    const out = webpVariantPath(src)
    const [srcMtime, outMtime] = await Promise.all([mtimeOf(src), mtimeOf(out)])
    if (srcMtime !== null && outMtime !== null && outMtime >= srcMtime) {
      report.skipped++
      continue
    }
    try {
      await encode(src, out)
      report.created++
    } catch {
      await fs.rm(`${out}.tmp`, { force: true })
      report.failed++
    }
  }
  return report
}
