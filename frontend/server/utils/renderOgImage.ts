import sharp from 'sharp'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function renderOgImage(options: {
  title: string
  subtitle?: string
}): Promise<Buffer> {
  const title = escapeXml(options.title.slice(0, 80))
  const subtitle = escapeXml((options.subtitle ?? 'Lelanation — Builds & Stats LoL').slice(0, 120))
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
  <text x="96" y="280" fill="#c9a227" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700">${title}</text>
  <text x="96" y="360" fill="#d6e4ff" font-family="Arial, Helvetica, sans-serif" font-size="34">${subtitle}</text>
  <text x="96" y="500" fill="#8fa8d8" font-family="Arial, Helvetica, sans-serif" font-size="28">www.lelanation.fr</text>
</svg>`

  return await sharp(Buffer.from(svg)).png().toBuffer()
}
