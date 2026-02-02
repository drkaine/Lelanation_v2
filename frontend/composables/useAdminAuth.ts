/**
 * Admin auth: credentials stored in sessionStorage after login.
 * API calls to /api/admin/* must send Authorization: Basic <base64>.
 */

const ADMIN_AUTH_KEY = 'adminAuth'

export function useAdminAuth() {
  const isLoggedIn = useState('adminLoggedIn', () => ref(false))

  function getAuthHeader(): { Authorization: string } | null {
    if (import.meta.client) {
      const token = sessionStorage.getItem(ADMIN_AUTH_KEY)
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
    sessionStorage.setItem(ADMIN_AUTH_KEY, token)
    isLoggedIn.value = true
  }

  function clearAuth() {
    sessionStorage.removeItem(ADMIN_AUTH_KEY)
    isLoggedIn.value = false
  }

  function checkLoggedIn() {
    if (import.meta.client) {
      isLoggedIn.value = !!sessionStorage.getItem(ADMIN_AUTH_KEY)
    }
    return isLoggedIn.value
  }

  onMounted(() => {
    checkLoggedIn()
  })

  return { getAuthHeader, fetchWithAuth, setAuth, clearAuth, checkLoggedIn, isLoggedIn }
}
