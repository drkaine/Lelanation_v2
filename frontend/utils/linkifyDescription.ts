/**
 * Converts plain text description to HTML with clickable links.
 * Escapes HTML to prevent XSS, converts URLs to <a> tags.
 */
export function linkifyDescription(text: string): string {
  if (!text || typeof text !== 'string') return ''

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')

  return escaped.replace(/(https?:\/\/[^\s<>"']+)/g, match => {
    const url = match.replace(/[.,;:!?)]+$/, '')
    const trailing = match.slice(url.length)
    const safeHref = url.replace(/"/g, '&quot;')
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline break-all">${url}</a>${trailing}`
  })
}
