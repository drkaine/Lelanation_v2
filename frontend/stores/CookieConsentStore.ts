import { defineStore } from 'pinia'

export type ConsentChoice = 'unknown' | 'accepted' | 'rejected'

const KEY = 'cookie_consent'

export const useCookieConsentStore = defineStore('cookieConsent', {
  state: () => ({
    choice: 'unknown' as ConsentChoice,
  }),
  actions: {
    load() {
      try {
        const raw = localStorage.getItem(KEY)
        if (raw === 'accepted' || raw === 'rejected') {
          this.choice = raw
        } else {
          this.choice = 'unknown'
        }
      } catch {
        this.choice = 'unknown'
      }
    },
    accept() {
      this.choice = 'accepted'
      try {
        localStorage.setItem(KEY, 'accepted')
      } catch {
        // ignore
      }
    },
    reject() {
      this.choice = 'rejected'
      try {
        localStorage.setItem(KEY, 'rejected')
      } catch {
        // ignore
      }
    },
  },
})
