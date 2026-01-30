/**
 * Plugin client pour forcer la suppression des Service Workers hérités
 *
 * Ce plugin supprime TOUS les Service Workers enregistrés pour ce domaine.
 * Nécessaire lors d'une migration depuis une version avec PWA vers une version sans PWA,
 * ou lors d'une refonte majeure pour éviter les conflits de cache.
 *
 * ⚠️ À SUPPRIMER après quelques semaines/mois une fois que tous les utilisateurs
 * ont rechargé le site et que les anciens SW sont supprimés.
 */
/* eslint-disable no-console -- intentional logging for SW cleanup */
export default defineNuxtPlugin(() => {
  if (process.client && 'serviceWorker' in navigator) {
    const reloadKey = 'sw_cleanup_done_v1'
    const alreadyReloaded = window.localStorage.getItem(reloadKey) === '1'

    // Supprimer tous les Service Workers enregistrés
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => {
        if (registrations.length > 0) {
          console.log(
            `[SW Cleanup] Suppression de ${registrations.length} Service Worker(s) hérité(s)`
          )
          return Promise.all(registrations.map(registration => registration.unregister()))
        }
      })
      .then(() => {
        // Vider tous les caches du Service Worker
        if ('caches' in window) {
          return caches.keys().then(cacheNames => {
            return Promise.all(
              cacheNames.map(cacheName => {
                console.log(`[SW Cleanup] Suppression du cache: ${cacheName}`)
                return caches.delete(cacheName)
              })
            )
          })
        }
      })
      .then(() => {
        console.log('[SW Cleanup] Nettoyage terminé avec succès')
        // Recharger UNE FOIS pour s'assurer que l'app repart sur le bon HTML/JS.
        // Important: évite les pages blanches chez les utilisateurs avec un cache "zombie".
        if (!alreadyReloaded) {
          window.localStorage.setItem(reloadKey, '1')
          window.location.reload()
        }
      })
      .catch(error => {
        console.error('[SW Cleanup] Erreur lors du nettoyage:', error)
      })
  }
})
