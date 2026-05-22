/**
 * Admin auth: credentials stored in localStorage after login (persists across tabs and refreshes).
 * API calls to /api/admin/* must send Authorization: Basic <base64>.
 */

import { onMounted } from 'vue'

const ADMIN_AUTH_KEY = 'adminAuth'

function getStoredToken(): string | null {
  if (!import.meta.client) return null
  let token = localStorage.getItem(ADMIN_AUTH_KEY)
  if (!token) {
    token = sessionStorage.getItem(ADMIN_AUTH_KEY)
    if (token) {
      localStorage.setItem(ADMIN_AUTH_KEY, token)
      sessionStorage.removeItem(ADMIN_AUTH_KEY)
    }
  }
  return token
}

export function useAdminAuth() {
  const isLoggedIn = useState<boolean>('adminLoggedIn', () => false)
  const initialized = useState<boolean>('admin-auth-initialized', () => false)

  // IMPORTANT: do not read localStorage before hydration, or SSR/CSR can diverge.
  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      isLoggedIn.value = !!getStoredToken()
    })
  }

  function getAuthHeader(): { Authorization: string } | null {
    if (import.meta.client) {
      const token = getStoredToken()
      if (token) return { Authorization: `Basic ${token}` }
    }
    return null
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
    const token = btoa(`${username}:${password}`)
    localStorage.setItem(ADMIN_AUTH_KEY, token)
    isLoggedIn.value = true
  }

  function clearAuth() {
    localStorage.removeItem(ADMIN_AUTH_KEY)
    isLoggedIn.value = false
  }

  function checkLoggedIn(): boolean {
    if (import.meta.client) {
      isLoggedIn.value = !!getStoredToken()
    }
    return isLoggedIn.value
  }

  return { getAuthHeader, fetchWithAuth, setAuth, clearAuth, checkLoggedIn, isLoggedIn }
}
