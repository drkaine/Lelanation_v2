import { defineSitemapEventHandler } from '#imports'
import { collectSitemapEntries } from '~/utils/seoCatalog'

/** Sitemap runtime : builds publics, champions, patch notes (sans rebuild). */
export default defineSitemapEventHandler(() => {
  return collectSitemapEntries()
})
