import type { BuildNotesEntityType } from '@lelanation/shared-types'

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildNotesEntityHtml(options: {
  type: BuildNotesEntityType
  id: string
  label: string
  imageUrl?: string
}): string {
  const { type, id, label, imageUrl } = options
  const safeLabel = escapeHtmlAttr(label)
  const safeId = escapeHtmlAttr(id)
  const safeType = escapeHtmlAttr(type)
  let html = `<span class="notes-entity" contenteditable="false" data-entity-type="${safeType}" data-entity-id="${safeId}" data-entity-label="${safeLabel}">`
  if (imageUrl) {
    html += `<img class="notes-entity-icon" src="${escapeHtmlAttr(imageUrl)}" alt="${safeLabel}" />`
  } else {
    html += safeLabel
  }
  html += '</span>'
  return html
}
