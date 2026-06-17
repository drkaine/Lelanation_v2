/** Charge les préférences UI stats (localStorage) après l’hydratation Pinia. */
export default defineNuxtPlugin({
  name: 'lelanation-statistics-ui',
  enforce: 'post',
  setup(nuxtApp) {
    const statisticsUiStore = useStatisticsUiStore()

    const hydrateFromLocalStorage = () => {
      statisticsUiStore.init()
    }

    hydrateFromLocalStorage()

    nuxtApp.hook('app:mounted', hydrateFromLocalStorage)
    nuxtApp.hook('page:finish', hydrateFromLocalStorage)
  },
})
