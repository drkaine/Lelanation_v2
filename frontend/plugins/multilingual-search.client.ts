/** Preload FR+EN champion/item names for cross-language search. */
export default defineNuxtPlugin({
  name: 'lelanation-multilingual-search',
  enforce: 'post',
  setup(nuxtApp) {
    const multilingualSearchStore = useMultilingualSearchStore()
    const versionStore = useVersionStore()

    const hydrate = async () => {
      if (!versionStore.currentVersion) {
        await versionStore.loadCurrentVersion().catch(() => undefined)
      }
      await multilingualSearchStore.ensureLoaded(versionStore.currentVersion || undefined)
    }

    hydrate().catch(() => undefined)

    nuxtApp.hook('app:mounted', () => {
      hydrate().catch(() => undefined)
    })
  },
})
