/** Retire data-src sur __NUXT_DATA__ quand le payload SSR est déjà inline (évite 500 client "26"). */
function stripRedundantNuxtPayloadDataSrc(chunks: unknown[]): void {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (typeof chunk !== 'string') continue
    chunks[i] = chunk.replace(
      /(<script\b[^>]*\bid="__NUXT_DATA__"[^>]*)(>)([\s\S]*?)(<\/script>)/g,
      (full, start, close, content, end) => {
        if (content.trim().length < 64) return full
        const cleanStart = start.replace(/\sdata-src="[^"]*"/g, '')
        return `${cleanStart}${close}${content}${end}`
      }
    )
  }
}

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', html => {
    stripRedundantNuxtPayloadDataSrc(html.head)
    stripRedundantNuxtPayloadDataSrc(html.body)
    stripRedundantNuxtPayloadDataSrc(html.bodyAppend)
  })
})
