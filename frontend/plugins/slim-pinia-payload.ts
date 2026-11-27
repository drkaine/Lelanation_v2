/**
 * Serveur : retire les catalogues items / champions / runes du payload (logique : utils/slimPiniaPayload).
 * Client : les recharge (JSON versionné, cache HTTP) avant l'hydratation pour un DOM identique.
 */
import { readSlimMarker, slimPiniaPayload } from '~/utils/slimPiniaPayload'
import { riotLanguage } from '~/utils/riotLanguage'
import { useItemsStore } from '~/stores/ItemsStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useRunesStore } from '~/stores/RunesStore'

export default defineNuxtPlugin({
  name: 'slim-pinia-payload',
  dependsOn: ['pinia'],
  async setup(nuxtApp) {
    if (import.meta.server) {
      nuxtApp.hook('app:rendered', () => {
        const state = nuxtApp.payload.pinia
        if (typeof state !== 'object' || state === null) return
        const { state: slim, stripped } = slimPiniaPayload({ ...state })
        if (stripped.length === 0) return
        nuxtApp.payload.pinia = slim
        nuxtApp.payload.slimStores = {
          lang: riotLanguage(nuxtApp.$i18n.locale.value),
          stores: stripped,
        }
      })
      return
    }
    const marker = readSlimMarker(nuxtApp.payload.slimStores)
    if (!marker) return
    const loaders = {
      items: () => useItemsStore().loadItems(marker.lang),
      champions: () => useChampionsStore().loadChampions(marker.lang),
      runes: () => useRunesStore().loadRunes(marker.lang),
    }
    await Promise.all(marker.stores.map(id => loaders[id]().catch(() => undefined)))
  },
})
