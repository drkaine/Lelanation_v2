/**
 * Fallback : si un HTML SWR/cache référence data-src vers un _payload.json absent,
 * forcer l'hydratation depuis le JSON inline (évite 500 client).
 */
if (import.meta.client) {
  const el = document.getElementById('__NUXT_DATA__')
  if (el?.hasAttribute('data-src') && el.textContent?.trim()) {
    el.removeAttribute('data-src')
  }
}

export default defineNuxtPlugin(() => {})
