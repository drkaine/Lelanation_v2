import { getQuery, setHeader } from 'h3'
import { renderOgImage } from '../utils/renderOgImage'

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const title = String(query.title ?? 'Lelanation').trim() || 'Lelanation'
  const subtitle = String(query.subtitle ?? '').trim() || undefined

  const png = await renderOgImage({ title, subtitle })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=604800')
  return png
})
