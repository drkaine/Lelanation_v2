/**
 * Quitte la session d'édition (build existant chargé comme copie) lorsque l'utilisateur
 * quitte entièrement le flux /builds/create/*. Les changements d'étape à l'intérieur du
 * builder ne déclenchent pas ce middleware.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (!import.meta.client) return

  const fromPath = from?.path ?? ''
  const toPath = to.path
  const wasInBuilder = /\/builds\/create(\/|$)/.test(fromPath)
  const isInBuilder = /\/builds\/create(\/|$)/.test(toPath)

  if (wasInBuilder && !isInBuilder) {
    const buildStore = useBuildStore()
    if (buildStore.editSourceBuildId) {
      buildStore.leaveEditSessionAndRestoreCreateDraft()
    }
  }
})
