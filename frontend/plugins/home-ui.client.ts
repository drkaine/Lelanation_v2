/** Charge les préférences UI home (localStorage) après l’hydratation Pinia. */
export default defineNuxtPlugin({
  name: 'lelanation-home-ui',
  enforce: 'post',
  setup(nuxtApp) {
    const homeUiStore = useHomeUiStore()

    const hydrateHomeUi = () => {
      homeUiStore.init()
    }

    hydrateHomeUi()

    nuxtApp.hook('app:mounted', hydrateHomeUi)
    nuxtApp.hook('page:finish', hydrateHomeUi)
  },
})
