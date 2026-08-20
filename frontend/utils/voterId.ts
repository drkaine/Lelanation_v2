const VOTER_ID_KEY = 'lelanation_voter_id'

export function getOrCreateVoterId(): string {
  if (import.meta.server) return ''
  try {
    const existing = localStorage.getItem(VOTER_ID_KEY)?.trim()
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(VOTER_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function voterRequestHeaders(): HeadersInit {
  const voterId = getOrCreateVoterId()
  return voterId ? { 'X-Voter-Id': voterId } : {}
}
