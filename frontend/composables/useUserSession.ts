/**
 * Session d'un compte (admin / lelariva / lelateam) : jeton Bearer de /api/users/login.
 * Gardée en localStorage (jeton révocable côté serveur, expirant), lue après hydratation.
 */
import { onMounted } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { USER_SESSION_KEY, parseStoredSession, type StoredSession } from '~/utils/userSession'

export function readStoredSession(): StoredSession | null {
  if (!import.meta.client) return null
  try {
    return parseStoredSession(localStorage.getItem(USER_SESSION_KEY))
  } catch {
    return null
  }
}

export function useUserSession() {
  const session = useState<StoredSession | null>('userSession', () => null)
  const loaded = useState<boolean>('userSessionLoaded', () => false)

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    session.value = readStoredSession()
  }
  if (import.meta.client) onMounted(load)

  const role = computed(() => session.value?.user.role ?? null)

  function setSession(next: StoredSession) {
    session.value = next
    loaded.value = true
    try {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(next))
    } catch {
      /* stockage indisponible : session limitée à l'onglet */
    }
  }

  function forget() {
    session.value = null
    try {
      localStorage.removeItem(USER_SESSION_KEY)
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    const token = session.value?.token ?? readStoredSession()?.token
    forget()
    if (token) {
      await fetch(apiUrl('/api/users/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined)
    }
  }

  /** fetch avec le Bearer ; un 401 efface la session (expirée ou révoquée). */
  async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = session.value?.token ?? readStoredSession()?.token
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    const res = await fetch(apiUrl(path), { ...init, headers })
    if (res.status === 401) forget()
    return res
  }

  return { session, role, load, setSession, forget, logout, authFetch }
}
