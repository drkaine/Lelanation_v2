/** Preload champion/item names for search in the active UI language. */
export default defineNuxtPlugin({
  name: 'lelanation-multilingual-search',
  enforce: 'post',
  setup(nuxtApp) {
    const multilingualSearchStore = useMultilingualSearchStore()
    const versionStore = useVersionStore()
    const i18n = nuxtApp.$i18n as { locale: { value: string } }

    const riotLocale = computed(() => riotLocaleFromI18n(i18n.locale.value))

    const hydrate = async (language = riotLocale.value) => {
      if (!versionStore.currentVersion) {
        await versionStore.loadCurrentVersion().catch(() => undefined)
      }
      await multilingualSearchStore.ensureLoaded(versionStore.currentVersion || undefined, language)
    }

    watch(riotLocale, language => {
      hydrate(language).catch(() => undefined)
    })

    nuxtApp.hook('app:mounted', () => {
      const schedule = () => {
        hydrate().catch(() => undefined)
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(schedule, { timeout: 4000 })
      } else {
        setTimeout(schedule, 1500)
      }
    })
  },
})
