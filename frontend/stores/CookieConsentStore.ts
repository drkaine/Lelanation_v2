import { defineStore } from 'pinia'
import {
  matomoCookieNames,
  parseStoredConsent,
  serializeConsent,
  type ConsentChoice,
} from '~/utils/cookieConsent'

export type { ConsentChoice }

const KEY = 'cookie_consent'

function save(choice: 'accepted' | 'rejected') {
  try {
    localStorage.setItem(KEY, serializeConsent(choice, Date.now()))
  } catch {
    // ignore
  }
}

/** Supprime les cookies Matomo posés après une acceptation (retrait du consentement). */
function clearMatomoCookies() {
  if (typeof document === 'undefined') return
  const domains = ['', `; domain=${location.hostname}`, `; domain=.${location.hostname}`]
  for (const name of matomoCookieNames(document.cookie)) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
}

export const useCookieConsentStore = defineStore('cookieConsent', {
  state: () => ({
    choice: 'unknown' as ConsentChoice,
    /** Choix enregistré avant réouverture du bandeau (lien « Gérer les cookies »). */
    previousChoice: 'unknown' as ConsentChoice,
  }),
  actions: {
    load() {
      try {
        this.choice = parseStoredConsent(localStorage.getItem(KEY), Date.now())
      } catch {
        this.choice = 'unknown'
      }
    },
    accept() {
      this.choice = 'accepted'
      this.previousChoice = 'unknown'
      save('accepted')
    },
    /** Retourne true si Matomo était actif : la page doit être rechargée pour le décharger. */
    reject(): boolean {
      const wasAccepted = this.previousChoice === 'accepted'
      this.choice = 'rejected'
      this.previousChoice = 'unknown'
      save('rejected')
      if (wasAccepted) clearMatomoCookies()
      return wasAccepted
    },
    reopen() {
      if (this.choice === 'unknown') return
      this.previousChoice = this.choice
      this.choice = 'unknown'
    },
  },
})
