import { collectSitemapEntries } from '~/utils/seoCatalog'
import { resolveSiteUrl } from '~/utils/siteUrl'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sitemap XML servi à `/sitemap.xml` (runtime, sans rebuild). */
export default defineEventHandler(event => {
  const config = useRuntimeConfig()
  const siteUrl = resolveSiteUrl(config.public.siteUrl as string | undefined)
  const entries = collectSitemapEntries()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(entry => {
    const loc = escapeXml(`${siteUrl}${entry.loc}`)
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
    const changefreq = entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : ''
    const priority =
      entry.priority != null ? `\n    <priority>${String(entry.priority)}</priority>` : ''
    return `  <url>\n    <loc>${loc}</loc>${lastmod}${changefreq}${priority}\n  </url>`
  })
  .join('\n')}
</urlset>`

  setHeader(event, 'Content-Type', 'application/xml; charset=UTF-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return body
})
