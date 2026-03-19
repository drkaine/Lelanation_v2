/**
 * Sanitizes HTML for build descriptions (WYSIWYG output).
 * Allowlist: b, strong, i, em, u, a, br, p.
 * - <a>: only href (http/https), force target="_blank" rel="noopener noreferrer"
 * - Converts inline syntax "mot[url]" in text into links (url must be https?://)
 * Prevents XSS and injection.
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'br', 'p'])
const VOID_TAGS = new Set(['br'])

const SAFE_URL_PREFIX = /^(https?:)?\/\//i
/** Text then [url] → link; URL must be http(s). */
const LINK_SYNTAX = /(.+?)\[(https?:\/\/[^\]]+)\]/g

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Convert text containing "mot[url]" into escaped text + safe <a> tags. */
function textWithLinksToHtml(text: string): string {
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  LINK_SYNTAX.lastIndex = 0
  while ((match = LINK_SYNTAX.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index))
    const linkText = match[1] ?? ''
    const url = match[2] ?? ''
    if (linkText && url && SAFE_URL_PREFIX.test(url) && !/^\s*javascript:/i.test(url)) {
      result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    } else {
      result += escapeHtml(match[0])
    }
    lastIndex = LINK_SYNTAX.lastIndex
  }
  result += escapeHtml(text.slice(lastIndex))
  return result
}

/** SSR-safe: escape entire string (no rich text on first paint). */
function escapeAll(html: string): string {
  return escapeHtml(html).replace(/\n/g, '<br>')
}

/** Use DOM to sanitize with allowlist (client only; caller checks document for SSR). */
function sanitizeWithDom(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const out: string[] = []

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      out.push(textWithLinksToHtml(text))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tag)) {
      Array.from(node.childNodes).forEach(visit)
      return
    }

    let open = `<${tag}`
    if (tag === 'a') {
      const href = (el.getAttribute('href') || '').trim()
      if (SAFE_URL_PREFIX.test(href) && !/^\s*javascript:/i.test(href)) {
        open += ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
      }
    }
    open += '>'
    out.push(open)

    if (!VOID_TAGS.has(tag)) {
      Array.from(node.childNodes).forEach(visit)
      out.push(`</${tag}>`)
    }
  }

  const div = doc.body.firstElementChild
  if (div) Array.from(div.childNodes).forEach(visit)
  return out.join('')
}

/**
 * Sanitize HTML for description display and storage.
 * On client uses DOM allowlist; on SSR escapes everything (safe).
 */
export function sanitizeDescriptionHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  if (typeof document === 'undefined') return escapeAll(html)
  return sanitizeWithDom(html)
}
