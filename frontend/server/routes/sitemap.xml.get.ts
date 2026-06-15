/** Les crawlers cherchent souvent /sitemap.xml ; le module Nuxt expose /sitemap_index.xml. */
export default defineEventHandler(event => sendRedirect(event, '/sitemap_index.xml', 301))
