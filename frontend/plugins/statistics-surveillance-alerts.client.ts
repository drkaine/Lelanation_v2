import { shouldRunScheduledSurveillanceCheck } from '~/constants/surveillanceAlerts'

/** Vérifie les alertes surveillance (stats + builds) à la connexion si > 24 h. */
export default defineNuxtPlugin({
  name: 'lelanation-surveillance-alerts',
  enforce: 'post',
  setup(nuxtApp) {
    nuxtApp.hook('app:mounted', async () => {
      const alertStore = useStatisticsSurveillanceAlertStore()
      const buildStore = useStatisticsBuildSurveillanceStore()
      alertStore.init()
      buildStore.init()

      const { runSurveillanceAlertCheck } = useSurveillanceAlertEvaluation()
      const { runBuildSurveillanceCheck } = useBuildSurveillanceEvaluation()

      if (shouldRunScheduledSurveillanceCheck(alertStore.lastCheckedAt)) {
        runSurveillanceAlertCheck().catch(() => undefined)
      }

      if (!shouldRunScheduledSurveillanceCheck(buildStore.lastCheckedAt)) return

      let patch = ''
      try {
        const versionsData = await $fetch<{
          versions?: Array<{ patchLabel?: string; version?: string }>
        }>('/data/game/versions.json')
        const rows = versionsData?.versions ?? []
        patch = String(rows[rows.length - 1]?.patchLabel ?? rows[rows.length - 1]?.version ?? '')
      } catch {
        patch = ''
      }

      runBuildSurveillanceCheck({ rankTiers: [], role: '', patch }).catch(() => undefined)
    })
  },
})
