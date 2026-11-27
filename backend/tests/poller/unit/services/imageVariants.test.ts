import { mkdtempSync, mkdirSync, statSync, utimesSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  generatePatchNotesVariants,
  generateWebpVariants,
  isVariantSource,
  webpVariantPath,
} from '../../../../src/services/imageVariants.js'

async function png(file: string): Promise<void> {
  const buf = await sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 200, g: 10, b: 10, alpha: 0.5 } },
  })
    .png()
    .toBuffer()
  writeFileSync(file, buf)
}

describe('imageVariants', () => {
  it('chemin de la variante : même nom + .webp', () => {
    expect(webpVariantPath('/a/Aatrox.png')).toBe('/a/Aatrox.png.webp')
    expect(webpVariantPath('/a/splash_Ahri.jpg')).toBe('/a/splash_Ahri.jpg.webp')
  })

  it('sources : png/jpg/jpeg seulement', () => {
    expect(isVariantSource('x.png')).toBe(true)
    expect(isVariantSource('x.JPG')).toBe(true)
    expect(isVariantSource('x.jpeg')).toBe(true)
    expect(isVariantSource('x.png.webp')).toBe(false)
    expect(isVariantSource('x.gif')).toBe(false)
  })

  it('crée les variantes récursivement, garde la taille et la transparence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'variants-'))
    mkdirSync(join(dir, 'champion'))
    await png(join(dir, 'champion', 'Aatrox.png'))
    writeFileSync(join(dir, 'notes.txt'), 'x')

    expect(await generateWebpVariants(dir)).toEqual({ created: 1, skipped: 0, failed: 0 })
    const out = join(dir, 'champion', 'Aatrox.png.webp')
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(8)
    expect(meta.hasAlpha).toBe(true)
    expect(existsSync(join(dir, 'notes.txt.webp'))).toBe(false)
  })

  it('ne régénère pas une variante à jour, régénère si la source est plus récente', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'variants-'))
    const src = join(dir, 'item.png')
    await png(src)
    await generateWebpVariants(dir)
    expect(await generateWebpVariants(dir)).toEqual({ created: 0, skipped: 1, failed: 0 })

    const future = new Date(statSync(src).mtimeMs + 60_000)
    utimesSync(src, future, future)
    expect(await generateWebpVariants(dir)).toEqual({ created: 1, skipped: 0, failed: 0 })
  })

  it('fichier illisible : compté en échec, sans interrompre', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'variants-'))
    writeFileSync(join(dir, 'broken.png'), 'pas une image')
    await png(join(dir, 'ok.png'))
    expect(await generateWebpVariants(dir)).toEqual({ created: 1, skipped: 0, failed: 1 })
  })

  it('dossier absent : rien à faire', async () => {
    expect(await generateWebpVariants('/nonexistent/variants')).toEqual({
      created: 0,
      skipped: 0,
      failed: 0,
    })
  })
})

describe('imageVariants — captures patch notes', () => {
  it('PNG en WebP avec perte (q90) : bien plus léger que le sans-perte', async () => {
    const width = 64
    const raw = Buffer.alloc(width * width * 3)
    let seed = 42
    for (let i = 0; i < raw.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      raw[i] = (Math.floor(i / 3) % width) * 3 + (seed % 40)
    }
    const lossyDir = mkdtempSync(join(tmpdir(), 'pn-lossy-'))
    const losslessDir = mkdtempSync(join(tmpdir(), 'pn-lossless-'))
    for (const d of [lossyDir, losslessDir]) {
      await sharp(raw, { raw: { width, height: width, channels: 3 } })
        .png()
        .toFile(join(d, 'patch-16.23-fr-FR-summary.png'))
    }
    const report = await generatePatchNotesVariants(lossyDir)
    await generateWebpVariants(losslessDir)
    expect(report.created).toBe(1)
    const lossy = statSync(join(lossyDir, 'patch-16.23-fr-FR-summary.png.webp')).size
    const lossless = statSync(join(losslessDir, 'patch-16.23-fr-FR-summary.png.webp')).size
    expect(lossy).toBeLessThan(lossless)
  })
})
