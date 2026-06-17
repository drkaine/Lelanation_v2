/** Charge les préférences UI stats (onglets masqués, etc.) avant le premier rendu client. */
export default defineNuxtPlugin(() => {
  const statisticsUiStore = useStatisticsUiStore()
  statisticsUiStore.init()
})
