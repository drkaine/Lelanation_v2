/** Charge les préférences UI stats (localStorage) après l’hydratation Pinia. */
export default defineNuxtPlugin({
  name: 'lelanation-statistics-ui',
  enforce: 'post',
  setup(nuxtApp) {
    const statisticsUiStore = useStatisticsUiStore()
    const alertStore = useStatisticsSurveillanceAlertStore()

    const hydrateStatisticsUi = () => {
      statisticsUiStore.init()
    }

    const hydrateAlertStore = () => {
      alertStore.init()
    }

    hydrateStatisticsUi()
    hydrateAlertStore()

    nuxtApp.hook('app:mounted', () => {
      hydrateStatisticsUi()
      hydrateAlertStore()
    })
    // Ne pas recharger le store alertes à chaque navigation : cela écrase l’accusé de lecture
    // en mémoire et relance des comparaisons instables avec les re-vérifications en cours.
    nuxtApp.hook('page:finish', hydrateStatisticsUi)
  },
})
