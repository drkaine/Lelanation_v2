import { SURVEILLANCE_ALERT_CHECK_INTERVAL_MS } from '~/constants/surveillanceAlerts'

/** Vérifie les alertes surveillance à la connexion, puis toutes les 12 h si l’onglet reste ouvert. */
export default defineNuxtPlugin({
  name: 'lelanation-surveillance-alerts',
  enforce: 'post',
  setup(nuxtApp) {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let runCheck: (() => Promise<unknown>) | null = null

    const scheduleCheck = () => {
      runCheck?.().catch(() => undefined)
    }

    const startPeriodicChecks = () => {
      if (intervalId !== null) return
      intervalId = setInterval(scheduleCheck, SURVEILLANCE_ALERT_CHECK_INTERVAL_MS)
    }

    const stopPeriodicChecks = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    if (import.meta.client) {
      window.addEventListener('beforeunload', stopPeriodicChecks)
    }

    // Initialiser après montage : useI18n / composables dans un plugin au boot
    // provoquaient SyntaxError côté client avant chargement des messages lazy.
    nuxtApp.hook('app:mounted', () => {
      const { runSurveillanceAlertCheck } = useSurveillanceAlertEvaluation()
      runCheck = runSurveillanceAlertCheck

      const statisticsUiStore = useStatisticsUiStore()
      const alertStore = useStatisticsSurveillanceAlertStore()

      scheduleCheck()
      startPeriodicChecks()

      watch(
        () => [...statisticsUiStore.watchedChampionIds],
        () => scheduleCheck(),
        { deep: true }
      )

      watch(
        () => [
          alertStore.thresholdProfiles,
          alertStore.sharedThresholds,
          alertStore.referenceSettings,
        ],
        () => scheduleCheck(),
        { deep: true }
      )
    })
  },
})
