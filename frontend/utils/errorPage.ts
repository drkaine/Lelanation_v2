export type ErrorPageKind = 'notFound' | 'forbidden' | 'server' | 'unavailable' | 'generic'

export interface ErrorPageInfo {
  kind: ErrorPageKind
  /** Code affiché en grand ('' si inconnu). */
  code: string
  titleKey: string
  messageKey: string
  /** Une nouvelle tentative a du sens (erreur serveur transitoire). */
  canRetry: boolean
}

function kindFor(status: number | undefined): ErrorPageKind {
  if (status === 404 || status === 410) return 'notFound'
  if (status === 401 || status === 403) return 'forbidden'
  if (status === 502 || status === 503 || status === 504) return 'unavailable'
  if (status !== undefined && status >= 500 && status < 600) return 'server'
  return 'generic'
}

export function resolveErrorPage(status: number | undefined): ErrorPageInfo {
  const kind = kindFor(status)
  return {
    kind,
    code: status ? String(status) : '',
    titleKey: `errorPage.${kind}.title`,
    messageKey: `errorPage.${kind}.message`,
    canRetry: kind === 'server' || kind === 'unavailable' || kind === 'generic',
  }
}
