/**
 * Sanitizes HTML for build notes (WYSIWYG output).
 * Allowlist: b, strong, i, em, u, ul, ol, li, br, p, span.notes-entity
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'span'])
const VOID_TAGS = new Set(['br'])
const ALLOWED_ENTITY_TYPES = new Set(['item', 'rune', 'summoner', 'spell', 'skill', 'shard'])

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAll(html: string): string {
  return escapeHtml(html).replace(/\n/g, '<br>')
}

function isSafeEntityId(value: string): boolean {
  return /^[\w.-]{1,64}$/.test(value)
}

function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed || /^\s*javascript:/i.test(trimmed)) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  if (trimmed.startsWith('/')) return true
  return false
}

function sanitizeEntitySpan(el: Element): string | null {
  const type = (el.getAttribute('data-entity-type') || '').trim()
  const id = (el.getAttribute('data-entity-id') || '').trim()
  const label = (el.getAttribute('data-entity-label') || '').trim()
  if (!ALLOWED_ENTITY_TYPES.has(type) || !isSafeEntityId(id)) return null

  const img = el.querySelector('img')
  const src = (img?.getAttribute('src') || '').trim()
  const alt = (img?.getAttribute('alt') || label || type).slice(0, 120)
  const safeSrc = src && isSafeImageSrc(src) ? escapeHtml(src) : ''

  let open = `<span class="notes-entity" contenteditable="false" data-entity-type="${escapeHtml(type)}" data-entity-id="${escapeHtml(id)}"`
  if (label) open += ` data-entity-label="${escapeHtml(label)}"`
  open += '>'
  if (safeSrc) {
    open += `<img class="notes-entity-icon" src="${safeSrc}" alt="${escapeHtml(alt)}" />`
  } else {
    open += escapeHtml(label || id)
  }
  open += '</span>'
  return open
}

function sanitizeWithDom(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const out: string[] = []

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(escapeHtml(node.textContent || ''))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (tag === 'span' && el.classList.contains('notes-entity')) {
      const entity = sanitizeEntitySpan(el)
      if (entity) out.push(entity)
      return
    }

    if (!ALLOWED_TAGS.has(tag)) {
      Array.from(node.childNodes).forEach(visit)
      return
    }

    let open = `<${tag}`
    if (tag === 'span') {
      const cls = (el.getAttribute('class') || '').trim()
      if (cls === 'notes-entity') {
        const entity = sanitizeEntitySpan(el)
        if (entity) out.push(entity)
        return
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

export function sanitizeNotesHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  if (typeof document === 'undefined') return escapeAll(html)
  return sanitizeWithDom(html)
}

/** Plain-text length for character limits (entities count as label length). */
export function notesPlainTextLength(html: string): number {
  if (!html) return 0
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '').length
  }
  const div = document.createElement('div')
  div.innerHTML = sanitizeNotesHtml(html)
  let length = 0
  div.childNodes.forEach(node => {
    length += nodeLength(node)
  })
  return length
}

function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').length
  if (node.nodeType !== Node.ELEMENT_NODE) return 0
  const el = node as HTMLElement
  if (el.classList.contains('notes-entity')) {
    const label =
      el.getAttribute('data-entity-label') || el.querySelector('img')?.getAttribute('alt') || '·'
    return label.length
  }
  let total = 0
  el.childNodes.forEach(child => {
    total += nodeLength(child)
  })
  return total
}
