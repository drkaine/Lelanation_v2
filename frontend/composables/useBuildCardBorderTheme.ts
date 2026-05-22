import { computed, ref, watch, type CSSProperties, type MaybeRefOrGetter, toValue } from 'vue'
import {
  buildCardBorderCssVars,
  loadBuildCardRegionsPayload,
  resolveRegionColorsForChampion,
  type BuildCardRegionsPayload,
} from '~/utils/buildCardBorderTheme'

export function useBuildCardBorderTheme(championId: MaybeRefOrGetter<string | null | undefined>) {
  const regionsPayload = ref<BuildCardRegionsPayload | null>(null)

  if (import.meta.client) {
    loadBuildCardRegionsPayload().then(payload => {
      regionsPayload.value = payload
    })
  }

  watch(
    () => toValue(championId),
    () => {
      if (!import.meta.client || regionsPayload.value) return
      loadBuildCardRegionsPayload().then(payload => {
        regionsPayload.value = payload
      })
    },
    { immediate: true }
  )

  const themeVars = computed<CSSProperties>(() => {
    const colors = resolveRegionColorsForChampion(toValue(championId), regionsPayload.value)
    return buildCardBorderCssVars(colors)
  })

  return { themeVars, regionsPayload }
}
