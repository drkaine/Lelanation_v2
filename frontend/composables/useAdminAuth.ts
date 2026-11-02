/**
 * Admin auth: credentials kept in sessionStorage after login (cleared when the tab closes,
 * so a long-lived password-equivalent never sits in localStorage where any XSS could read it).
 * API calls to /api/admin/* must send Authorization: Basic <base64>.
 */

import { onMounted } from 'vue'
import { adminAuthHeader } from '~/utils/teamAccess'
import { USER_SESSION_KEY } from '~/utils/userSession'
import { readStoredSession } from '~/composables/useUserSession'

const ADMIN_AUTH_KEY = 'adminAuth'

function getStoredToken(): string | null {
  if (!import.meta.client) return null
  try {
    // Older versions persisted the token in localStorage: drop it.
    localStorage.removeItem(ADMIN_AUTH_KEY)
    return sessionStorage.getItem(ADMIN_AUTH_KEY)
  } catch {
    return null
  }
}

/** btoa() only handles Latin-1: encode as UTF-8 first (the backend decodes Basic auth as UTF-8). */
export function toBasicToken(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

/** Accès admin : jeton Basic historique ou session Bearer d'un compte admin. */
export function hasAdminAccess(): boolean {
  return adminAuthHeader(readStoredSession(), getStoredToken()) !== null
}

export function useAdminAuth() {
  const isLoggedIn = useState<boolean>('adminLoggedIn', () => false)
  const initialized = useState<boolean>('admin-auth-initialized', () => false)

  // IMPORTANT: do not read localStorage before hydration, or SSR/CSR can diverge.
  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      isLoggedIn.value = hasAdminAccess()
    })
  }

  function getAuthHeader(): { Authorization: string } | null {
    if (!import.meta.client) return null
    return adminAuthHeader(readStoredSession(), getStoredToken())
  }

  function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
    const header = getAuthHeader()
    const opts: RequestInit = {
      ...init,
      headers: { ...init?.headers, ...(header ?? {}) },
    }
    return fetch(url, opts)
  }

  function setAuth(username: string, password: string) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, toBasicToken(username, password))
    isLoggedIn.value = true
  }

  function clearAuth() {
    localStorage.removeItem(ADMIN_AUTH_KEY)
    sessionStorage.removeItem(ADMIN_AUTH_KEY)
    localStorage.removeItem(USER_SESSION_KEY)
    useState('userSession').value = null
    isLoggedIn.value = false
  }

  function checkLoggedIn(): boolean {
    if (import.meta.client) {
      isLoggedIn.value = hasAdminAccess()
    }
    return isLoggedIn.value
  }

  return { getAuthHeader, fetchWithAuth, setAuth, clearAuth, checkLoggedIn, isLoggedIn }
}
